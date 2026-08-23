"use client";

import { useState, useEffect } from "react";
import { Search, ShieldCheck, ArrowLeft, ExternalLink, Calendar, Building, DollarSign, Activity } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { getExplorerTxUrl } from "@/lib/config";

interface PublicTx {
  txHash: string;
  amount: number;
  description: string;
  category: string;
  status: string;
  organization: string;
  date: string;
}

interface OverviewStats {
  totalVerified?: number;
  totalVolume?: number;
  activeOrganizations?: number;
  [key: string]: unknown;
}

interface OverviewData {
  stats: OverviewStats;
  recent: PublicTx[];
}

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicTx | null>(null);
  
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);

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
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
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
      <div className="absolute -top-1/4 -left-[10%] w-[70vw] h-[70vw] rounded-full bg-fuchsia-600/30 blur-[150px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[10%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/20 blur-[130px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '14s' }} />
      <div className="absolute -bottom-[10%] left-[20%] w-[80vw] h-[80vw] rounded-full bg-blue-800/20 blur-[160px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />


      {/* ── Nav ── */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-purple-500/20 bg-[#160B2E]/40 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <Image 
            src="/3D-Chainbudget.png" 
            alt="ChainBudget logo" 
            width={44} 
            height={44} 
            className="w-10 h-10 md:w-11 md:h-11 object-contain drop-shadow-md shrink-0" 
            priority
          />
          <span className="font-bold text-xl tracking-tight text-white">
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

          {loading && (
            <div className="glass rounded-3xl p-12 text-center border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.2)]">
              <div className="w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60 font-medium">Scanning Polygon Amoy and ChainBudget ledger...</p>
            </div>
          )}

          {result && (
            <div className="glass rounded-3xl p-8 md:p-10 border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.2)] relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-6 mb-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-fuchsia-400 block mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
                    <span className="font-bold text-lg text-white capitalize">{result.status || "Verified"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1">Amount</span>
                  <span className="font-black text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-500 drop-shadow-md">
                    ₱{result.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#160B2E]/60 rounded-2xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-fuchsia-400 mb-1">
                    <Building className="w-4 h-4" />
                    <span className="text-xs font-light uppercase tracking-widest text-white/50">Organization</span>
                  </div>
                  <p className="font-bold text-lg text-white truncate">{result.organization}</p>
                </div>

                <div className="bg-[#160B2E]/60 rounded-2xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-light uppercase tracking-widest text-white/50">Date</span>
                  </div>
                  <p className="font-bold text-lg text-white">
                    {result.date ? new Date(result.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A"}
                  </p>
                </div>

                <div className="bg-[#160B2E]/60 rounded-2xl p-4 border border-purple-500/20 md:col-span-2">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <Activity className="w-4 h-4" />
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
                      href={getExplorerTxUrl(result.txHash)}
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
