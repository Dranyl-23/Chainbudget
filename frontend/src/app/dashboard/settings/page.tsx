"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ethers } from "ethers";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Save, Wallet, Upload, User as UserIcon, ShieldCheck, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { user, refreshUser, activeOrgId } = useAuth();
  
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatarUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [pendingLiquidations, setPendingLiquidations] = useState<any[]>([]);
  const [approvingLiquidationId, setApprovingLiquidationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.walletAddress) return;
      try {
        const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
        const balance = await provider.getBalance(user.walletAddress);
        const balanceInMatic = ethers.formatEther(balance);
        setWalletBalance(parseFloat(balanceInMatic).toFixed(4));
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };

    const fetchLiquidations = async () => {
      if (!user?.isSuperAdmin) return;
      try {
        const res = await api.get("/organizations");
        const pending = res.data.filter((org: any) => org.liquidationStatus === "pending");
        setPendingLiquidations(pending);
      } catch (err) {
        console.error("Failed to fetch liquidations:", err);
      }
    };
    
    fetchBalance();
    fetchLiquidations();
  }, [user?.walletAddress, user?.isSuperAdmin]);

  // Get active role
  const activeMembership = user?.memberships?.find((m: any) => {
    const orgId = typeof m.organization === "object" ? m.organization?._id : m.organization;
    return String(orgId) === String(activeOrgId);
  });
  const roleLabel = activeMembership?.roleLabel || "Member";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      let avatarUrl = user?.avatarUrl;

      // 1. Upload new avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        
        const uploadRes = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        
        avatarUrl = uploadRes.data.documentUrl;
      }

      // 2. Update user profile
      await api.put("/users/me", {
        displayName,
        avatarUrl
      });

      // 3. Refresh context
      await refreshUser();
      
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkWallet = async () => {
    try {
      setIsLinking(true);
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("MetaMask not installed");
      }
      
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts selected");
      }

      const newWallet = accounts[0];
      
      if (newWallet.toLowerCase() === user?.walletAddress.toLowerCase()) {
        toast.error("This is your primary wallet.");
        return;
      }

      await api.put("/users/me", {
        linkedWallets: [newWallet]
      });

      await refreshUser();
      toast.success("Wallet linked successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to link wallet");
    } finally {
      setIsLinking(false);
    }
  };

  const handleApproveLiquidation = async (orgId: string) => {
    try {
      setApprovingLiquidationId(orgId);
      await api.post(`/organizations/${orgId}/approve-liquidation`);
      toast.success("Liquidation approved and budget replenished!");
      setPendingLiquidations(prev => prev.filter(org => org._id !== orgId));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to approve liquidation");
    } finally {
      setApprovingLiquidationId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
          <UserIcon className="w-8 h-8 text-primary" />
          Profile & Settings
        </h1>
        <p className="text-gray-500 mt-2">
          Manage your personal details and linked wallets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Personal Information</h2>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start mb-6">
              <div className="relative flex flex-col items-center">
                <div className="relative group mb-3">
                  <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-primary-hover transition-colors">
                    <Upload className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} />
                  </label>
                </div>
                
                {/* Role Badge */}
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
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Enter your display name"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-gray-700">Primary Wallet</label>
                    {user?.walletAddress && (
                      <a 
                        href={`https://amoy.polygonscan.com/address/${user.walletAddress}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary-hover font-medium bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> View on Explorer
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={user?.walletAddress || ""}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm cursor-not-allowed mb-4"
                  />
                  
                  {/* Live Wallet Balance */}
                  {user?.walletAddress && (
                    <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Testnet Balance</p>
                          <p className="text-sm font-bold text-gray-800">
                            {walletBalance !== null ? `${walletBalance} POL` : "Fetching..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="btn-primary w-full md:w-auto flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                {isSaving ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Profile
              </button>
            </div>
          </div>

          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Linked Wallets</span>
              <button 
                onClick={handleLinkWallet}
                disabled={isLinking}
                className="btn-outline flex items-center gap-2 text-sm py-1.5 px-3"
              >
                {isLinking ? (
                  <span className="animate-spin w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />
                ) : (
                  <Wallet className="w-3 h-3" />
                )}
                Link New Wallet
              </button>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Link additional wallets to use them interchangeably. Ensure you switch your MetaMask to the desired account before linking.
            </p>
            
            <div className="space-y-3">
              {user?.linkedWallets && user.linkedWallets.length > 0 ? (
                user.linkedWallets.map((w) => (
                  <div key={w} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-gray-700">{w}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Secondary</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  No additional wallets linked.
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Info Card */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20 relative overflow-hidden">
            {/* Background design */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Digital Member ID
            </h3>
            
            {activeMembership?.hasSBT ? (
              <div className="mt-4 animate-fade-in">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-1 rounded-xl shadow-lg">
                  <div className="bg-gray-900 rounded-lg p-4 text-white relative overflow-hidden">
                    <div className="absolute opacity-10 right-[-20px] top-[-20px]">
                      <ShieldCheck className="w-32 h-32" />
                    </div>
                    <p className="text-xs text-indigo-300 font-mono tracking-widest uppercase mb-1">ChainBudget</p>
                    <p className="font-bold text-lg mb-4 leading-tight">Verified Member</p>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Soulbound ID</p>
                        <p className="font-mono font-medium text-sm text-indigo-200">
                          #{activeMembership.sbtTokenId?.substring(0, 8) || "0001"}...
                        </p>
                      </div>
                      <div className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded border border-green-500/30 uppercase tracking-wider">
                        Active
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center flex items-center justify-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Polygon Amoy Testnet
                </p>
              </div>
            ) : (
              <div className="mt-4 text-center p-4 bg-white/50 rounded-xl border border-dashed border-gray-300">
                <p className="text-sm text-gray-600 mb-3">
                  You don't have a Soulbound Token (SBT) yet.
                </p>
                {user?.walletAddress ? (
                  <button 
                    onClick={async () => {
                      try {
                        setIsLinking(true);
                        await api.post("/auth/mint-sbt");
                        await refreshUser();
                        toast.success("Soulbound ID Minted Successfully!");
                      } catch (err: any) {
                        toast.error(err.response?.data?.error || "Failed to mint SBT");
                      } finally {
                        setIsLinking(false);
                      }
                    }}
                    disabled={isLinking}
                    className="btn-primary w-full text-sm font-semibold py-3 px-4 rounded-xl flex justify-center items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg whitespace-nowrap transition-all hover:scale-[1.02]"
                  >
                    {isLinking ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 flex-shrink-0" />
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

      {/* SuperAdmin: Pending Liquidations */}
      {user?.isSuperAdmin && (
        <div className="mt-8 glass p-6 rounded-2xl border border-primary/20">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Pending Financial Liquidations
          </h2>
          <p className="text-sm text-gray-500 mb-4">Review and approve liquidations to trigger automated budget replenishment.</p>
          
          {pendingLiquidations.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              No pending liquidations.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLiquidations.map(org => (
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
    </div>
  );
}
