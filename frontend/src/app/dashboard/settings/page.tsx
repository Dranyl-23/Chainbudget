"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { ethers } from "ethers";
import { fetchAmoyBalance } from "@/lib/rpcProvider";
import api from "@/lib/api";
import { getExplorerAddressUrl } from "@/lib/config";
import { getProvider, linkWallet } from "@/lib/wallet";
import { getErrorMessage } from "@/lib/utils";
import toast from "react-hot-toast";
import { 
  Save, Wallet, Upload, User as UserIcon, ShieldCheck, 
  ExternalLink, Copy, Check, CheckCircle2, 
  Sparkles, X, Lock, Key, Clock, ShieldAlert,
  Bell} from "lucide-react";
import EmblemRebrandSection from "@/components/EmblemRebrandSection";
import Portal from "@/components/Portal";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserOrgRef {
  _id?: string;
  name?: string;
}

interface UserMembership {
  organization?: string | UserOrgRef;
  roleLabel?: string;
  roleLevel?: number;
  hasSBT?: boolean;
  sbtTokenId?: string;
}

interface PendingLiquidationOrg {
  _id: string;
  name: string;
  liquidationStatus?: string;
  subsidyAmount?: number;
}

interface AutoWalletKeys {
  privateKey?: string;
  mnemonic?: string;
  isNonCustodial?: boolean;
  walletType?: string;
  message?: string;
  error?: string;
}

interface UploadResponse {
  documentUrl: string;
  isLocal?: boolean;
  documentHash?: string;
}

interface OrganizationDetails {
  _id: string;
  name: string;
  type?: string;
  logoUrl?: string;
  description?: string;
}

function formatAvatarUrl(url?: string) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const backendBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://chainbudget-api.fly.dev";
  return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function SettingsPage() {
  const { user, refreshUser, activeOrgId } = useAuth();
  
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const currentDisplayName = displayName || user?.displayName || "";
  const activeAvatar = avatarPreview || (!imageError ? formatAvatarUrl(user?.avatarUrl) : null);
  const [isLinking, setIsLinking] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [pendingLiquidations, setPendingLiquidations] = useState<PendingLiquidationOrg[]>([]);
  const [approvingLiquidationId, setApprovingLiquidationId] = useState<string | null>(null);

  // Auto-Wallet Security State
  const [showKeys, setShowKeys] = useState(false);
  const [autoWalletKeys, setAutoWalletKeys] = useState<AutoWalletKeys | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Security Verification Modal Gate
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isVerifyingSecurity, setIsVerifyingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [keyCountdown, setKeyCountdown] = useState<number | null>(null);

  // Organization Branding & Emblem Rebranding State
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null);

  // User Notification Preferences State
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({
    email: true,
    push: true,
    daoProposals: true,
    approvals: true,
    transactions: true,
    chatMentions: true,
    securityAlerts: true,
  });

  // Fetch notification preferences from server
  useEffect(() => {
    let isCancelled = false;
    const fetchPrefs = async () => {
      try {
        const res = await api.get<{ preferences?: Record<string, boolean> }>("/users/preferences");
        if (!isCancelled && res.data?.preferences) {
          setNotificationPrefs((prev) => ({ ...prev, ...res.data.preferences }));
        }
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      }
    };
    fetchPrefs();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch active org details
  useEffect(() => {
    let isCancelled = false;
    if (!activeOrgId) return;

    const fetchOrg = async () => {
      try {
        const res = await api.get<OrganizationDetails>(`/organizations/${activeOrgId}`);
        if (!isCancelled) {
          setOrgDetails(res.data);
        }
      } catch (err) {
        console.error("Failed to load organization details:", err);
      }
    };
    fetchOrg();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId]);

  const handleTogglePreference = async (key: string, currentValue: boolean) => {
    const updated = !currentValue;
    setNotificationPrefs((prev) => ({ ...prev, [key]: updated }));

    try {
      await api.put("/users/preferences", { [key]: updated });
      toast.success("Notification preference saved");
    } catch (err: unknown) {
      setNotificationPrefs((prev) => ({ ...prev, [key]: currentValue }));
      toast.error(getErrorMessage(err, "Failed to update preference"));
    }
  };

  // Auto-hide security countdown timer
  useEffect(() => {
    if (!showKeys || keyCountdown === null) return;

    if (keyCountdown <= 0) {
      const timer = setTimeout(() => {
        setShowKeys(false);
        setAutoWalletKeys(null);
        setKeyCountdown(null);
        toast.success("Keys auto-hidden for security.");
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setKeyCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setShowKeys(false);
          setAutoWalletKeys(null);
          toast.success("Keys auto-hidden for security.");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [showKeys, keyCountdown]);

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchBalance = async () => {
      if (!user?.walletAddress) return;
      try {
        const balance = await fetchAmoyBalance(user.walletAddress);
        const balanceInMatic = ethers.formatEther(balance);
        if (!isCancelled) {
          setWalletBalance(parseFloat(balanceInMatic).toFixed(4));
        }
      } catch (error) {
        console.warn("Failed to fetch balance:", error);
      }
    };

    const fetchLiquidations = async () => {
      if (!user?.isSuperAdmin) return;
      try {
        const res = await api.get<PendingLiquidationOrg[]>("/organizations");
        const orgList = res.data || [];
        const pending = orgList.filter((org) => org.liquidationStatus === "pending");
        if (!isCancelled) {
          setPendingLiquidations(pending);
        }
      } catch (err) {
        console.error("Failed to fetch liquidations:", err);
      }
    };
    
    fetchBalance();
    fetchLiquidations();

    const fetchPreferences = async () => {
      try {
        const res = await api.get<{ preferences: Record<string, boolean> }>("/users/preferences");
        if (res.data?.preferences && !isCancelled) {
          setNotificationPrefs(res.data.preferences);
        }
      } catch (err) {
        console.error("Failed to fetch notification preferences:", err);
      }
    };
    fetchPreferences();

    return () => {
      isCancelled = true;
    };
  }, [user?.walletAddress, user?.isSuperAdmin]);

  const memberships = (user?.memberships || []) as UserMembership[];
  const activeMembership = memberships.find((m) => {
    const orgId = typeof m.organization === "object" ? m.organization?._id : m.organization;
    return String(orgId) === String(activeOrgId);
  });
  const roleLabel = activeMembership?.roleLabel || "Member";
  const roleLevel = activeMembership?.roleLevel ?? (user?.isSuperAdmin ? 1 : 4);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image file must be under 5MB");
        return;
      }
      setAvatarFile(file);
      setImageError(false);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const minDim = Math.min(img.width, img.height);
            const startX = (img.width - minDim) / 2;
            const startY = (img.height - minDim) / 2;
            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
            setAvatarPreview(dataUrl);
          } else {
            setAvatarPreview(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      let avatarUrl = avatarPreview || user?.avatarUrl;

      if (avatarFile) {
        try {
          const formData = new FormData();
          formData.append("file", avatarFile);
          const uploadRes = await api.post<UploadResponse>("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          if (uploadRes.data?.documentUrl && !uploadRes.data.isLocal) {
            avatarUrl = uploadRes.data.documentUrl;
          }
        } catch {
        }
      }

      await api.put("/users/me", {
        displayName: currentDisplayName,
        avatarUrl
      });

      await refreshUser();
      setAvatarFile(null);
      setAvatarPreview("");
      setSuccessBanner("Your new profile picture and display name are now saved to the database and active across Web and Mobile.");
      
      toast.success("Profile updated successfully!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkWallet = async () => {
    try {
      setIsLinking(true);
      await linkWallet();
      await refreshUser();
      toast.success("Wallet cryptographically verified and linked!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to link wallet"));
    } finally {
      setIsLinking(false);
    }
  };

  const handleRevealKeys = () => {
    if (showKeys) {
      setShowKeys(false);
      setAutoWalletKeys(null);
      setKeyCountdown(null);
      return;
    }
    setSecurityError(null);
    setIsSecurityModalOpen(true);
  };

  const handleConfirmSecurity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setIsVerifyingSecurity(true);
    setSecurityError(null);
    try {
      // 1. Direct authenticated export (ideal for Asgardeo / Embedded Auto-wallets)
      try {
        const directRes = await api.post<AutoWalletKeys>("/auth/keys/export", {});
        if (directRes.data && (directRes.data.privateKey || directRes.data.mnemonic)) {
          setAutoWalletKeys(directRes.data);
          setShowKeys(true);
          setKeyCountdown(60);
          setIsSecurityModalOpen(false);
          toast.success("Security verified! Auto-hiding keys in 60s.");
          return;
        }
      } catch {
        // Continue to MetaMask signature challenge if direct export requires external signature
      }

      // 2. Fallback to MetaMask signature challenge
      const challengeRes = await api.post<{ challenge: string; walletAddress: string }>("/auth/keys/challenge");
      const { challenge, walletAddress } = challengeRes.data;

      const provider = getProvider();
      if (!provider) {
        throw new Error("MetaMask is required to sign the security verification challenge.");
      }

      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      if (userAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`Connected wallet (${userAddress.slice(0, 6)}...${userAddress.slice(-4)}) does not match your registered auto-wallet (${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}).`);
      }

      const signature = await signer.signMessage(challenge);

      const keysRes = await api.post<AutoWalletKeys>("/auth/keys/export", {
        challenge,
        signature,
      });

      setAutoWalletKeys(keysRes.data);
      setShowKeys(true);
      setKeyCountdown(60);
      setIsSecurityModalOpen(false);
      toast.success("Security verified! Auto-hiding keys in 60s.");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Security verification failed.");
      setSecurityError(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingSecurity(false);
    }
  };

  const handleApproveLiquidation = async (orgId: string) => {
    try {
      setApprovingLiquidationId(orgId);
      await api.post(`/organizations/${orgId}/approve-liquidation`);
      toast.success("Liquidation approved! Budget replenished.");
      setPendingLiquidations((prev) => prev.filter((o) => o._id !== orgId));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to approve liquidation"));
    } finally {
      setApprovingLiquidationId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 w-full space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight flex items-center gap-2.5">
          <UserIcon className="w-5 h-5 text-zinc-400" />
          Profile & Settings
        </h1>
        <p className="text-zinc-400 mt-1 text-xs">
          Manage your personal details, Web3 security keys, notification preferences, and organization branding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-5 border-b border-zinc-800 pb-3">
              Personal Information
            </h2>
            
            {successBanner && (
              <div className="mb-5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                      Profile Saved Successfully! <Sparkles className="w-3 h-3 text-emerald-400" />
                    </p>
                    <p className="text-[11px] text-emerald-400/80">
                      {successBanner}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSuccessBanner(null)}
                  className="p-1 rounded text-emerald-400/60 hover:text-emerald-300 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start mb-5">
              <div className="relative flex flex-col items-center">
                <div className="relative group mb-2.5">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                    {activeAvatar ? (
                      <Image
                        src={activeAvatar}
                        alt="Avatar"
                        width={80}
                        height={80}
                        unoptimized
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-850 text-zinc-300 font-semibold text-2xl">
                        {currentDisplayName ? currentDisplayName.trim().charAt(0).toUpperCase() : <UserIcon className="w-8 h-8 text-zinc-400" />}
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-white text-zinc-950 p-1.5 rounded-full cursor-pointer hover:bg-zinc-200 transition-colors shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} />
                  </label>
                </div>
                
                <div className="bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider font-medium px-2.5 py-0.5 rounded-full border border-zinc-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-zinc-400" />
                  {roleLabel}
                </div>
              </div>
              
              <div className="flex-1 w-full space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={currentDisplayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                    placeholder="Enter your display name"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Primary Wallet</label>
                    {user?.walletAddress && (
                      <a 
                        href={getExplorerAddressUrl(user.walletAddress)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Explorer
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled
                      value={user?.walletAddress || "No wallet linked"}
                      className="w-full px-3.5 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg text-zinc-400 font-mono text-xs"
                    />
                    {user?.walletAddress && (
                      <button
                        onClick={() => handleCopy(user.walletAddress!, "wallet")}
                        className="p-2 border border-zinc-800 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0"
                        title="Copy Address"
                      >
                        {copiedField === "wallet" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {walletBalance && (
                    <p className="text-[11px] text-zinc-500 mt-1.5 font-mono">
                      Balance: <span className="text-zinc-200 font-medium">{walletBalance} POL</span> (Polygon Amoy)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3.5 border-t border-zinc-800">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="btn-primary py-2 px-5 flex items-center gap-2 text-xs font-semibold rounded-lg"
              >
                {isSaving ? (
                  <span className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Profile
              </button>
            </div>
          </div>

          {user?.walletAddress && (
            <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Web3 Security & Auto-Wallet Keys</h2>
                    <p className="text-[11px] text-zinc-400">Non-custodial account credentials & recovery backup</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showKeys && keyCountdown !== null && (
                    <span className="text-[10px] font-mono font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      {keyCountdown}s
                    </span>
                  )}
                  <button
                    onClick={handleRevealKeys}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    {showKeys ? "Hide Keys" : "Export / View Keys"}
                  </button>
                </div>
              </div>

              {!showKeys ? (
                <div className="text-xs text-zinc-400 space-y-2">
                  <p>
                    Your wallet is cryptographically registered on Polygon Amoy. Credentials are non-custodial and protected with zero-knowledge server challenge signing.
                  </p>
                  <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center gap-2.5 text-zinc-400 text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Keys are protected. Click <strong>Export / View Keys</strong> to reveal with MetaMask verification.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Never share your private key or recovery phrase.</strong> Anyone with these credentials has full control over your funds and SBT credentials.
                    </div>
                  </div>

                  {autoWalletKeys?.privateKey && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Private Key</label>
                        <button
                          onClick={() => handleCopy(autoWalletKeys.privateKey!, "pk")}
                          className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-mono font-medium"
                        >
                          {copiedField === "pk" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedField === "pk" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-xs text-zinc-200 break-all select-all">
                        {autoWalletKeys.privateKey}
                      </div>
                    </div>
                  )}

                  {autoWalletKeys?.mnemonic && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">12-Word Recovery Phrase</label>
                        <button
                          onClick={() => handleCopy(autoWalletKeys.mnemonic!, "mnemonic")}
                          className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-mono font-medium"
                        >
                          {copiedField === "mnemonic" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedField === "mnemonic" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                        {autoWalletKeys.mnemonic.split(" ").map((word, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-zinc-850 px-2 py-1 rounded border border-zinc-800">
                            <span className="text-[10px] text-zinc-500 font-mono w-3.5">{idx + 1}.</span>
                            <span className="text-xs text-zinc-200 font-mono font-medium">{word}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-5">
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-zinc-400" />
              Connected Wallets
            </h2>
            <p className="text-xs text-zinc-400 mb-3.5">
              Link additional Web3 wallets for multi-device login and multi-sig approvals.
            </p>

            <div className="space-y-2 mb-3.5">
              {user?.linkedWallets && user.linkedWallets.length > 0 ? (
                user.linkedWallets.map((wallet, idx) => (
                  <div key={idx} className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-300">
                    <span className="truncate pr-2">{wallet}</span>
                    <button onClick={() => handleCopy(wallet, `linked_${idx}`)} className="text-zinc-500 hover:text-white shrink-0">
                      {copiedField === `linked_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 italic">No secondary wallets linked.</p>
              )}
            </div>

            <button
              onClick={handleLinkWallet}
              disabled={isLinking}
              className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              {isLinking ? (
                <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wallet className="w-3.5 h-3.5" />
              )}
              Link Secondary Wallet
            </button>
          </div>

          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-zinc-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Soulbound ID (SBT)</h3>
                <p className="text-[11px] text-zinc-400">Polygon Amoy Testnet</p>
              </div>
            </div>
            
            {activeMembership?.hasSBT ? (
              <div className="mt-3.5 p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                <div className="inline-flex p-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-white">Verified Member</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  Token ID: #{activeMembership.sbtTokenId || "1"}
                </p>
              </div>
            ) : (
              <div className="mt-3.5 text-center p-3.5 bg-zinc-900 rounded-lg border border-zinc-800">
                <p className="text-xs text-zinc-400 mb-3">
                  You don&apos;t have a Soulbound Token (SBT) yet.
                </p>
                {user?.walletAddress ? (
                  <button 
                    onClick={async () => {
                      try {
                        setIsMinting(true);
                        await api.post("/auth/mint-sbt");
                        await refreshUser();
                        toast.success("Soulbound ID Minted Successfully!");
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, "Failed to mint SBT"));
                      } finally {
                        setIsMinting(false);
                      }
                    }}
                    disabled={isMinting}
                    className="btn-primary w-full text-xs font-semibold py-2 px-3 rounded-lg flex justify-center items-center gap-2"
                  >
                    {isMinting ? (
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                    )}
                    Mint Member ID
                  </button>
                ) : (
                  <button 
                    onClick={handleLinkWallet}
                    disabled={isLinking}
                    className="btn-primary w-full text-xs font-semibold py-2 px-3 rounded-lg flex justify-center items-center gap-2"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Link Wallet to Mint
                  </button>
                )}
                <p className="text-[10px] text-zinc-500 mt-2">Gas fees paid by ChainBudget</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Notification Preferences (Full-Width Section) ── */}
      <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 w-full shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Bell className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
              <p className="text-[11px] text-zinc-400">Configure which notifications you receive on Web, Mobile, and Email.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {[
            { key: "push", label: "Mobile Push Notifications", desc: "Receive alerts on your iOS / Android devices" },
            { key: "email", label: "Email Notifications", desc: "Important transaction summaries and receipts" },
            { key: "approvals", label: "Approval Requests", desc: "Alerts when a transaction requires your review" },
            { key: "transactions", label: "Transaction Updates", desc: "Status changes, payouts, and confirmations" },
            { key: "daoProposals", label: "DAO Proposals & Voting", desc: "New governance ballots and voting deadlines" },
            { key: "chatMentions", label: "Chat Mentions", desc: "Notifications when tagged in organization channels" },
          ].map(({ key, label, desc }) => {
            const isEnabled = notificationPrefs[key] !== false;
            return (
              <div
                key={key}
                onClick={() => handleTogglePreference(key, isEnabled)}
                className={`p-3.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-3 select-none ${
                  isEnabled
                    ? "bg-zinc-900/80 border-zinc-700"
                    : "bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-900/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{label}</p>
                  <p className="text-[11px] text-zinc-400 line-clamp-1">{desc}</p>
                </div>
                <div
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                    isEnabled ? "bg-white" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      isEnabled ? "bg-zinc-950 translate-x-4" : "bg-zinc-400 translate-x-0"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Organization Branding & Emblem (Full-Width Section) ── */}
      {roleLevel <= 2 && orgDetails && (
        <EmblemRebrandSection
          orgId={activeOrgId}
          orgDetails={orgDetails}
          badgeLabel="Officer Tool"
          onSuccess={(newLogo) => {
            setOrgDetails((prev) => prev ? { ...prev, logoUrl: newLogo } : null);
          }}
        />
      )}

      {user?.isSuperAdmin && (
        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            Pending Financial Liquidations
          </h2>
          <p className="text-xs text-zinc-400 mb-4">Review and approve liquidations to trigger automated budget replenishment.</p>
          
          {pendingLiquidations.length === 0 ? (
            <div className="text-center py-5 text-xs text-zinc-500 bg-zinc-900 rounded-lg border border-zinc-800">
              No pending liquidations.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingLiquidations.map((org) => (
                <div key={org._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-zinc-900 rounded-lg border border-zinc-800 gap-3">
                  <div>
                    <h3 className="font-semibold text-white text-xs">{org.name}</h3>
                    <p className="text-[11px] text-zinc-400 font-mono">Requested Subsidy: ₱{(org.subsidyAmount || 50000).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleApproveLiquidation(org._id)}
                    disabled={approvingLiquidationId === org._id}
                    className="btn-primary py-1.5 px-3.5 text-xs whitespace-nowrap rounded-lg"
                  >
                    {approvingLiquidationId === org._id ? "Processing..." : "Approve & Replenish"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Security Verification Modal ── */}
      {isSecurityModalOpen && (
        <Portal>
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsSecurityModalOpen(false);
            }}
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
          >
            <div className="relative bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 md:p-6 animate-in zoom-in-95 duration-200 my-auto">
              <button
                onClick={() => setIsSecurityModalOpen(false)}
                className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    Security Verification
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Confirm identity to export Web3 credentials.
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Your recovery phrase and private key grant full authority over your on-chain assets. MetaMask will prompt you to cryptographically sign a single-use verification challenge.
              </p>

              <div className="p-3 mb-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero-Knowledge Security:</strong> This challenge requires ECDSA signature verification on the server before keys are decrypted.
                </span>
              </div>

              {securityError && (
                <p className="text-xs text-rose-400 font-medium mb-3 flex items-center gap-1.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {securityError}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSecurity()}
                  disabled={isVerifyingSecurity}
                  className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isVerifyingSecurity ? (
                    <>
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full" />
                      <span>Signing...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Sign & Export Keys</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
