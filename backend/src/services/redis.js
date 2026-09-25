/**
 * services/redis.js
 *
 * Enterprise-grade Redis integration for ChainBudgets:
 * - Multi-server Socket.io horizontal scaling via @socket.io/redis-adapter
 * - High-speed L1 Sorted Set message caching (ZREVRANGEBYSCORE) for <2ms bootstrap
 * - Cluster-wide real-time organization presence tracking
 * - Resilient Fail-Open Design: Gracefully falls back to in-memory state and MongoDB
 *   if REDIS_URL is not configured or temporarily unreachable.
 */

const Redis = require("ioredis");
const { createAdapter } = require("@socket.io/redis-adapter");

const REDIS_URL = process.env.REDIS_URL || null;

let redisClient = null;
let pubClient = null;
let subClient = null;
let isRedisConnected = false;
let isConnecting = false;

// Fallback in-memory presence tracking if Redis is offline or not configured
const inMemoryOrgPresence = new Map(); // orgId -> Set<userId>

let ioInstance = null;

function tryAttachAdapter() {
  if (!ioInstance || !pubClient || !subClient) return false;
  if (pubClient.status !== "ready" && pubClient.status !== "connecting") return false;
  if (subClient.status !== "ready" && subClient.status !== "connecting") return false;
  try {
    ioInstance.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket.IO] Redis adapter attached for multi-server cluster broadcast.");
    return true;
  } catch (err) {
    console.warn("[Socket.IO] Could not attach Redis adapter:", err.message);
    return false;
  }
}

/**
 * Creates an ioredis client instance configured for resilience
 */
function createClient(name) {
  if (!REDIS_URL) return null;

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy(times) {
      if (times > 10) {
        console.warn(`[Redis:${name}] Max connection retries exceeded. Operating in fallback mode.`);
        return null;
      }
      return Math.min(times * 500, 3000);
    },
  });

  client.on("connect", () => {
    console.log(`[Redis:${name}] Connected successfully.`);
    isRedisConnected = true;
  });

  client.on("ready", () => {
    isRedisConnected = true;
    tryAttachAdapter();
  });

  client.on("error", (err) => {
    console.warn(`[Redis:${name}] Warning:`, err.message || err);
    isRedisConnected = false;
  });

  client.on("close", () => {
    isRedisConnected = false;
  });

  return client;
}

/**
 * Initialize Redis connections
 */
async function initRedis() {
  if (!REDIS_URL) {
    console.log("[Redis] REDIS_URL not configured. Running in high-performance single-node mode with in-memory caching.");
    return false;
  }

  if (isConnecting || isRedisConnected) return isRedisConnected;
  isConnecting = true;

  try {
    redisClient = createClient("data");
    pubClient = createClient("pub");
    subClient = createClient("sub");

    await Promise.all([
      redisClient.connect().catch((e) => console.warn("[Redis] Data client connection deferred:", e.message)),
      pubClient.connect().catch((e) => console.warn("[Redis] Pub client connection deferred:", e.message)),
      subClient.connect().catch((e) => console.warn("[Redis] Sub client connection deferred:", e.message)),
    ]);

    isRedisConnected = redisClient.status === "ready" || redisClient.status === "connecting";
    tryAttachAdapter();
    return isRedisConnected;
  } catch (err) {
    console.warn("[Redis] Failed to initialize Redis clients:", err.message);
    isRedisConnected = false;
    return false;
  } finally {
    isConnecting = false;
  }
}

// Auto-initialize if REDIS_URL is present
if (REDIS_URL) {
  void initRedis();
}

/**
 * Attaches @socket.io/redis-adapter to the Socket.IO instance if Redis is configured
 */
function initRedisAdapter(io) {
  ioInstance = io;
  return tryAttachAdapter();
}

/**
 * Check if Redis is actively connected and ready for commands
 */
function isRedisAvailable() {
  return isRedisConnected && redisClient && redisClient.status === "ready";
}

// ── L1 Sorted Set Message Caching ──────────────────────────────────────────

const MAX_CACHE_MESSAGES_PER_ROOM = 200;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_ITEM_BYTES = 32768; // 32KB max per message item in Redis

/**
 * Sanitizes a message before caching to prevent Redis memory bloat.
 * Strips huge base64 data URIs (e.g. 1MB+ avatars) from sender/seenBy/replyTo.
 */
function sanitizeMessageForCache(msg) {
  if (!msg || typeof msg !== "object") return null;

  try {
    const clean = { ...msg };

    // Sanitize sender avatar
    if (clean.sender && typeof clean.sender === "object") {
      const avatar = clean.sender.avatarUrl;
      clean.sender = {
        ...clean.sender,
        avatarUrl:
          typeof avatar === "string" && (avatar.startsWith("data:") || avatar.length > 512)
            ? ""
            : avatar,
      };
    }

    // Sanitize seenBy avatars
    if (Array.isArray(clean.seenBy)) {
      clean.seenBy = clean.seenBy.map((u) => {
        if (!u || typeof u !== "object") return u;
        const avatar = u.avatarUrl;
        return {
          ...u,
          avatarUrl:
            typeof avatar === "string" && (avatar.startsWith("data:") || avatar.length > 512)
              ? ""
              : avatar,
        };
      });
    }

    // Sanitize replyTo sender avatar
    if (clean.replyTo && typeof clean.replyTo === "object") {
      clean.replyTo = { ...clean.replyTo };
      if (clean.replyTo.sender && typeof clean.replyTo.sender === "object") {
        const avatar = clean.replyTo.sender.avatarUrl;
        clean.replyTo.sender = {
          ...clean.replyTo.sender,
          avatarUrl:
            typeof avatar === "string" && (avatar.startsWith("data:") || avatar.length > 512)
              ? ""
              : avatar,
        };
      }
    }

    // Sanitize attachments: if attachment has large base64 data, strip it
    if (Array.isArray(clean.attachments)) {
      clean.attachments = clean.attachments.map((att) => {
        if (!att || typeof att !== "object") return att;
        const copy = { ...att };
        if (typeof copy.data === "string" && copy.data.length > 512) {
          delete copy.data;
        }
        return copy;
      });
    }

    // Check final payload size: If a single message is > 32KB, do not cache in Redis
    const str = JSON.stringify(clean);
    if (str.length > MAX_ITEM_BYTES) {
      return null;
    }

    return clean;
  } catch {
    return null;
  }
}

/**
 * Retrieves cached messages for an organization using Redis Sorted Sets
 * @param {string} orgId
 * @param {number} limit
 * @param {string|null} before - ISO date string or null
 * @returns {Promise<Array|null>} Returns array of messages, or null on cache miss
 */
async function getCachedMessages(orgId, limit = 50, before = null) {
  if (!isRedisAvailable()) return null;

  try {
    const key = `chat:msgs:${orgId}`;
    let maxScore = "+inf";
    if (before) {
      const beforeTime = new Date(before).getTime();
      if (!isNaN(beforeTime)) {
        // "(" denotes exclusive boundary in Redis
        maxScore = `(${beforeTime}`;
      }
    }

    const raw = await redisClient.zrevrangebyscore(key, maxScore, "-inf", "LIMIT", 0, limit);
    if (!raw || raw.length === 0) {
      return null; // Cache miss or cold room
    }

    const parsed = raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Return in chronological order (oldest to newest for chat views)
    return parsed.reverse();
  } catch (err) {
    console.warn("[Redis:getCachedMessages]", err.message);
    if (err.message && err.message.includes("max request size exceeded")) {
      // Auto-purge the bloated key to restore Redis health instantly
      void redisClient.del(`chat:msgs:${orgId}`).catch(() => {});
    }
    return null;
  }
}

/**
 * Adds a newly posted message to the Redis L1 sorted set
 * @param {string} orgId
 * @param {object} message
 */
async function cacheMessage(orgId, message) {
  if (!isRedisAvailable() || !message) return;

  try {
    const cleanMsg = sanitizeMessageForCache(message);
    if (!cleanMsg) return;

    const key = `chat:msgs:${orgId}`;
    const score = new Date(cleanMsg.createdAt || Date.now()).getTime();
    const payload = JSON.stringify(cleanMsg);

    const pipeline = redisClient.pipeline();
    pipeline.zadd(key, score, payload);
    // Trim sorted set to keep only latest 200 messages
    pipeline.zremrangebyrank(key, 0, -(MAX_CACHE_MESSAGES_PER_ROOM + 1));
    pipeline.expire(key, CACHE_TTL_SECONDS);
    await pipeline.exec();
  } catch (err) {
    console.warn("[Redis:cacheMessage]", err.message);
  }
}

/**
 * Prime/warm the Redis cache with a batch of messages fetched from MongoDB
 * @param {string} orgId
 * @param {Array} messages
 */
async function cacheMessageBatch(orgId, messages) {
  if (!isRedisAvailable() || !Array.isArray(messages) || messages.length === 0) return;

  try {
    const key = `chat:msgs:${orgId}`;
    const pipeline = redisClient.pipeline();
    let validCount = 0;

    for (const msg of messages) {
      const cleanMsg = sanitizeMessageForCache(msg);
      if (!cleanMsg) continue;

      const score = new Date(cleanMsg.createdAt || Date.now()).getTime();
      pipeline.zadd(key, score, JSON.stringify(cleanMsg));
      validCount++;
    }

    if (validCount === 0) return;

    pipeline.zremrangebyrank(key, 0, -(MAX_CACHE_MESSAGES_PER_ROOM + 1));
    pipeline.expire(key, CACHE_TTL_SECONDS);
    await pipeline.exec();
  } catch (err) {
    console.warn("[Redis:cacheMessageBatch]", err.message);
    if (err.message && err.message.includes("max request size exceeded")) {
      void redisClient.del(`chat:msgs:${orgId}`).catch(() => {});
    }
  }
}

// ── Presence Tracking ────────────────────────────────────────────────────────

/**
 * Mark a user as online in an organization
 */
async function addOrgOnlineUser(orgId, userId) {
  const strOrg = orgId.toString();
  const strUser = userId.toString();

  // Always update in-memory fallback
  if (!inMemoryOrgPresence.has(strOrg)) {
    inMemoryOrgPresence.set(strOrg, new Set());
  }
  inMemoryOrgPresence.get(strOrg).add(strUser);

  if (isRedisAvailable()) {
    try {
      const key = `chat:presence:${strOrg}`;
      await redisClient.sadd(key, strUser);
      await redisClient.expire(key, 60 * 60 * 24); // 24h safety TTL
    } catch (err) {
      console.warn("[Redis:addOrgOnlineUser]", err.message);
    }
  }
}

/**
 * Mark a user as offline in an organization
 */
async function removeOrgOnlineUser(orgId, userId) {
  const strOrg = orgId.toString();
  const strUser = userId.toString();

  const memSet = inMemoryOrgPresence.get(strOrg);
  if (memSet) {
    memSet.delete(strUser);
    if (memSet.size === 0) inMemoryOrgPresence.delete(strOrg);
  }

  if (isRedisAvailable()) {
    try {
      await redisClient.srem(`chat:presence:${strOrg}`, strUser);
    } catch (err) {
      console.warn("[Redis:removeOrgOnlineUser]", err.message);
    }
  }
}

/**
 * Retrieve all currently online user IDs for an organization
 * @param {string} orgId
 * @returns {Promise<string[]>}
 */
async function getOrgOnlineUsers(orgId) {
  const strOrg = orgId.toString();

  if (isRedisAvailable()) {
    try {
      const members = await redisClient.smembers(`chat:presence:${strOrg}`);
      if (Array.isArray(members)) {
        return members;
      }
    } catch (err) {
      console.warn("[Redis:getOrgOnlineUsers]", err.message);
    }
  }

  // Fallback to in-memory set
  const memSet = inMemoryOrgPresence.get(strOrg);
  return memSet ? Array.from(memSet) : [];
}

/**
 * Synchronous in-memory online lookup for synchronous request paths
 */
function getOrgOnlineUsersSync(orgId) {
  const strOrg = orgId.toString();
  const memSet = inMemoryOrgPresence.get(strOrg);
  return memSet ? Array.from(memSet) : [];
}

module.exports = {
  initRedis,
  initRedisAdapter,
  isRedisAvailable,
  getCachedMessages,
  cacheMessage,
  cacheMessageBatch,
  addOrgOnlineUser,
  removeOrgOnlineUser,
  getOrgOnlineUsers,
  getOrgOnlineUsersSync,
};
