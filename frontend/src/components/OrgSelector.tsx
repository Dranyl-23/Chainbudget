"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus, Building, ShieldCheck, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { MyOrgApplicationSummary } from "@/lib/orgApplications";

interface Organization {
  _id: string;
  name: string;
  type: string;
  logoUrl?: string;
  verification?: {
    status?: string;
  };
}

function formatOrgLogo(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  const backendBase =
    process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
    "https://chainbudget-api.fly.dev";
  return `${backendBase}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function OrgLogoIcon({
  url,
  name,
  size = 28,
  className = "",
}: {
  url?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const formatted = formatOrgLogo(url);

  if (!formatted || hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 ${className}`}
      >
        <Building
          className="text-zinc-400"
          style={{ width: Math.max(12, size * 0.5), height: Math.max(12, size * 0.5) }}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={formatted}
      alt={name || "Org Emblem"}
      style={{ width: size, height: size }}
      className={`rounded-lg object-cover bg-zinc-900 border border-zinc-800 shrink-0 ${className}`}
      onError={() => setHasError(true)}
    />
  );
}

export default function OrgSelector() {
  const { activeOrgId, setActiveOrgId } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [pendingAppsCount, setPendingAppsCount] = useState<number>(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadOrgs = async () => {
      try {
        const [orgsRes, appsRes] = await Promise.allSettled([
          api.get<Organization[]>("/organizations"),
          api.get<MyOrgApplicationSummary[]>("/org-applications/mine"),
        ]);
        if (!isCancelled) {
          if (orgsRes.status === "fulfilled") {
            const organizations = orgsRes.value.data || [];
            setOrgs(organizations);

            if (!activeOrgId && organizations.length > 0) {
              setActiveOrgId(organizations[0]._id);
            }
          }
          if (appsRes.status === "fulfilled") {
            const myApps = appsRes.value.data || [];
            setPendingAppsCount(myApps.length);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to fetch organizations:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrgs();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, setActiveOrgId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeOrg = orgs.find((o) => o._id === activeOrgId);

  return (
    <div className="relative w-full select-none" ref={dropdownRef}>
      {/* Selector Button */}
      <div
        className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors bg-surface border border-zinc-800 hover:border-zinc-700 select-none shadow-xs"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <OrgLogoIcon url={activeOrg?.logoUrl} name={activeOrg?.name} size={28} />
          <div className="overflow-hidden min-w-0">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold leading-none mb-1">
              Organization
            </p>
            <p className="text-xs font-bold text-white truncate flex items-center gap-1">
              <span className="truncate">
                {loading
                  ? "Loading..."
                  : activeOrg
                  ? activeOrg.name
                  : "Select Organization"}
              </span>
              {activeOrg?.verification?.status === "verified" && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 w-full bg-surface rounded-xl shadow-2xl border border-zinc-800 py-1.5 z-50 animate-fade-in">
          <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            {orgs.map((org) => {
              const isSelected = activeOrgId === org._id;
              return (
                <div
                  key={org._id}
                  className={`px-2.5 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors gap-2 ${
                    isSelected
                      ? "bg-zinc-800 text-white font-semibold"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                  }`}
                  onClick={() => {
                    setActiveOrgId(org._id);
                    setDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <OrgLogoIcon url={org.logoUrl} name={org.name} size={22} />
                    <span className="truncate">{org.name}</span>
                    {org.verification?.status === "verified" && (
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
              );
            })}
            {orgs.length === 0 && !loading && (
              <div className="px-3 py-2 text-xs text-zinc-500 italic">
                No organizations found
              </div>
            )}
          </div>
          <div className="border-t border-zinc-800/80 mt-1 pt-1 px-1 space-y-0.5">
            {pendingAppsCount > 0 && (
              <button
                type="button"
                className="w-full px-2.5 py-1.5 text-xs text-amber-300 hover:text-white hover:bg-zinc-900 rounded-lg cursor-pointer flex items-center justify-between font-medium transition-colors"
                onClick={() => {
                  setDropdownOpen(false);
                  router.push("/organizations/new");
                }}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Track Applications</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full text-amber-400 font-mono">
                  {pendingAppsCount}
                </span>
              </button>
            )}

            <button
              type="button"
              className="w-full px-2.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg cursor-pointer flex items-center gap-2 font-medium transition-colors whitespace-nowrap"
              onClick={() => {
                setDropdownOpen(false);
                router.push("/organizations/new");
              }}
            >
              <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-400">
                <Plus className="w-3 h-3" />
              </div>
              <span className="truncate">Register & Verify Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
