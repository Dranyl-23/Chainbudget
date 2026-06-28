"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Box, Save, Activity, ShieldAlert, Link as LinkIcon, RefreshCw, Layers } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { ethers } from "ethers";

export default function TreasuryPage() {
  const { user, activeOrgId } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<string>("0.0000");
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

  const [formData, setFormData] = useState({
    contractAddress: "",
    requiredApprovals: 2,
    highValueThreshold: 10000,
  });

  // Current user's role level in this org
  const roleLevel = user?.memberships?.find(
    (m: any) => (typeof m.organization === "string" ? m.organization : m.organization?._id) === activeOrgId
  )?.roleLevel || 4;

  const fetchOrgSettings = async () => {
    if (!activeOrgId) return;
    try {
      setLoading(true);
      const res = await api.get(`/organizations/${activeOrgId}`);
      setFormData({
        contractAddress: res.data.contractAddress || "",
        requiredApprovals: res.data.requiredApprovals || 2,
        highValueThreshold: res.data.highValueThreshold || 10000,
      });
      if (res.data.contractAddress) {
        fetchBalance(res.data.contractAddress);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load treasury settings.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (address: string) => {
    if (!address || !ethers.isAddress(address)) return;
    try {
      setIsFetchingBalance(true);
      // Connect to Polygon Amoy Public RPC
      const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
      const bal = await provider.getBalance(address);
      setBalance(ethers.formatEther(bal));
    } catch (err) {
      console.error("Error fetching balance:", err);
      toast.error("Failed to fetch on-chain balance");
      setBalance("Error");
    } finally {
      setIsFetchingBalance(false);
    }
  };

  useEffect(() => {
    fetchOrgSettings();
  }, [activeOrgId]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        fetchBalance(formData.contractAddress);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update settings.");
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
        <p className="text-sm text-white/50">Manage your organization's on-chain treasury and multi-sig governance rules.</p>
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
                    The Polygon address of your DAO's multi-sig or treasury contract.
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
                    className={`p-1.5 rounded-md hover:bg-white/10 text-cyan-300 transition-all ${isFetchingBalance ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Refresh Balance"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingBalance ? 'animate-spin' : ''}`} />
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
    </div>
  );
}
