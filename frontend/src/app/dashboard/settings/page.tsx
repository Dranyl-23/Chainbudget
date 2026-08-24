"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { ethers } from "ethers";
import { getAmoyProvider } from "@/lib/rpcProvider";
import api from "@/lib/api";
import { getExplorerAddressUrl } from "@/lib/config";
import { getProvider } from "@/lib/wallet";
import { getErrorMessage } from "@/lib/utils";
import toast from "react-hot-toast";
import { 
  Save, Wallet, Upload, User as UserIcon, ShieldCheck, 
  ExternalLink, Copy, Check, CheckCircle2, 
  Sparkles, X, Lock, Key, Clock, ShieldAlert,
  Bell, Building, Camera
} from "lucide-react";

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

function formatOrgLogo(url?: string) {
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
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
  const [isUploadingOrgLogo, setIsUploadingOrgLogo] = useState(false);
  const [showEmblemSuccessModal, setShowEmblemSuccessModal] = useState(false);
  const [uploadedEmblemUrl, setUploadedEmblemUrl] = useState<string | null>(null);

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

  // Fetch active org details
  useEffect(() => {
    let isCancelled = false;
    if (!activeOrgId) return;

    const fetchOrg = async () => {
      try {
        const res = await api.get<OrganizationDetails>(`/organizations/${activeOrgId}`);
        if (!isCancelled) {
          setOrgDetails(res.data);
          if (res.data?.logoUrl) {
            setOrgLogoPreview(formatOrgLogo(res.data.logoUrl));
          }
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
      toast.error("Please choose a new emblem image.");
      return;
    }

    try {
      setIsUploadingOrgLogo(true);
      let newLogoUrl = orgLogoPreview;

      if (orgLogoFile) {
        const formData = new FormData();
        formData.append("file", orgLogoFile);
        const uploadRes = await api.post<UploadResponse>("/upload", formData, {
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
      toast.error(getErrorMessage(err, "Failed to update organization emblem"));
    } finally {
      setIsUploadingOrgLogo(false);
    }
  };

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
        toast("Keys auto-hidden for security.", { icon: "🔒" });
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setKeyCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setShowKeys(false);
          setAutoWalletKeys(null);
          toast("Keys auto-hidden for security.", { icon: "🔒" });
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
        const provider = getAmoyProvider();
        const balance = await provider.getBalance(user.walletAddress);
        const balanceInMatic = ethers.formatEther(balance);
        if (!isCancelled) {
          setWalletBalance(parseFloat(balanceInMatic).toFixed(4));
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
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

      const updateRes = await api.put("/users/me", {
        displayName: currentDisplayName,
        avatarUrl
      });

      const updatedUser = updateRes.data?.user || updateRes.data;
      if (updatedUser && typeof window !== "undefined") {
        localStorage.setItem("cb_user", JSON.stringify(updatedUser));
      }
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
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not installed");
      }
      
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts selected");
      }

      const newWallet = accounts[0];
      
      if (user?.walletAddress && newWallet.toLowerCase() === user.walletAddress.toLowerCase()) {
        toast.error("This is your primary wallet.");
        return;
      }

      await api.put("/users/me", {
        linkedWallets: [newWallet]
      });

      await refreshUser();
      toast.success("Wallet linked successfully!");
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
      await api.post(`/organizations/${orgId}/liquidate/approve`);
      toast.success("Liquidation approved! Budget replenished.");
      setPendingLiquidations((prev) => prev.filter((o) => o._id !== orgId));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to approve liquidation"));
    } finally {
      setApprovingLiquidationId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-24 w-full space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
          <UserIcon className="w-8 h-8 text-primary" />
          Profile & Settings
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage your personal details, Web3 security keys, notification preferences, and organization branding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Personal Information</h2>
            
            {successBanner && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md flex items-center justify-between gap-3 animate-fade-in shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      Profile Saved Successfully! <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    </p>
                    <p className="text-xs text-emerald-400/80">
                      {successBanner}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSuccessBanner(null)}
                  className="p-1.5 rounded-lg text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start mb-6">
              <div className="relative flex flex-col items-center">
                <div className="relative group mb-3">
                  <div className="w-24 h-24 rounded-full bg-purple-500/10 border-4 border-purple-500/30 shadow-lg overflow-hidden flex items-center justify-center shrink-0">
                    {activeAvatar ? (
                      <Image
                        src={activeAvatar}
                        alt="Avatar"
                        width={96}
                        height={96}
                        unoptimized
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-500/20 text-purple-300 font-bold text-3xl">
                        {currentDisplayName ? currentDisplayName.trim().charAt(0).toUpperCase() : <UserIcon className="w-10 h-10 text-purple-400" />}
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-primary-hover transition-colors">
                    <Upload className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} />
                  </label>
                </div>
                
                <div className="bg-indigo-50 text-indigo-700 text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3 h-3" />
                  {roleLabel}
                </div>
              </div>
              
              <div className="flex-1 w-full space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={currentDisplayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:text-white"
                    placeholder="Enter your display name"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-gray-700">Primary Wallet</label>
                    {user?.walletAddress && (
                      <a 
                        href={getExplorerAddressUrl(user.walletAddress)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary-hover font-medium bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> View on Explorer
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled
                      value={user?.walletAddress || "No wallet linked"}
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 font-mono text-xs"
                    />
                    {user?.walletAddress && (
                      <button
                        onClick={() => handleCopy(user.walletAddress!, "wallet")}
                        className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition-colors shrink-0"
                        title="Copy Address"
                      >
                        {copiedField === "wallet" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {walletBalance && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      Balance: <span className="text-primary font-bold">{walletBalance} POL</span> (Polygon Amoy)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="btn-primary py-2 px-6 flex items-center gap-2"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Profile
              </button>
            </div>
          </div>

          {user?.walletAddress && (
            <div className="glass p-6 rounded-2xl border border-orange-500/20 bg-linear-to-br from-orange-500/5 via-transparent to-transparent">
              <div className="flex items-center justify-between mb-4 border-b border-orange-500/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800 dark:text-white">Web3 Security & Auto-Wallet Keys</h2>
                    <p className="text-xs text-gray-500">Non-custodial account credentials & recovery backup</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showKeys && keyCountdown !== null && (
                    <span className="text-[11px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      {keyCountdown}s
                    </span>
                  )}
                  <button
                    onClick={handleRevealKeys}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                      showKeys
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        : "bg-orange-600/20 hover:bg-orange-600/30 border-orange-500/40 text-orange-300 shadow-sm"
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    {showKeys ? "Hide Keys" : "Export / View Keys"}
                  </button>
                </div>
              </div>

              {!showKeys ? (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                  <p>
                    Your wallet is cryptographically registered on Polygon Amoy. Your credentials are fully non-custodial and protected with zero-knowledge server challenge signing.
                  </p>
                  <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center gap-2 text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Keys are hidden. Click <strong>Export / View Keys</strong> to reveal with MetaMask verification.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Never share your private key or recovery phrase.</strong> Anyone with these credentials has full control over your funds and SBT credentials.
                    </div>
                  </div>

                  {autoWalletKeys?.privateKey && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Private Key</label>
                        <button
                          onClick={() => handleCopy(autoWalletKeys.privateKey!, "pk")}
                          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-mono font-semibold"
                        >
                          {copiedField === "pk" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedField === "pk" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-orange-300 break-all select-all">
                        {autoWalletKeys.privateKey}
                      </div>
                    </div>
                  )}

                  {autoWalletKeys?.mnemonic && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">12-Word Recovery Phrase</label>
                        <button
                          onClick={() => handleCopy(autoWalletKeys.mnemonic!, "mnemonic")}
                          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-mono font-semibold"
                        >
                          {copiedField === "mnemonic" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedField === "mnemonic" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                        {autoWalletKeys.mnemonic.split(" ").map((word, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-md border border-slate-800">
                            <span className="text-[10px] text-slate-500 font-mono w-4">{idx + 1}.</span>
                            <span className="text-xs text-emerald-300 font-mono font-bold">{word}</span>
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
        
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Connected Wallets
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Link additional Web3 wallets for multi-device login and multi-sig approvals.
            </p>

            <div className="space-y-2 mb-4">
              {user?.linkedWallets && user.linkedWallets.length > 0 ? (
                user.linkedWallets.map((wallet, idx) => (
                  <div key={idx} className="p-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs font-mono">
                    <span className="truncate pr-2">{wallet}</span>
                    <button onClick={() => handleCopy(wallet, `linked_${idx}`)} className="text-gray-400 hover:text-primary shrink-0">
                      {copiedField === `linked_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 italic">No secondary wallets linked.</p>
              )}
            </div>

            <button
              onClick={handleLinkWallet}
              disabled={isLinking}
              className="btn-secondary w-full text-xs py-2 px-3 flex items-center justify-center gap-1.5"
            >
              {isLinking ? (
                <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wallet className="w-3.5 h-3.5" />
              )}
              Link Secondary Wallet
            </button>
          </div>

          <div className="glass p-6 rounded-2xl border border-primary/20 bg-linear-to-b from-primary/5 to-transparent">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Soulbound ID (SBT)</h3>
                <p className="text-[11px] text-gray-500">Polygon Amoy Testnet</p>
              </div>
            </div>
            
            {activeMembership?.hasSBT ? (
              <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                <div className="inline-flex p-2 rounded-full bg-purple-500/20 text-purple-300 mb-2">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-purple-300">Verified Member</p>
                <p className="text-[10px] text-purple-400 font-mono mt-0.5">
                  Token ID: #{activeMembership.sbtTokenId || "1"}
                </p>
              </div>
            ) : (
              <div className="mt-4 text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  You don&apos;t have a Soulbound Token (SBT) yet.
                </p>
                {user?.walletAddress ? (
                  <button 
                    onClick={async () => {
                      try {
                        setIsLinking(true);
                        await api.post("/auth/mint-sbt");
                        await refreshUser();
                        toast.success("Soulbound ID Minted Successfully!");
                      } catch (err: unknown) {
                        toast.error(getErrorMessage(err, "Failed to mint SBT"));
                      } finally {
                        setIsLinking(false);
                      }
                    }}
                    disabled={isLinking}
                    className="btn-primary w-full text-sm font-semibold py-3 px-4 rounded-xl flex justify-center items-center gap-2 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg whitespace-nowrap transition-all hover:scale-[1.02]"
                  >
                    {isLinking ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                    )}
                    Mint Member ID
                  </button>
                ) : (
                  <button 
                    onClick={handleLinkWallet}
                    disabled={isLinking}
                    className="btn-primary w-full text-sm py-2 px-4 rounded-lg flex justify-center items-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    Link Wallet to Mint
                  </button>
                )}
                <p className="text-[10px] text-gray-400 mt-2">Gas fees paid by ChainBudget</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Notification Preferences (Full-Width Section) ── */}
      <div className="glass p-6 rounded-2xl border border-primary/20 w-full shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Notification Preferences</h2>
              <p className="text-xs text-gray-500">Configure which notifications you receive on Web, Mobile, and Email.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
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
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                  isEnabled
                    ? "bg-purple-500/10 border-purple-500/30 shadow-sm"
                    : "bg-white/5 border-white/10 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{desc}</p>
                </div>
                <div
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                    isEnabled ? "bg-purple-600" : "bg-gray-400 dark:bg-gray-600"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
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
        <div className="glass p-6 rounded-2xl border border-purple-500/20 w-full shadow-[0_0_30px_rgba(168,85,247,0.08)] relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-purple-500/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Building className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Organization Branding & Emblem</h2>
                <p className="text-xs text-gray-500">Rebrand or update your custom organization logo across Web, Mobile & Public Ledger.</p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
              Officer Tool
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-dashed border-purple-500/40 p-1.5 flex items-center justify-center overflow-hidden shadow-inner">
                {orgLogoPreview ? (
                  <Image 
                    src={orgLogoPreview} 
                    alt="Org Emblem" 
                    width={96}
                    height={96}
                    unoptimized
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-purple-400">
                    <Building className="w-8 h-8 opacity-60 mb-1" />
                    <span className="text-[10px] text-white/40 font-bold">No Emblem</span>
                  </div>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-lg transition-all hover:scale-105 border border-purple-400/50">
                <Camera className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleOrgLogoFileChange}
                  className="hidden" 
                />
              </label>
            </div>

            <div className="flex-1 w-full space-y-3 text-center sm:text-left">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                  {orgDetails.name}
                  <span className="text-[11px] font-normal text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                    {orgDetails.type ? orgDetails.type.replace('_', ' ') : 'DAO'}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Upload a high-resolution square image (PNG, JPG, WebP) to establish your organization&apos;s Web3 emblem and on-chain identity.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="btn-secondary py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Choose New File
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
                  className="btn-primary py-2 px-5 text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] disabled:opacity-50"
                >
                  {isUploadingOrgLogo ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Publishing to IPFS...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save & Publish Rebrand</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.isSuperAdmin && (
        <div className="mt-8 glass p-6 rounded-2xl border border-primary/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Pending Financial Liquidations
          </h2>
          <p className="text-sm text-gray-500 mb-4">Review and approve liquidations to trigger automated budget replenishment.</p>
          
          {pendingLiquidations.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              No pending liquidations.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLiquidations.map((org) => (
                <div key={org._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm gap-4">
                  <div>
                    <h3 className="font-bold text-gray-800">{org.name}</h3>
                    <p className="text-xs text-gray-500">Requested Subsidy: ₱{(org.subsidyAmount || 50000).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleApproveLiquidation(org._id)}
                    disabled={approvingLiquidationId === org._id}
                    className="btn-primary py-2 px-4 whitespace-nowrap"
                  >
                    {approvingLiquidationId === org._id ? "Processing..." : "Approve & Replenish Budget"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEmblemSuccessModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative bg-[#13121d] border border-purple-500/40 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] w-full max-w-sm p-6 text-center animate-modal-pop">
            
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
                <Check className="w-4 h-4" />
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

      {/* ── Security Verification Modal ── */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSecurityModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Security Verification
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm identity to export Web3 credentials.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Your recovery phrase and private key grant full authority over your on-chain assets. To export your keys, MetaMask will prompt you to cryptographically sign a single-use verification challenge issued by the server.
            </p>

            <div className="p-3.5 mb-5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Knowledge Security:</strong> This challenge requires ECDSA signature verification on the server before keys are decrypted.
              </span>
            </div>

            {securityError && (
              <p className="text-xs text-rose-400 font-semibold mb-4 flex items-center gap-1.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {securityError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSecurity()}
                disabled={isVerifyingSecurity}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 transition-all"
              >
                {isVerifyingSecurity ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Signing...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Sign & Export Keys</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
