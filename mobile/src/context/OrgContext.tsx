/**
 * OrgContext.tsx
 *
 * Shared organization state for ChainBudget Mobile.
 *
 * Problem solved:
 *   Previously, DashboardScreen, ApprovalsScreen, GovernanceScreen, and
 *   NotificationsScreen each independently called GET /organizations on mount.
 *   This caused:
 *     1. 4 simultaneous duplicate API calls on every cold start.
 *     2. The active org selection NOT being shared — switching org on the
 *        Dashboard had zero effect on what Approvals or Governance showed.
 *
 * Solution:
 *   This context fetches organizations once after login and provides a single
 *   shared activeOrgId that all screens subscribe to. Switching org in any
 *   screen switches it everywhere.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export type OrgSummary = {
  _id: string;
  name: string;
  type?: string;
  logoUrl?: string;
  subsidyAmount?: number;
  contractAddress?: string;
  isActive?: boolean;
  [key: string]: any;
};

type OrgContextType = {
  /** Full list of organizations the user is a member of. */
  organizations: OrgSummary[];

  /** Currently selected org ID (shared across all screens). */
  activeOrgId: string | null;

  /** The full org object for the active org. */
  activeOrg: OrgSummary | null;

  /** True while the initial org list is being fetched. */
  isLoadingOrgs: boolean;

  /**
   * Switch the active org.
   * All screens subscribed to useOrg() will react immediately.
   */
  setActiveOrgId: (orgId: string) => void;

  /**
   * Re-fetch the organization list from the backend.
   * Call after creating or leaving an org.
   */
  refreshOrgs: () => Promise<void>;
};

// ── Context ────────────────────────────────────────────────────────────────────

const OrgContext = createContext<OrgContextType>({
  organizations: [],
  activeOrgId: null,
  activeOrg: null,
  isLoadingOrgs: false,
  setActiveOrgId: () => {},
  refreshOrgs: async () => {},
});

export function useOrg(): OrgContextType {
  return useContext(OrgContext);
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Fetch orgs whenever the user changes (login / logout) ─────────────────
  useEffect(() => {
    if (user) {
      fetchOrgs();
    } else {
      // Logged out — clear org state
      setOrganizations([]);
      setActiveOrgIdState(null);
    }
  }, [user]);

  const fetchOrgs = useCallback(async () => {
    setIsLoadingOrgs(true);
    try {
      const res = await api.get('/organizations');
      const orgs: OrgSummary[] = res.data || [];

      // Fallback: seed from user.memberships if API returns empty
      const currentUser = userRef.current;
      if (orgs.length === 0 && currentUser?.memberships?.length) {
        const fromMemberships = currentUser.memberships
          .filter((m: any) => m.isActive)
          .map((m: any) => ({
            _id: m.organization?._id || m.organization,
            name: m.organization?.name || m.organizationName || 'Organization',
            subsidyAmount: m.organization?.subsidyAmount || 0,
            ...m.organization,
          }));
        setOrganizations(fromMemberships);
        if (fromMemberships.length > 0) {
          setActiveOrgIdState((prev) =>
            prev && fromMemberships.some((o: any) => o._id === prev) ? prev : fromMemberships[0]._id
          );
        }
        return;
      }

      setOrganizations(orgs);

      // Set initial activeOrgId to first org, but don't overwrite an existing
      // valid selection (e.g. the user already switched orgs in this session).
      if (orgs.length > 0) {
        setActiveOrgIdState((prev) =>
          prev && orgs.some((o) => o._id === prev) ? prev : orgs[0]._id
        );
      }
    } catch (err: any) {
      console.warn('[OrgContext] Failed to fetch organizations:', err?.message || err);
    } finally {
      setIsLoadingOrgs(false);
    }
  }, []);

  const setActiveOrgId = useCallback((orgId: string) => {
    setActiveOrgIdState(orgId);
  }, []);

  const refreshOrgs = useCallback(async () => {
    await fetchOrgs();
  }, [fetchOrgs]);

  const activeOrg = organizations.find((o) => o._id === activeOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{
        organizations,
        activeOrgId,
        activeOrg,
        isLoadingOrgs,
        setActiveOrgId,
        refreshOrgs,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}
