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
    fetchBalance();
  }, [user?.walletAddress]);

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
          <div className="glass p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5">
            <h3 className="font-bold text-gray-800 mb-2">Web3 Identity</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your profile picture will be uploaded to the InterPlanetary File System (IPFS) ensuring it remains decentralized and immutable.
            </p>
            <div className="flex items-center gap-2 text-xs text-primary font-semibold bg-primary/10 w-fit px-3 py-1 rounded-full">
              IPFS Powered
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
