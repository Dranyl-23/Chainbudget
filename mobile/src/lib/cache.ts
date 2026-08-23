/**
 * cache.ts
 *
 * Local caching and offline persistence helper for ChainBudget Mobile.
 * Uses AsyncStorage for instant cold-start loading, TTL enforcement, and offline resilience.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
  DASHBOARD: 'cb_cache_dashboard',
  ORGANIZATIONS: 'cb_cache_orgs',
  APPROVALS_PREFIX: 'cb_cache_approvals_',
  PROPOSALS_PREFIX: 'cb_cache_proposals_',
  MEMBERS_PREFIX: 'cb_cache_members_',
  NOTIFICATIONS_PREFIX: 'cb_cache_notifications_',
  BUDGETS_PREFIX: 'cb_cache_budgets_',
  TRANSACTIONS_PREFIX: 'cb_cache_txs_',
};

// Default Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  DASHBOARD: 5 * 60 * 1000,      // 5 minutes
  APPROVALS: 3 * 60 * 1000,      // 3 minutes
  PROPOSALS: 5 * 60 * 1000,      // 5 minutes
  MEMBERS: 10 * 60 * 1000,       // 10 minutes
  NOTIFICATIONS: 3 * 60 * 1000,  // 3 minutes
};

interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

/**
 * Generic helper to save an item to cache with a timestamp
 */
export async function setCachedItem<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      data,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (err) {
    console.warn(`[Cache] Failed to save ${key}:`, err);
  }
}

/**
 * Generic helper to retrieve an item with optional TTL enforcement
 * If enforceTtl is true and cached item is older than maxAgeMs, returns null
 */
export async function getCachedItem<T>(
  key: string,
  maxAgeMs?: number
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const envelope: CacheEnvelope<T> = JSON.parse(raw);

    // If envelope doesn't have cachedAt (e.g. legacy cache), return raw data
    if (!envelope || typeof envelope.cachedAt !== 'number') {
      return (envelope as unknown as T) || null;
    }

    // Check TTL expiration if specified
    if (maxAgeMs !== undefined && Date.now() - envelope.cachedAt > maxAgeMs) {
      return null;
    }

    return envelope.data;
  } catch {
    return null;
  }
}

// ── Dashboard Cache with TTL ──────────────────────────────────────────────────

export interface DashboardCacheData {
  organizations?: any[];
  activeOrgId?: string;
  personalBalance?: string;
  budgets?: any[];
  recentTransactions?: any[];
  updatedAt?: number;
}

/**
 * Save cached dashboard snapshot
 */
export async function setCachedDashboard(data: DashboardCacheData) {
  try {
    const existing = (await getCachedDashboard(false)) || {};
    const merged = { ...existing, ...data, updatedAt: Date.now() };
    await setCachedItem(CACHE_KEYS.DASHBOARD, merged);
  } catch (err) {
    console.warn('[Cache] Failed to save dashboard cache:', err);
  }
}

/**
 * Retrieve cached dashboard snapshot with optional TTL enforcement
 */
export async function getCachedDashboard(
  enforceTtl = true
): Promise<DashboardCacheData | null> {
  const ttl = enforceTtl ? CACHE_TTL.DASHBOARD : undefined;
  return getCachedItem<DashboardCacheData>(CACHE_KEYS.DASHBOARD, ttl);
}

// ── Extended Caches: Approvals, Proposals, Members, Notifications ─────────────

export async function setCachedApprovals(orgId: string, data: any[]) {
  if (!orgId) return;
  await setCachedItem(`${CACHE_KEYS.APPROVALS_PREFIX}${orgId}`, data);
}

export async function getCachedApprovals(orgId: string, enforceTtl = true): Promise<any[] | null> {
  if (!orgId) return null;
  const ttl = enforceTtl ? CACHE_TTL.APPROVALS : undefined;
  return getCachedItem<any[]>(`${CACHE_KEYS.APPROVALS_PREFIX}${orgId}`, ttl);
}

export async function setCachedProposals(orgId: string, data: any[]) {
  if (!orgId) return;
  await setCachedItem(`${CACHE_KEYS.PROPOSALS_PREFIX}${orgId}`, data);
}

export async function getCachedProposals(orgId: string, enforceTtl = true): Promise<any[] | null> {
  if (!orgId) return null;
  const ttl = enforceTtl ? CACHE_TTL.PROPOSALS : undefined;
  return getCachedItem<any[]>(`${CACHE_KEYS.PROPOSALS_PREFIX}${orgId}`, ttl);
}

export async function setCachedMembers(orgId: string, data: any[]) {
  if (!orgId) return;
  await setCachedItem(`${CACHE_KEYS.MEMBERS_PREFIX}${orgId}`, data);
}

export async function getCachedMembers(orgId: string, enforceTtl = true): Promise<any[] | null> {
  if (!orgId) return null;
  const ttl = enforceTtl ? CACHE_TTL.MEMBERS : undefined;
  return getCachedItem<any[]>(`${CACHE_KEYS.MEMBERS_PREFIX}${orgId}`, ttl);
}

export async function setCachedNotifications(orgId: string, data: any[]) {
  if (!orgId) return;
  await setCachedItem(`${CACHE_KEYS.NOTIFICATIONS_PREFIX}${orgId}`, data);
}

export async function getCachedNotifications(orgId: string, enforceTtl = true): Promise<any[] | null> {
  if (!orgId) return null;
  const ttl = enforceTtl ? CACHE_TTL.NOTIFICATIONS : undefined;
  return getCachedItem<any[]>(`${CACHE_KEYS.NOTIFICATIONS_PREFIX}${orgId}`, ttl);
}

/**
 * Prunes expired local cache items to prevent AsyncStorage growth over months/years.
 * Safe to run during app startup or background resume.
 */
export async function pruneExpiredCache(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cbKeys = allKeys.filter((k) => k.startsWith('cb_cache_'));

    for (const key of cbKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const envelope = JSON.parse(raw);
        if (envelope && typeof envelope.cachedAt === 'number') {
          if (Date.now() - envelope.cachedAt > maxAgeMs) {
            await AsyncStorage.removeItem(key);
          }
        }
      } catch {
        // Corrupted item — clean it up
        await AsyncStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('[Cache] Failed to prune expired cache:', err);
  }
}
