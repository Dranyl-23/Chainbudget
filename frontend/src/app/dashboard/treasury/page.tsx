"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Box, Save, Activity, ShieldAlert, Link as LinkIcon, RefreshCw, Layers,
  ExternalLink, Coins
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import { fetchAmoyBalance } from "@/lib/rpcProvider";
import { getErrorMessage } from "@/lib/utils";
import EmblemRebrandSection from "@/components/EmblemRebrandSection";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserOrgRef {
  _id?: string;
  name?: string;
}

interface UserMembership {
  organization?: string | UserOrgRef;
  roleLevel: number;
  roleLabel?: string;
  isActive?: boolean;
}

interface OrganizationSettings {
  _id?: string;
  name?: string;
  type?: string;
  logoUrl?: string;
  contractAddress?: string;
  requiredApprovals?: number;
  highValueThreshold?: number;
}

interface TreasuryFormData {
  contractAddress: string;
  requiredApprovals: number;
  highValueThreshold: number;
}

function getOrgId(org?: string | UserOrgRef): string | undefined {
  if (!org) return undefined;
  return typeof org === "string" ? org : org._id;
}

export default function TreasuryPage() {
  const { user, activeOrgId } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<string>("0.0000");
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [orgDetails, setOrgDetails] = useState<OrganizationSettings | null>(null);

  const [formData, setFormData] = useState<TreasuryFormData>({
    contractAddress: "",
    requiredApprovals: 2,
    highValueThreshold: 10000,
  });

  // Current user's role level in this org
  const memberships = (user?.memberships || []) as UserMembership[];
  const userMembership = memberships.find((m) => getOrgId(m.organization) === activeOrgId);
  const roleLevel = user?.isSuperAdmin ? 1 : (userMembership?.roleLevel || 4);

  const fetchBalance = useCallback(async (address: string) => {
    if (!address || !ethers.isAddress(address)) return;
    try {
      setIsFetchingBalance(true);
      const rawBalance = await fetchAmoyBalance(address);
      const formatted = ethers.formatEther(rawBalance);
      setBalance(parseFloat(formatted).toFixed(4));
    } catch (err: unknown) {
      console.warn("Failed to fetch contract balance:", err);
      setBalance("0.0000");
    } finally {
      setIsFetchingBalance(false);
    }
  }, []);

  // ── Data Fetching Effect ──────────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    const loadOrgSettings = async () => {
      if (!activeOrgId) return;
      try {
        setLoading(true);
        const res = await api.get<OrganizationSettings>(`/organizations/${activeOrgId}`);
        if (!isCancelled) {
          const settings = res.data;
          setOrgDetails(settings);
          const contractAddress = settings.contractAddress || "";
          setFormData({
            contractAddress,
            requiredApprovals: settings.requiredApprovals || 2,
            highValueThreshold: settings.highValueThreshold || 10000,
          });
          if (contractAddress) {
            void fetchBalance(contractAddress);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          toast.error(getErrorMessage(err, "Failed to load treasury settings."));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadOrgSettings();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, fetchBalance]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (roleLevel > 1) {
      toast.error("Only Level 1 Executives can update Treasury settings.");
      return;
    }
    
    setSaving(true);
    try {
      await api.patch(`/organizations/${activeOrgId}`, formData);
      toast.success("Treasury settings updated successfully!");
      if (formData.contractAddress) {
        void fetchBalance(formData.contractAddress);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update settings."));
    } finally {
      setSaving(false);
    }
  };

  if (roleLevel > 1) {
    return (
      <div className="p-8 text-center animate-fade-in flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-[#121215] border border-zinc-800 p-8 rounded-xl max-w-md w-full shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white mb-1">Executive Access Required</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Only Level 1 Executive Admins have cryptographic authority to modify Treasury contracts and multi-sig security thresholds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
              Level 1 Executive Tool
            </span>
            <span className="text-[11px] text-zinc-500">Polygon Amoy Testnet</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Box className="w-6 h-6 text-zinc-300" /> 
            Treasury &amp; Smart Contract
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-2xl">
            Configure your organization&apos;s on-chain treasury contract address and multi-sig cryptographic approval parameters.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Left Column: Form & Emblem Rebrand */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-xs">
              <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Multi-Sig &amp; Treasury Parameters</h2>
                  <p className="text-[11px] text-zinc-400">Define required quorum and trigger amounts for multi-sig execution</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                    Treasury Smart Contract Address
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:border-zinc-500 focus:outline-none transition-all placeholder:text-zinc-600"
                      placeholder="0x..."
                      value={formData.contractAddress}
                      onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 ml-0.5">
                    The verified Polygon smart contract address representing your organization&apos;s decentralized safe.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                      High-Value Threshold (PHP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">₱</span>
                      <input
                        type="number"
                        min="0"
                        className="w-full pl-8 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none transition-all"
                        value={formData.highValueThreshold}
                        onChange={(e) => setFormData({ ...formData, highValueThreshold: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 ml-0.5">
                      Transactions strictly at or above this value trigger mandatory multi-sig sign-offs.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                      Required Signatures Quorum
                    </label>
                    <div className="relative">
                      <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none transition-all"
                        value={formData.requiredApprovals}
                        onChange={(e) => setFormData({ ...formData, requiredApprovals: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 ml-0.5">
                      Total distinct executive cryptographic votes needed before release on Polygon.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    {saving ? (
                      <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save Parameters
                  </button>
                </div>
              </form>
            </div>

            {/* Organization Branding & Emblem Rebrand Card */}
            {orgDetails && (
              <EmblemRebrandSection
                orgId={activeOrgId}
                orgDetails={orgDetails}
                badgeLabel="Level 1 Tool"
                onSuccess={(newLogo) => {
                  setOrgDetails((prev) => prev ? { ...prev, logoUrl: newLogo } : null);
                }}
              />
            )}
          </div>

          {/* Right Column: Live Balance Widget */}
          <div className="space-y-5">
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-xs flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-zinc-300" />
                    <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                      On-Chain Safe Balance
                    </h2>
                  </div>
                  {formData.contractAddress && (
                    <button 
                      onClick={() => fetchBalance(formData.contractAddress)}
                      disabled={isFetchingBalance}
                      className={`p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer ${isFetchingBalance ? "opacity-50 cursor-not-allowed" : ""}`}
                      title="Refresh Balance"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBalance ? "animate-spin text-zinc-300" : ""}`} />
                    </button>
                  )}
                </div>

                <div className="py-6 text-center">
                  {!formData.contractAddress ? (
                    <div className="text-zinc-500 py-4">
                      <Box className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      <p className="text-xs text-zinc-400">No Contract Linked</p>
                      <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                        Link a contract address in the form to observe live balances.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-3xl md:text-4xl font-bold text-white font-mono tracking-tight">
                          {balance}
                        </span>
                        <span className="text-sm font-semibold text-zinc-400 font-mono">POL</span>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Polygon Amoy
                        </span>

                        <a
                          href={`https://amoy.polygonscan.com/address/${formData.contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white transition-colors"
                        >
                          Scan <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3.5 border-t border-zinc-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                  <Coins className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Real-time provider queried via ethers.js</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
