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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo.png" alt="ChainBudget logo" className="w-8 h-8 object-contain rounded-[8px] shadow-sm flex-shrink-0" />
          <span className="font-bold text-lg tracking-tight text-gray-900">
            Chain<span className="text-primary">Budget</span>
          </span>
        </Link>
        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Public Verification</h1>
            <p className="text-gray-500">
              Enter a ChainBudget receipt number or a Polygon blockchain hash to verify the authenticity and status of an organizational transaction.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative mb-12">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              placeholder="e.g. 0xabc123... or CB-12345"
              className="w-full pl-10 md:pl-12 pr-[85px] md:pr-32 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-0 outline-none transition-colors text-sm md:text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 bg-primary text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-sm md:text-base font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? "Searching..." : "Verify"}
            </button>
          </form>

          {overviewData && overviewData.recent.length > 0 && !result && (
            <div className="text-center mb-8">
              <button
                onClick={() => handleSearch(undefined, overviewData.recent[0].txHash)}
                className="text-sm font-medium text-primary hover:text-primary-hover underline underline-offset-4"
              >
                Try it out: Click to verify a sample transaction
              </button>
            </div>
          )}

          {!result && overviewData && (
            <div className="animate-fade-in w-full max-w-3xl mx-auto space-y-10">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm flex items-center md:flex-col md:text-center gap-4 md:gap-0">
                  <div className="w-10 h-10 md:mx-auto bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0 md:mb-3">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold text-gray-900 md:leading-tight">{overviewData.stats.totalVerified}</h3>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Verified Transactions</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm flex items-center md:flex-col md:text-center gap-4 md:gap-0">
                  <div className="w-10 h-10 md:mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0 md:mb-3">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold text-gray-900 md:leading-tight">₱{overviewData.stats.totalFunds.toLocaleString()}</h3>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Secured on Blockchain</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm flex items-center md:flex-col md:text-center gap-4 md:gap-0">
                  <div className="w-10 h-10 md:mx-auto bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0 md:mb-3">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold text-gray-900 md:leading-tight">{overviewData.stats.activeOrgs}</h3>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Active Organizations</p>
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              {overviewData.recent.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">Recent Public Transactions</h3>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {overviewData.recent.map((tx, idx) => (
                      <li key={idx} className="p-4 md:p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start sm:items-center justify-between gap-3">
                          <div className="flex-1 pr-2">
                            <p className="font-semibold text-gray-900 text-sm md:text-base leading-tight mb-1 md:mb-0">{tx.description}</p>
                            <div className="flex items-center flex-wrap gap-2 md:gap-3 text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1">
                              <span>{tx.organization}</span>
                              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                              <span>{new Date(tx.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 text-right shrink-0">
                            <div>
                              <p className="font-bold text-gray-900 text-sm md:text-base">₱{tx.amount.toLocaleString()}</p>
                              <span className="inline-block mt-0.5 md:mt-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold bg-green-100 text-green-700">
                                Verified
                              </span>
                            </div>
                            <button
                              onClick={() => handleSearch(undefined, tx.txHash)}
                              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors shrink-0"
                              title="View details"
                            >
                              <Search className="w-4 h-4" />
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
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm animate-fade-in w-full max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    result.status === "Approved" ? "bg-green-100 text-green-700" :
                    result.status === "Pending" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {result.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 mb-1">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">₱{result.amount.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Building className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Organization</span>
                  </div>
                  <p className="font-medium text-gray-900">{result.organization}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Date Created</span>
                  </div>
                  <p className="font-medium text-gray-900">{new Date(result.date).toLocaleString()}</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Description & Category</span>
                  </div>
                  <p className="font-medium text-gray-900">{result.description}</p>
                  <p className="text-sm text-gray-500 mt-1">{result.category}</p>
                </div>
              </div>

              {result.txHash && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Blockchain Hash</p>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-sm text-gray-600 truncate">{result.txHash}</p>
                    <a
                      href={`https://amoy.polygonscan.com/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover flex items-center gap-1.5 text-sm font-medium shrink-0"
                    >
                      Explorer <ExternalLink className="w-4 h-4" />
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
