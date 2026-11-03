"use client";

import { useState, useEffect } from "react";
import { Search, ShieldCheck, ArrowLeft, ExternalLink, Calendar, Building, Activity } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
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
  const { isConnected } = useAuth();
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
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#09090b] text-white">
      {/* ── Nav ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-8 py-4 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <Image 
            src="/3D-Chainbudget.png" 
            alt="ChainBudget logo" 
            width={36} 
            height={36} 
            className="w-8 h-8 md:w-9 md:h-9 object-contain shrink-0" 
            priority
          />
          <span className="font-semibold text-base tracking-tight text-white">
            ChainBudget
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/explorer" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
            Public Explorer
          </Link>
          <Link 
            href={isConnected ? "/dashboard" : "/"} 
            className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 
            <span>{isConnected ? "Back to Dashboard" : "Back to Home"}</span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 mb-4 shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2 tracking-tight">Public Verification</h1>
            <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-md mx-auto">
              Enter a ChainBudget receipt number or Polygon blockchain hash to verify the authenticity of an organizational transaction.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative mb-8">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input
              type="text"
              placeholder="e.g. 0xabc123... or CB-12345"
              className="w-full pl-10 pr-24 py-3 rounded-lg border border-zinc-800 bg-[#121215] text-white placeholder-zinc-500 focus:border-zinc-500 outline-none transition-colors text-sm shadow-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white hover:bg-zinc-200 text-zinc-950 px-4 py-1.5 rounded-md font-semibold text-xs transition-colors disabled:opacity-40"
            >
              {loading ? "Searching..." : "Verify"}
            </button>
          </form>

          {overviewData && overviewData.recent.length > 0 && !result && (
            <div className="text-center mb-8">
              <button
                onClick={() => handleSearch(undefined, overviewData.recent[0].txHash)}
                className="text-xs text-zinc-400 hover:text-white underline transition-colors"
              >
                Try sample transaction: {overviewData.recent[0].txHash.slice(0, 10)}...
              </button>
            </div>
          )}

          {loading && (
            <div className="bg-[#121215] rounded-xl p-8 text-center border border-zinc-800 shadow-sm">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-400 text-xs">Scanning Polygon Amoy and ChainBudget ledger...</p>
            </div>
          )}

          {result && (
            <div className="bg-[#121215] rounded-xl p-5 md:p-6 border border-zinc-800 shadow-xl relative">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {result.status || "Verified"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Amount</span>
                  <span className="font-bold text-xl md:text-2xl font-mono text-white">
                    ₱{result.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                    <Building className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Organization</span>
                  </div>
                  <p className="font-semibold text-sm text-white truncate">{result.organization}</p>
                </div>

                <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Date</span>
                  </div>
                  <p className="font-semibold text-sm text-white">
                    {result.date ? new Date(result.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A"}
                  </p>
                </div>

                <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 md:col-span-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Description & Category</span>
                  </div>
                  <p className="font-medium text-sm text-white mb-0.5">{result.description}</p>
                  <p className="text-xs text-zinc-400 font-medium">{result.category}</p>
                </div>
              </div>

              {result.txHash && (
                <div className="bg-zinc-900 rounded-lg p-3.5 border border-zinc-800">
                  <p className="text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Blockchain Hash</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-zinc-300 truncate">{result.txHash}</p>
                    <a
                      href={getExplorerTxUrl(result.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-200 hover:text-white flex items-center gap-1 text-xs font-semibold shrink-0 transition-colors"
                    >
                      Explorer <ExternalLink className="w-3.5 h-3.5" />
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
