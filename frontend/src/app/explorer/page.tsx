"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Globe, ShieldCheck, ArrowRight, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import api from "@/lib/api";

interface Organization {
  _id: string;
  name: string;
  type: string;
  description: string;
  logoUrl: string;
  transparencyScore: number;
}

interface FeedTx {
  _id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
  blockchainTxHash: string;
  organization: { name: string };
}

export default function ExplorerPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [feed, setFeed] = useState<FeedTx[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgsRes, feedRes] = await Promise.all([
          api.get("/public/organizations"),
          api.get("/public/feed")
        ]);
        setOrgs(orgsRes.data);
        setFeed(feedRes.data);
      } catch (err) {
        console.error("Failed to load public data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredOrgs = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400 bg-green-400/10 border-green-400/30";
    if (score >= 70) return "text-cyan-400 bg-cyan-400/10 border-cyan-400/30";
    if (score >= 50) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    return "text-red-400 bg-red-400/10 border-red-400/30";
  };

  const backendUrl = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace("/api", "") 
    : "http://localhost:5000";

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* ── Top Nav ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/images/logo.png" alt="ChainBudget" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-xl tracking-tight">
            CHAIN<span className="text-cyan-400">BUDGET</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </nav>

      {/* ── Live Blockchain Feed Ticker ── */}
      {feed.length > 0 && (
        <div className="w-full bg-cyan-900/20 border-b border-cyan-500/20 py-2 flex overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#050505] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#050505] to-transparent z-10" />
          
          <div className="flex items-center whitespace-nowrap animate-[scroll_30s_linear_infinite] px-4 gap-8">
            {feed.concat(feed).map((tx, idx) => (
              <div key={`${tx._id}-${idx}`} className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span className="font-bold text-white">{tx.organization?.name}</span>
                <span className={tx.type === "income" ? "text-green-400" : "text-red-400"}>
                  {tx.type === "income" ? "+" : "-"}₱{tx.amount.toLocaleString()}
                </span>
                <span className="text-white/30 truncate max-w-[150px]">{tx.description}</span>
                <span className="text-white/10">•</span>
                <a 
                  href={`https://amoy.polygonscan.com/tx/${tx.blockchainTxHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-fuchsia-400 hover:text-fuchsia-300 underline underline-offset-2 flex items-center gap-1"
                >
                  Verify <ArrowUpRight className="w-3 h-3" />
                </a>
                <span className="mx-4 text-cyan-500/30">|</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="px-6 py-16 md:py-24 max-w-7xl mx-auto text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <Globe className="w-16 h-16 text-cyan-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
        <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight drop-shadow-lg">
          Public Transparency <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">Explorer</span>
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
          Explore public ledgers, verify on-chain transactions, and see the financial transparency score of different organizations.
        </p>

        <div className="mt-10 max-w-xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
          <div className="relative flex items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl">
            <Search className="w-6 h-6 text-white/40 ml-3" />
            <input
              type="text"
              placeholder="Search for an organization..."
              className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-white/40 px-4 py-3 text-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* ── Org Grid ── */}
      <section className="px-6 pb-32 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <p>No organizations found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org) => (
              <Link href={`/explorer/${org._id}`} key={org._id} className="block group">
                <div className="glass p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_40px_rgba(34,211,238,0.15)] relative overflow-hidden h-full flex flex-col">
                  {/* Subtle background glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-transparent to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-colors duration-500 pointer-events-none" />
                  
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <img 
                      src={org.logoUrl ? (org.logoUrl.startsWith('http') ? org.logoUrl : `${backendUrl}${org.logoUrl}`) : "/images/logo.png"} 
                      alt={org.name}
                      className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10"
                    />
                    <div className={`flex flex-col items-end`}>
                      <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1">Score</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold font-mono border ${getScoreColor(org.transparencyScore)} shadow-inner`}>
                        {org.transparencyScore}%
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors relative z-10">
                    {org.name}
                  </h3>
                  <p className="text-sm text-white/50 line-clamp-2 mb-6 flex-1 relative z-10">
                    {org.description || `A ${org.type.replace('_', ' ')} organization on ChainBudget.`}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto relative z-10">
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <ShieldCheck className="w-4 h-4 text-cyan-500/50" />
                      {org.type.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-fuchsia-400 group-hover:text-fuchsia-300 transition-colors">
                      View Ledger <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
