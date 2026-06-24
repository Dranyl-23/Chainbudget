"use client";

import { useState } from "react";
import { Search, ShieldCheck, ArrowLeft, ExternalLink, Calendar, Building, DollarSign } from "lucide-react";
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/transactions/public/${query.trim()}`);
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
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-gray-100">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-7 h-7 object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="e.g. 0xabc123... or CB-12345"
              className="w-full pl-12 pr-32 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-0 outline-none transition-colors text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? "Searching..." : "Verify"}
            </button>
          </form>

          {result && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm animate-fade-in">
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
