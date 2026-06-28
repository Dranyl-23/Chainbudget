"use client";

import { useState, useEffect } from "react";
import { Search, ShieldCheck, ArrowLeft, ExternalLink, Calendar, Building, DollarSign, Activity } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface PublicTx {
  txHash: string;
  amount: number;
  description: string;
  category: string;
  status: string;
  organization: string;
  date: string;
}

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicTx | null>(null);
  
  const [overviewData, setOverviewData] = useState<{ stats: any, recent: PublicTx[] } | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await api.get("/transactions/public-overview");
        setOverviewData(res.data);
      } catch (error) {
        console.error("Failed to fetch overview", error);
      }
    };
    fetchOverview();
  }, []);

  const handleSearch = async (e?: React.FormEvent, directQuery?: string) => {
    if (e) e.preventDefault();
    const q = directQuery || query.trim();
    if (!q) return;

    setQuery(q);
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/transactions/public/${q}`);
      setResult(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error("Transaction not found on ChainBudget.");
      } else {
        toast.error("An error occurred while verifying the transaction.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0A0216] text-white">
      {/* ── Massive Holographic Fluid Background ── */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-fuchsia-600/30 blur-[150px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/20 blur-[130px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '14s' }} />
      <div className="absolute bottom-[-10%] left-[20%] w-[80vw] h-[80vw] rounded-full bg-blue-800/20 blur-[160px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>

      {/* ── Nav ── */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-purple-500/20 bg-[#160B2E]/40 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-md">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-7 h-7 object-contain rounded-lg" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            CHAIN<span className="text-fuchsia-400">BUDGET</span>
          </span>
        </Link>
        <Link href="/" className="text-sm font-medium text-white/60 hover:text-white flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="max-w-xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 text-fuchsia-400 mb-6 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight uppercase">Public Verification</h1>
            <p className="text-white/60 text-lg font-light leading-relaxed">
              Enter a ChainBudget receipt number or a Polygon blockchain hash to verify the authenticity of an organizational transaction.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative mb-12">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-400 w-5 h-5" />
            <input
              type="text"
              placeholder="e.g. 0xabc123... or CB-12345"
              className="w-full pl-12 pr-32 py-4 rounded-2xl border-2 border-purple-500/30 bg-[#160B2E]/60 backdrop-blur-md text-white placeholder-white/30 focus:border-fuchsia-500 focus:ring-0 outline-none transition-colors text-lg shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white px-6 py-2.5 rounded-xl font-bold hover:scale-105 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            >
              {loading ? "Searching..." : "Verify"}
            </button>
          </form>

          {overviewData && overviewData.recent.length > 0 && !result && (
            <div className="text-center mb-10">
              <button
                onClick={() => handleSearch(undefined, overviewData.recent[0].txHash)}
                className="text-sm font-medium text-fuchsia-400 hover:text-fuchsia-300 underline underline-offset-4 decoration-fuchsia-500/30 transition-colors"
              >
                Try it out: Click to verify a sample transaction
              </button>
            </div>
          )}

          {!result && overviewData && (
            <div className="animate-fade-in w-full max-w-3xl mx-auto space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] flex items-center md:flex-col md:text-center gap-4 md:gap-0">
                  <div className="w-12 h-12 md:mx-auto bg-green-500/20 border border-green-500/30 text-green-400 rounded-full flex items-center justify-center shrink-0 md:mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{overviewData.stats.totalVerified}</h3>
                    <p className="text-sm text-white/50 font-light uppercase tracking-wider">Verified Transactions</p>
                  </div>
                </div>
                <div className="bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] flex items-center md:flex-col md:text-center gap-4 md:gap-0">
                  <div className="w-12 h-12 md:mx-auto bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-full flex items-center justify-center shrink-0 md:mb-4">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">₱{overviewData.stats.totalFunds.toLocaleString()}</h3>
                    <p className="text-sm text-white/50 font-light uppercase tracking-wider">Secured on Blockchain</p>
                  </div>
                </div>
                <div className="bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] flex items-center md:flex-col md:text-center gap-4 md:gap-0">
                  <div className="w-12 h-12 md:mx-auto bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 rounded-full flex items-center justify-center shrink-0 md:mb-4">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{overviewData.stats.activeOrgs}</h3>
                    <p className="text-sm text-white/50 font-light uppercase tracking-wider">Active Organizations</p>
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              {overviewData.recent.length > 0 && (
                <div className="bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/20 rounded-3xl shadow-[0_0_30px_rgba(139,92,246,0.05)] overflow-hidden">
                  <div className="px-6 py-5 border-b border-purple-500/20 bg-[#160B2E]/80 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-fuchsia-400" />
                    <h3 className="font-bold text-white tracking-wide uppercase">Recent Public Transactions</h3>
                  </div>
                  <ul className="divide-y divide-purple-500/10">
                    {overviewData.recent.map((tx, idx) => (
                      <li key={idx} className="p-6 hover:bg-[#1a0e35]/80 transition-colors">
                        <div className="flex items-start sm:items-center justify-between gap-4">
                          <div className="flex-1 pr-2">
                            <p className="font-bold text-white text-lg leading-tight mb-2">{tx.description}</p>
                            <div className="flex items-center flex-wrap gap-3 text-sm text-white/50">
                              <span className="flex items-center gap-1.5"><Building className="w-4 h-4"/>{tx.organization}</span>
                              <span className="w-1 h-1 rounded-full bg-white/20"></span>
                              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4"/>{new Date(tx.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-5 text-right shrink-0">
                            <div>
                              <p className="font-bold text-white text-xl">₱{tx.amount.toLocaleString()}</p>
                              <span className="inline-block mt-1 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold bg-green-500/20 border border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                Verified
                              </span>
                            </div>
                            <button
                              onClick={() => handleSearch(undefined, tx.txHash)}
                              className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/40 flex items-center justify-center text-fuchsia-400 transition-colors shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                              title="View details"
                            >
                              <Search className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-[0_0_40px_rgba(139,92,246,0.1)] animate-fade-in w-full max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-purple-500/20">
                <div>
                  <p className="text-sm font-light text-white/50 uppercase tracking-wider mb-2">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border shadow-[0_0_20px_rgba(0,0,0,0.2)] ${
                    result.status === "Approved" ? "bg-green-500/20 border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]" :
                    result.status === "Pending" ? "bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]" :
                    "bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  }`}>
                    {result.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-light text-white/50 uppercase tracking-wider mb-1">Amount</p>
                  <p className="text-3xl font-extrabold text-white">₱{result.amount.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                <div>
                  <div className="flex items-center gap-2 text-fuchsia-400 mb-2">
                    <Building className="w-5 h-5" />
                    <span className="text-xs font-light uppercase tracking-widest text-white/50">Organization</span>
                  </div>
                  <p className="font-bold text-lg text-white">{result.organization}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-xs font-light uppercase tracking-widest text-white/50">Date Created</span>
                  </div>
                  <p className="font-bold text-lg text-white">{new Date(result.date).toLocaleString()}</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2 text-purple-400 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-xs font-light uppercase tracking-widest text-white/50">Description & Category</span>
                  </div>
                  <p className="font-bold text-xl text-white mb-1">{result.description}</p>
                  <p className="text-sm text-fuchsia-400 font-medium">{result.category}</p>
                </div>
              </div>

              {result.txHash && (
                <div className="bg-[#0A0216]/60 rounded-2xl p-6 border border-purple-500/20 shadow-inner">
                  <p className="text-xs font-light text-white/50 mb-3 uppercase tracking-widest">Blockchain Hash</p>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-sm text-white/70 truncate">{result.txHash}</p>
                    <a
                      href={`https://amoy.polygonscan.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2 text-sm font-bold uppercase tracking-wide shrink-0 transition-colors"
                    >
                      Explorer <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
