"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  OrgApplicationView,
  OrgRequirements,
  StepKey,
} from "@/lib/orgApplications";

interface OrgRegistrationContextType {
  application: OrgApplicationView | null;
  requirements: OrgRequirements | null;
  loading: boolean;
  error: string | null;
  setApplication: (app: OrgApplicationView) => void;
  reload: () => Promise<void>;
  saveStep: (step: StepKey, payload: Record<string, unknown>) => Promise<{
    ok: boolean;
    app?: OrgApplicationView;
    fields?: Record<string, string>;
    errorMessage?: string;
  }>;
}

const OrgRegistrationContext = createContext<OrgRegistrationContextType | null>(null);

export function OrgRegistrationProvider({
  applicationId,
  children,
}: {
  applicationId: string;
  children: React.ReactNode;
}) {
  const [application, setApplication] = useState<OrgApplicationView | null>(null);
  const [requirements, setRequirements] = useState<OrgRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OrgApplicationView>(`/org-applications/${applicationId}`)
      .then(async (appRes) => {
        if (cancelled) return;
        const app = appRes.data;
        setApplication(app);

        const reqRes = await api.get<OrgRequirements>(
          `/org-applications/requirements?type=${encodeURIComponent(app.type)}`
        );
        if (cancelled) return;
        setRequirements(reqRes.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const apiErr = err as { response?: { data?: { error?: string } } };
        setError(apiErr.response?.data?.error || "Could not load application.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const appRes = await api.get<OrgApplicationView>(`/org-applications/${applicationId}`);
      const app = appRes.data;
      setApplication(app);

      const reqRes = await api.get<OrgRequirements>(
        `/org-applications/requirements?type=${encodeURIComponent(app.type)}`
      );
      setRequirements(reqRes.data);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      setError(apiErr.response?.data?.error || "Could not load application.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  const saveStep = useCallback(
    async (step: StepKey, payload: Record<string, unknown>) => {
      try {
        const res = await api.patch<OrgApplicationView>(
          `/org-applications/${applicationId}/steps/${step}`,
          payload
        );
        setApplication(res.data);
        return { ok: true, app: res.data };
      } catch (err: unknown) {
        const apiErr = err as {
          response?: {
            data?: { error?: string; fields?: Record<string, string> };
          };
        };
        return {
          ok: false,
          fields: apiErr.response?.data?.fields || {},
          errorMessage: apiErr.response?.data?.error || "Validation failed.",
        };
      }
    },
    [applicationId]
  );

  return (
    <OrgRegistrationContext.Provider
      value={{
        application,
        requirements,
        loading,
        error,
        setApplication,
        reload,
        saveStep,
      }}
    >
      {children}
    </OrgRegistrationContext.Provider>
  );
}

export function useOrgRegistration(): OrgRegistrationContextType {
  const ctx = useContext(OrgRegistrationContext);
  if (!ctx) {
    throw new Error("useOrgRegistration must be used inside OrgRegistrationProvider");
  }
  return ctx;
}
