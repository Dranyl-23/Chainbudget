"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Activity, Link as LinkIcon, AlertTriangle, ArrowUpRight, ArrowDownRight, ArrowRight, ExternalLink, Lock } from "lucide-react";
import api from "@/lib/api";
import { ethers } from "ethers";

interface Organization {
  _id: string;
  name: string;
  type: string;
  description: string;
  logoUrl: string;
  contractAddress: string;
  transparencyScore: number;
  isPrivate?: boolean;
}

interface Transaction {
  _id: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  category: string;
  createdAt: string;
  blockchainTxHash: string;
}

interface Budget {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
}

export default function PublicDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [balance, setBalance] = useState<string>("0.0000");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;

    const fetchDashboard = async () => {
      try {
        const orgRes = await api.get(`/public/organizations/${orgId}`);
        const orgData = orgRes.data;
        setOrg(orgData);

        // Fetch live balance if contract address exists
        if (orgData.contractAddress) {
          try {
            const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
            const balanceWei = await provider.getBalance(orgData.contractAddress);
            const balancePol = ethers.formatEther(balanceWei);
            setBalance(parseFloat(balancePol).toFixed(4));
          } catch (ethErr) {
            console.error("Failed to fetch balance", ethErr);
          }
        }

        if (!orgData.isPrivate) {
          const [txsRes, budgetRes] = await Promise.all([
            api.get(`/public/organizations/${orgId}/transactions`),
            api.get(`/public/organizations/${orgId}/budget`)
          ]);
          setTransactions(txsRes.data);
          setBudgets(budgetRes.data);
        } else {
          setTransactions([]);
          setBudgets([]);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load organization data. It may be inactive or private.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [orgId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-6 text-white">
        <AlertTriangle className="w-16 h-16 text-fuchsia-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Organization Not Found</h1>
        <p className="text-white/50 mb-8">{error}</p>
        <Link href="/explorer" className="btn-primary py-3 px-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Explorer
        </Link>
      </div>
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace("/api", "") 
    : "http://localhost:5000";

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400 border-green-400/50 shadow-[0_0_15px_rgba(74,222,128,0.2)]";
    if (score >= 70) return "text-cyan-400 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]";
    if (score >= 50) return "text-yellow-400 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.2)]";
    return "text-red-400 border-red-400/50 shadow-[0_0_15px_rgba(248,113,113,0.2)]";
  };

  const totalAllocated = budgets.reduce((acc, b) => acc + b.allocated, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalBudgetPercentage = totalAllocated > 0 ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100)) : 0;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* ── Top Nav ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <Link href="/explorer" className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white/70 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold tracking-tight hidden sm:inline">Back to Explorer</span>
        </Link>
        <div className="flex items-center gap-3">
          <img 
            src={org.logoUrl ? (org.logoUrl.startsWith('http') ? org.logoUrl : `${backendUrl}${org.logoUrl}`) : "/images/logo.png"} 
            alt={org.name} 
            className="w-8 h-8 rounded-lg object-contain bg-white/5" 
          />
          <span className="font-bold tracking-tight text-white">{org.name}</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* ── Header Profile ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white/5 border border-white/10 p-2 shrink-0">
              <img 
                src={org.logoUrl ? (org.logoUrl.startsWith('http') ? org.logoUrl : `${backendUrl}${org.logoUrl}`) : "/images/logo.png"} 
                alt={org.name || "Organization"} 
                className="w-full h-full object-contain rounded-xl" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/50 uppercase tracking-widest border border-white/10">
                  {org.type ? org.type.replace('_', ' ') : 'ORG'}
                </span>
                {org.contractAddress && (
                  <a href={`https://amoy.polygonscan.com/address/${org.contractAddress}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-purple-500/10 text-[10px] font-bold text-purple-400 uppercase tracking-widest border border-purple-500/20 flex items-center gap-1 hover:bg-purple-500/20 transition-colors">
                    <LinkIcon className="w-3 h-3" /> Contract Linked
                  </a>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-md mb-2">{org.name || "Unknown Organization"}</h1>
              <p className="text-white/60 max-w-2xl">{org.description || "Public organization ledger."}</p>
            </div>
          </div>

          <div className={`p-6 rounded-2xl glass border ${getScoreColor(org.transparencyScore || 0)} flex flex-col items-center justify-center min-w-[200px]`}>
            <span className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-70">Transparency Score</span>
            <div className="text-5xl font-black tracking-tighter drop-shadow-lg">{org.transparencyScore || 0}%</div>
          </div>
        </div>

        {org.isPrivate ? (
          <div className="glass rounded-2xl p-12 lg:p-20 text-center border border-white/5 flex flex-col items-center justify-center mt-8">
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
              <Lock className="w-10 h-10 text-white/30" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Private Organization</h2>
            <p className="text-white/50 max-w-md mx-auto text-lg leading-relaxed">
              This organization has restricted public access. Only authorized members can view the treasury balance, budget utilization, and transaction ledger.
            </p>
            <Link href="/dashboard" className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors border border-white/10">
              Go to Member Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* ── Overview Stats ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Live Balance */}
              <div className="glass rounded-2xl p-6 lg:p-8 flex flex-col border border-white/5 relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-500" />
                <div className="flex items-center gap-2 mb-6 relative z-10">
                  <Activity className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">Public Treasury Balance</h3>
                </div>
                <div className="flex-1 flex flex-col justify-center relative z-10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-500 drop-shadow-lg">
                      {balance || "0.0000"}
                    </span>
                    <span className="text-xl font-bold text-cyan-500/50">POL</span>
                  </div>
                  {org.contractAddress ? (
                    <p className="text-xs text-white/30 mt-4 flex items-center gap-1 font-mono">
                      {org.contractAddress.slice(0, 8)}...{org.contractAddress.slice(-6)}
                      <a href={`https://amoy.polygonscan.com/address/${org.contractAddress}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-fuchsia-400 hover:text-fuchsia-300 underline">View on Explorer</a>
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-500/70 mt-4">No Smart Contract Linked</p>
                  )}
                </div>
              </div>

              {/* Budget Overview */}
              <div className="lg:col-span-2 glass rounded-2xl p-6 lg:p-8 border border-white/5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">Public Budget Utilization</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Total Allocated</p>
                    <p className="text-lg font-bold text-white">₱{(totalAllocated || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-white/70">Total Spend</span>
                    <span className="text-fuchsia-400">{totalBudgetPercentage || 0}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/10">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-full rounded-full relative"
                      style={{ width: `${totalBudgetPercentage || 0}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
                    </div>
                  </div>
                </div>

                {/* Top Categories */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(budgets || []).slice(0, 4).map((b) => (
                    <div key={b._id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-xs text-white/50 font-bold uppercase truncate mb-1" title={b.name || "Budget"}>{b.name || "Budget"}</p>
                      <p className="text-sm font-bold text-white">₱{(b.spent || 0).toLocaleString()}</p>
                    </div>
                  ))}
                  {(!budgets || budgets.length === 0) && (
                    <div className="col-span-full text-center text-sm text-white/30 py-4">No public budget data available.</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Public Ledger ── */}
            <div className="glass rounded-2xl p-6 lg:p-8 border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Verified Public Ledger</h2>
                  <p className="text-sm text-white/50">Only transactions recorded and verified on the blockchain are shown here.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-white/40">
                      <th className="pb-4 font-bold pl-2">Date</th>
                      <th className="pb-4 font-bold">Description</th>
                      <th className="pb-4 font-bold">Category</th>
                      <th className="pb-4 font-bold text-right">Amount</th>
                      <th className="pb-4 font-bold text-center pr-2">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {(!transactions || transactions.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-white/30">
                          No verified on-chain transactions yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx._id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                          <td className="py-4 pl-2 text-white/60 whitespace-nowrap">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "Unknown"}
                          </td>
                          <td className="py-4 text-white font-medium">
                            {tx.description || "No description"}
                          </td>
                          <td className="py-4">
                            <span className="px-2 py-1 rounded bg-white/5 text-[10px] uppercase tracking-widest text-white/50 border border-white/10">
                              {tx.category || "Uncategorized"}
                            </span>
                          </td>
                          <td className={`py-4 text-right font-bold whitespace-nowrap ${tx.type === "income" ? "text-green-400" : "text-white"}`}>
                            {tx.type === "income" ? "+" : "-"}₱{(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-center pr-2">
                            {tx.blockchainTxHash ? (
                              <a 
                                href={`https://amoy.polygonscan.com/tx/${tx.blockchainTxHash}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
                                title="Verify on Polygonscan"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-white/20">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </main>
  );
}
