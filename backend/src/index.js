require("dotenv").config();
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (e) {
  // Fallback if DNS server configuration is restricted
}
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const orgRoutes = require("./routes/organizations");
const userRoutes = require("./routes/users");
const transactionRoutes = require("./routes/transactions");
const approvalRoutes = require("./routes/approvals");
const reportRoutes = require("./routes/reports");
const auditRoutes = require("./routes/audit");
const budgetRoutes = require("./routes/budget");
const uploadRoutes = require("./routes/upload");
const adminRoutes = require("./routes/admin");
const daoRoutes = require("./routes/dao");
const publicRoutes = require("./routes/public");
const notificationRoutes = require("./routes/notifications");
const aiRoutes = require("./routes/ai");
const feedbackRoutes = require("./routes/feedback");
const chatRoutes = require("./routes/chat");
const { generalRateLimiter, csrfProtection } = require("./middleware/security");

const app = express();
// Enable trust proxy so rate limiter works behind Render's load balancer
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5001;

// ── WebSocket Server ──────────────────────────────────────────────────────────
const server = http.createServer(app);
const socketAllowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "https://chainbudget-dranyl-23s-projects.vercel.app",
  "https://chainbudget.vercel.app",
  "http://localhost:3000",
  "http://localhost:8081",
];
const io = new Server(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});
app.set("io", io);

// H-4 Fix: Authenticate WebSocket connections (supports both mobile + browser tokens)
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));

  const { verifyChainBudgetJWT } = require("./middleware/auth");

  // Try ChainBudget mobile JWT first (fast, no network)
  const cbPayload = verifyChainBudgetJWT(token);
  if (cbPayload && cbPayload.sub) {
    socket.userId = cbPayload.sub;       // MongoDB _id string
    socket.authSource = "chainbudget";
    return next();
  }

  // Fall back to Asgardeo UserInfo (browser)
  try {
    const asgardeoBase = process.env.ASGARDEO_BASE_URL || "https://api.asgardeo.io/t/orgs3xfu";
    const response = await fetch(`${asgardeoBase}/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return next(new Error("Invalid token"));
    const data = await response.json();
    socket.userId = data.sub;            // Asgardeo sub
    socket.authSource = "asgardeo";
    return next();
  } catch (err) {
    return next(new Error("Authentication failed"));
  }
});

// In-memory real-time presence tracking per organization
const orgOnlineUsers = new Map(); // orgId -> Set<mongoUserId>
const userActiveSockets = new Map(); // mongoUserId -> Set<socketId>

function broadcastOrgOnline(orgId) {
  const usersSet = orgOnlineUsers.get(orgId);
  const onlineUserIds = usersSet ? Array.from(usersSet) : [];
  io.to(`org:${orgId}`).emit("org_online_users", {
    orgId,
    onlineUserIds,
  });
}

app.set("getOrgOnlineUsers", (orgId) => {
  const usersSet = orgOnlineUsers.get(orgId);
  return usersSet ? Array.from(usersSet) : [];
});

io.on("connection", async (socket) => {
  console.log("Client connected via WebSocket:", socket.id, "user:", socket.userId, "source:", socket.authSource);

  let mongoUserId = null;
  const userOrgIds = new Set();

  if (socket.userId) {
    socket.join(`user:${socket.userId}`);

    // Load org memberships from DB using the correct identifier per auth source
    try {
      const User = require("./models/User");
      let user;
      if (socket.authSource === "chainbudget") {
        // Mobile: userId is a MongoDB _id
        user = await User.findById(socket.userId).select("_id memberships").lean();
      } else {
        // Browser: userId is an Asgardeo sub
        user = await User.findOne({ asgardeoId: socket.userId }).select("_id memberships").lean();
      }
      if (user) {
        mongoUserId = user._id.toString();
        socket.mongoUserId = mongoUserId;
        socket.join(`user:${mongoUserId}`);

        // Track socket connection for this user
        if (!userActiveSockets.has(mongoUserId)) {
          userActiveSockets.set(mongoUserId, new Set());
        }
        userActiveSockets.get(mongoUserId).add(socket.id);

        if (user.memberships) {
          user.memberships
            .filter((m) => m.isActive)
            .forEach((m) => {
              const orgId = (m.organization?._id || m.organization).toString();
              userOrgIds.add(orgId);
              socket.join(`org:${orgId}`);

              if (!orgOnlineUsers.has(orgId)) {
                orgOnlineUsers.set(orgId, new Set());
              }
              orgOnlineUsers.get(orgId).add(mongoUserId);
              broadcastOrgOnline(orgId);
            });
        }
      }
    } catch (err) {
      console.error("[socket:org_init]", err);
    }
  }

  // Dynamic room joining for organizations
  socket.on("join_org", (orgId) => {
    if (orgId) {
      const strOrgId = orgId.toString();
      socket.join(`org:${strOrgId}`);
      userOrgIds.add(strOrgId);
      if (mongoUserId) {
        if (!orgOnlineUsers.has(strOrgId)) {
          orgOnlineUsers.set(strOrgId, new Set());
        }
        orgOnlineUsers.get(strOrgId).add(mongoUserId);
        broadcastOrgOnline(strOrgId);
      }
      console.log(`[socket] Socket ${socket.id} explicitly joined org:${strOrgId}`);
    }
  });

  socket.on("get_org_online", (orgId) => {
    if (orgId) {
      const strOrgId = orgId.toString();
      const usersSet = orgOnlineUsers.get(strOrgId);
      socket.emit("org_online_users", {
        orgId: strOrgId,
        onlineUserIds: usersSet ? Array.from(usersSet) : [],
      });
    }
  });

  socket.on("leave_org", (orgId) => {
    if (orgId) {
      const strOrgId = orgId.toString();
      socket.leave(`org:${strOrgId}`);
      userOrgIds.delete(strOrgId);
      if (mongoUserId) {
        const orgSet = orgOnlineUsers.get(strOrgId);
        if (orgSet) {
          orgSet.delete(mongoUserId);
          if (orgSet.size === 0) orgOnlineUsers.delete(strOrgId);
          broadcastOrgOnline(strOrgId);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (mongoUserId) {
      const userSockets = userActiveSockets.get(mongoUserId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userActiveSockets.delete(mongoUserId);
          // User is offline across all tabs / devices
          userOrgIds.forEach((orgId) => {
            const orgSet = orgOnlineUsers.get(orgId);
            if (orgSet) {
              orgSet.delete(mongoUserId);
              if (orgSet.size === 0) orgOnlineUsers.delete(orgId);
              broadcastOrgOnline(orgId);
            }
          });
        }
      }
    }
  });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // H-6 Fix: Enable HSTS in production, disable in dev
  hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false 
}));
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "https://chainbudget-dranyl-23s-projects.vercel.app",
  "https://chainbudget.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:8081",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow mobile apps, curl, postman, and server-to-server (no origin header)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('chainbudget.vercel.app') ||
      origin.endsWith('chainbudget-dranyl-23s-projects.vercel.app') ||
      (process.env.NODE_ENV === 'development' && (
        origin.endsWith('.trycloudflare.com') ||
        origin.endsWith('.ngrok-free.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.')
      ))
    ) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // H-8 Fix: Prevent large payload DoS

// GAP-18: Safe MongoDB operator ($ and .) sanitizer that does not reassign req.query getter
function sanitizeMongoObject(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      sanitizeMongoObject(obj[key]);
    }
  }
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") sanitizeMongoObject(req.body);
  if (req.params && typeof req.params === "object") sanitizeMongoObject(req.params);
  if (req.query && typeof req.query === "object") {
    try {
      sanitizeMongoObject(req.query);
    } catch (_) {}
  }
  next();
});

// ── Static file serving for uploaded receipts & avatars ─────────────────────
const os = require("os");
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/uploads", express.static(path.join(os.tmpdir(), "uploads")));

// ── Security Middleware ───────────────────────────────────────────────────────
// Apply general rate limiting to all API routes
app.use("/api/", generalRateLimiter);

// Apply CSRF protection to all POST/PUT/DELETE requests (except auth endpoints)
app.use("/api/", csrfProtection);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/organizations", orgRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dao", daoRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/chat", chatRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Error handler (H-7: Don't leak internal details) ──────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.stack || err);
  const isProd = process.env.NODE_ENV === "production";
  // Multer errors (wrong file type, file too large) → always return 400 with reason
  const isMulterError = err.code === 'LIMIT_FILE_SIZE' ||
    (err.message && (err.message.startsWith('Only') || err.message.includes('allowed')));
  if (isMulterError) {
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  res.status(err.status || 500).json({
    error: isProd ? "Internal Server Error" : (err.message || "Internal Server Error"),
  });
});

// ── Database & server start ───────────────────────────────────────────────────
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("FATAL: MongoDB connection URI is not configured (missing MONGO_URI or MONGODB_URI).");
  console.error("Please configure a valid MONGO_URI in your backend .env file.");
  process.exit(1);
}

if (mongoUri.includes("<cluster-url>") || mongoUri.includes("<db_user>") || mongoUri.includes("<db_password>")) {
  console.error("FATAL: MongoDB connection URI contains unreplaced template placeholders (<cluster-url>, <db_user>, or <db_password>).");
  console.error("Please update MONGO_URI in backend/.env with your actual MongoDB Atlas cluster hostname or MongoDB connection string.");
  process.exit(1);
}

mongoose
  .connect(mongoUri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Force IPv4 to prevent IPv6 DNS stalls on cloud providers
  })
  .then(() => {
    console.log("Connected to MongoDB (Pool: min=5, max=50)");
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`ChainBudget API running on http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
      // Start Asynchronous Blockchain Auto-Retry Reconciliation Worker
      const { startBlockchainSyncWorker } = require("./services/blockchainSyncWorker");
      startBlockchainSyncWorker(io);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

module.exports = app;
