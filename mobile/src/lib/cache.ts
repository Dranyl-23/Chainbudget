/**
 * cache.ts
 *
 * Local caching and offline persistence helper for ChainBudget Mobile.
 * Uses AsyncStorage for instant cold-start loading and offline data resilience.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  DASHBOARD: 'cb_cache_dashboard',
  ORGANIZATIONS: 'cb_cache_orgs',
  BUDGETS_PREFIX: 'cb_cache_budgets_',
  TRANSACTIONS_PREFIX: 'cb_cache_txs_',
};

/**
 * Save cached dashboard snapshot
 */
export async function setCachedDashboard(data: {
  organizations?: any[];
  activeOrgId?: string;
  personalBalance?: string;
  budgets?: any[];
  recentTransactions?: any[];
}) {
  try {
    const existing = await getCachedDashboard();
    const merged = { ...existing, ...data, updatedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEYS.DASHBOARD, JSON.stringify(merged));
  } catch (err) {
    console.warn('[Cache] Failed to save dashboard cache:', err);
  }
}

/**
 * Retrieve cached dashboard snapshot
 */
export async function getCachedDashboard(): Promise<{
  organizations?: any[];
  activeOrgId?: string;
  personalBalance?: string;
  budgets?: any[];
  recentTransactions?: any[];
  updatedAt?: number;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.DASHBOARD);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
