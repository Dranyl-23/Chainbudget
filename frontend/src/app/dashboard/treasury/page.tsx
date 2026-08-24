"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { 
  Box, Save, Activity, ShieldAlert, Link as LinkIcon, RefreshCw, Layers,
  Building, Camera, Upload, Check, CheckCircle2 
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import { getAmoyProvider } from "@/lib/rpcProvider";
import axios from "axios";
import { getErrorMessage } from "@/lib/utils";

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

interface UploadResponse {
  documentUrl: string;
  isLocal?: boolean;
  documentHash?: string;
}

function formatOrgLogo(url?: string) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const backendBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://chainbudget-api.fly.dev";
  return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getOrgId(org?: string | UserOrgRef): string | undefined {
  if (!org) return undefined;
  return typeof org === "string" ? org : org._id;
}

export default function TreasuryPage() {
  const { user, activeOrgId, refreshUser } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<string>("0.0000");
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [orgDetails, setOrgDetails] = useState<OrganizationSettings | null>(null);

  // Emblem Rebranding State
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
  const [isUploadingOrgLogo, setIsUploadingOrgLogo] = useState(false);
  const [showEmblemSuccessModal, setShowEmblemSuccessModal] = useState(false);
  const [uploadedEmblemUrl, setUploadedEmblemUrl] = useState<string | null>(null);

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
      // Connect to Polygon Amoy Public RPC
      const provider = getAmoyProvider();
      const rawBalance = await provider.getBalance(address);
      const formatted = ethers.formatEther(rawBalance);
      setBalance(parseFloat(formatted).toFixed(4));
    } catch (err: unknown) {
      console.error("Failed to fetch contract balance:", err);
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
          if (settings.logoUrl) {
            setOrgLogoPreview(formatOrgLogo(settings.logoUrl));
          }
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

  const handleOrgLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Emblem image must be under 5MB");
        return;
      }
      setOrgLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setOrgLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRebrandOrgLogo = async () => {
    if (!activeOrgId) {
      toast.error("No active organization selected.");
      return;
    }
    if (!orgLogoFile && !orgLogoPreview) {
      toast.error("Please select a new emblem image.");
      return;
    }

    try {
      setIsUploadingOrgLogo(true);
      let newLogoUrl = orgLogoPreview;

      if (orgLogoFile) {
        const uploadData = new FormData();
        uploadData.append("file", orgLogoFile);
        const uploadRes = await api.post<UploadResponse>("/upload", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (uploadRes.data?.documentUrl) {
          newLogoUrl = uploadRes.data.documentUrl;
        }
      }

      if (newLogoUrl) {
        await api.patch(`/organizations/${activeOrgId}`, {
          logoUrl: newLogoUrl,
        });

        setUploadedEmblemUrl(formatOrgLogo(newLogoUrl));
        setOrgLogoFile(null);
        setShowEmblemSuccessModal(true);
        await refreshUser();
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update emblem"));
    } finally {
      setIsUploadingOrgLogo(false);
    }
  };

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
      <div className="p-8 text-center animate-fade-in">
        <div className="glass inline-block p-8 rounded-2xl border border-red-500/20">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-400">Only Executive Admins (Level 1) can access Treasury Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2 text-cyan-300">
          <Box className="w-6 h-6 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" /> 
          Treasury & Smart Contract
        </h1>
        <p className="text-sm text-white/50">Manage your organization&apos;s on-chain treasury and multi-sig governance rules.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-xl border border-purple-500/20 p-6 relative overflow-hidden shadow-[inset_0_0_20px_rgba(139,92,246,0.05)]">
              {/* Background gradient effect */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-lg font-bold text-gray-100 mb-6 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-400" />
                Governance Rules
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                
                <div>
                  <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                    Treasury Smart Contract Address
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/40 border border-white/10 text-cyan-300 font-mono text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all placeholder-gray-600"
                      placeholder="0x..."
                      value={formData.contractAddress}
                      onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mt-1.5 ml-1">
                    The Polygon address of your DAO&apos;s multi-sig or treasury contract.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                      High-Value Threshold (PHP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm font-bold">₱</span>
                      <input
                        type="number"
                        min="0"
                        className="w-full pl-8 pr-4 py-3 rounded-lg bg-black/40 border border-white/10 text-gray-100 font-mono text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all"
                        value={formData.highValueThreshold}
                        onChange={(e) => setFormData({ ...formData, highValueThreshold: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5 ml-1">
                      Transactions above this amount require multi-sig approval.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                      Required Approvals
                    </label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/40 border border-white/10 text-gray-100 font-mono text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all"
                        value={formData.requiredApprovals}
                        onChange={(e) => setFormData({ ...formData, requiredApprovals: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5 ml-1">
                      Number of Executive signers needed for High-Value Transactions.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]"
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
            {/* Organization Branding & Emblem Rebrand Card */}
            {orgDetails && (
              <div className="glass rounded-xl border border-purple-500/20 p-6 relative overflow-hidden shadow-[inset_0_0_20px_rgba(139,92,246,0.05)]">
                <div className="flex items-center justify-between mb-4 border-b border-purple-500/10 pb-3">
                  <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                    <Building className="w-5 h-5 text-purple-400" />
                    Organization Emblem & Branding
                  </h2>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400">
                    Level 1 Tool
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                  <div className="relative group shrink-0">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border-2 border-dashed border-purple-500/40 p-1 flex items-center justify-center overflow-hidden shadow-inner">
                      {orgLogoPreview ? (
                        <Image 
                          src={orgLogoPreview} 
                          alt="Org Emblem" 
                          width={80}
                          height={80}
                          unoptimized
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-purple-400">
                          <Building className="w-7 h-7 opacity-60 mb-0.5" />
                          <span className="text-[9px] text-white/40 font-bold">No Emblem</span>
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-lg transition-all hover:scale-105 border border-purple-400/50">
                      <Camera className="w-3.5 h-3.5" />
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/webp" 
                        onChange={handleOrgLogoFileChange}
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                    <p className="text-xs text-white/60">
                      Update your official organization emblem visible across the Transparency Explorer, Treasury approvals, and Mobile client.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 justify-center sm:justify-start">
                      <label className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-2 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        Choose File
                        <input 
                          type="file" 
                          accept="image/png, image/jpeg, image/webp" 
                          onChange={handleOrgLogoFileChange}
                          className="hidden" 
                        />
                      </label>
                      <button
                        onClick={handleRebrandOrgLogo}
                        disabled={isUploadingOrgLogo || !orgLogoFile}
                        className="btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50"
                      >
                        {isUploadingOrgLogo ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Publishing...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Update Emblem</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Balance Widget */}
          <div className="space-y-6">
            <div className="glass rounded-xl border border-cyan-500/30 p-6 relative overflow-hidden shadow-[inset_0_0_20px_rgba(34,211,238,0.1)] h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Live Balance
                </h2>
                {formData.contractAddress && (
                  <button 
                    onClick={() => fetchBalance(formData.contractAddress)}
                    disabled={isFetchingBalance}
                    className={`p-1.5 rounded-md hover:bg-white/10 text-cyan-300 transition-all ${isFetchingBalance ? "opacity-50 cursor-not-allowed" : ""}`}
                    title="Refresh Balance"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingBalance ? "animate-spin" : ""}`} />
                  </button>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-center py-6 relative">
                {!formData.contractAddress ? (
                  <div className="text-center text-white/40">
                    <Box className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No Contract Linked</p>
                  </div>
                ) : (
                  <>
                    {/* Glowing background orb */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-cyan-400/20 rounded-full blur-[40px] pointer-events-none" />
                    
                    <div className="text-center relative z-10">
                      <span className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-purple-400 tracking-tighter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                        {balance}
                      </span>
                      <span className="ml-2 text-lg font-bold text-cyan-400">POL</span>
                    </div>
                    <div className="text-center mt-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-900/30 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono tracking-widest uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-glow" />
                        Polygon Network
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 text-center">
                <p className="text-[10px] text-white/30">
                  Balance is fetched directly from the Polygon blockchain using ethers.js.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Custom Emblem Celebration Modal ── */}
      {showEmblemSuccessModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative bg-[#13121d] border border-purple-500/40 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] w-full max-w-sm p-6 text-center animate-modal-pop">
            
            {/* Glowing Pulse Ring & Avatar */}
            <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 animate-ping opacity-60" />
              <div className="relative w-20 h-20 rounded-2xl bg-white/5 border-2 border-emerald-400 overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                {uploadedEmblemUrl || orgLogoPreview ? (
                  <Image 
                    src={uploadedEmblemUrl || orgLogoPreview || ''} 
                    alt="Rebranded Emblem" 
                    width={80}
                    height={80}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building className="w-10 h-10 text-emerald-400" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-[#13121d] shadow-md">
                <Check className="w-4 h-4 stroke-3" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white tracking-tight mb-1">
              Emblem Rebranded!
            </h3>

            <div className="inline-block bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full mb-3">
              <span className="text-xs font-bold text-purple-300">
                {orgDetails?.name || "Organization"}
              </span>
            </div>

            <p className="text-xs text-white/60 leading-relaxed mb-6 px-2">
              Your new organization logo and custom emblem have been published to IPFS and synchronized across the Public Ledger, Group Chats, and Member Dashboards.
            </p>

            <button
              type="button"
              onClick={() => setShowEmblemSuccessModal(false)}
              className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Done & Synchronized
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
