"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Globe, ShieldCheck, ArrowRight, ArrowUpRight, Activity, Lock } from "lucide-react";
import api from "@/lib/api";
import { BACKEND_URL } from "@/lib/config";

interface Organization {
  _id: string;
  name: string;
  type: string;
  description: string;
  logoUrl?: string;
  transparencyScore: number;
  isPrivate?: boolean;
}

function ExplorerOrgLogo({ logoUrl, name }: { logoUrl?: string; name: string }) {
  const [error, setError] = useState(false);

  let src = "/images/logo.png";
  if (logoUrl && !error) {
    if (logoUrl.startsWith("http") || logoUrl.startsWith("data:")) {
      src = logoUrl;
    } else if (logoUrl.startsWith("/")) {
      src = `${BACKEND_URL}${logoUrl}`;
    } else {
      src = `${BACKEND_URL}/${logoUrl}`;
    }
  }

  const initial = (name || "O").trim().charAt(0).toUpperCase();

  if (error || !logoUrl) {
    return (
      <div className="w-16 h-16 rounded-xl bg-linear-to-br from-purple-600/30 to-cyan-600/30 border border-white/10 flex items-center justify-center text-white font-extrabold text-2xl shrink-0 shadow-inner">
        <span className="drop-shadow-md">{initial}</span>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0 p-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        onError={() => setError(true)}
        className="w-full h-full object-contain rounded-lg"
      />
    </div>
  );
}

const ORG_TYPE_LABELS: Record<string, { label: string; color: string; badgeBg: string; border: string }> = {
  cooperative: { label: "Cooperative", color: "text-emerald-400", badgeBg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  barangay: { label: "Barangay LGU", color: "text-sky-400", badgeBg: "bg-sky-500/10", border: "border-sky-500/20" },
  student_org: { label: "Student Org", color: "text-purple-400", badgeBg: "bg-purple-500/10", border: "border-purple-500/20" },
  homeowners_association: { label: "Homeowners (HOA)", color: "text-amber-400", badgeBg: "bg-amber-500/10", border: "border-amber-500/20" },
  ngo: { label: "Non-Profit / NGO", color: "text-rose-400", badgeBg: "bg-rose-500/10", border: "border-rose-500/20" },
  church: { label: "Church / Religious", color: "text-indigo-400", badgeBg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  sports_club: { label: "Sports & Club", color: "text-yellow-400", badgeBg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  startup: { label: "Startup / Company", color: "text-cyan-400", badgeBg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  family: { label: "Family / Estate", color: "text-lime-400", badgeBg: "bg-lime-500/10", border: "border-lime-500/20" },
  fundraising: { label: "Fundraising Campaign", color: "text-pink-400", badgeBg: "bg-pink-500/10", border: "border-pink-500/20" },
};

const CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "cooperative", label: "Cooperatives" },
  { id: "barangay", label: "Barangay LGUs" },
  { id: "student_org", label: "Student Orgs" },
  { id: "homeowners_association", label: "HOA / Communities" },
  { id: "ngo", label: "Non-Profit / NGO" },
  { id: "church", label: "Church / Religious" },
  { id: "sports_club", label: "Sports & Clubs" },
  { id: "startup", label: "Startups & Companies" },
  { id: "family", label: "Family & Estates" },
  { id: "fundraising", label: "Fundraising & Charity" },
];

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
  const [selectedCategory, setSelectedCategory] = useState("all");
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

  // Category counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: orgs.length };
    orgs.forEach((o) => {
      const typeKey = o.type?.toLowerCase() || 'other';
      counts[typeKey] = (counts[typeKey] || 0) + 1;
    });
    return counts;
  }, [orgs]);

  const filteredOrgs = orgs.filter((o) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      o.name.toLowerCase().includes(q) ||
      (o.description && o.description.toLowerCase().includes(q)) ||
      (o.type && o.type.toLowerCase().includes(q));
    const matchesCategory = selectedCategory === "all" || o.type?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400 bg-green-400/10 border-green-400/30";
    if (score >= 70) return "text-cyan-400 bg-cyan-400/10 border-cyan-400/30";
    if (score >= 50) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    return "text-red-400 bg-red-400/10 border-red-400/30";
  };

  const backendUrl = BACKEND_URL;

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
                <span className="text-white/30 truncate max-w-37.5">{tx.description}</span>
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
          <div className="relative flex items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
            <Search className="w-6 h-6 text-white/40 ml-5" />
            <input
              type="text"
              placeholder="Search by name, category, or description..."
              className="w-full bg-transparent !border-none !outline-none !ring-0 focus:!border-transparent focus:!ring-0 focus:!outline-none text-white placeholder-white/40 px-4 py-4 text-lg rounded-r-xl shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="mt-8 flex items-center justify-center gap-2 flex-wrap max-w-5xl mx-auto">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = selectedCategory === cat.id;

            // Only show categories that have at least 1 org OR if it's "all"
            if (cat.id !== "all" && count === 0) return null;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.35)] scale-105"
                    : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isSelected ? "bg-black/30 text-white" : "bg-white/10 text-white/50"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Org Grid ── */}
      <section className="px-6 pb-32 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/50">
            Showing <span className="font-bold text-cyan-400">{filteredOrgs.length}</span> organization{filteredOrgs.length === 1 ? '' : 's'}
            {selectedCategory !== 'all' && (
              <> in <span className="font-bold text-white capitalize">{selectedCategory.replace('_', ' ')}</span></>
            )}
          </p>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-xs text-fuchsia-400 hover:text-fuchsia-300 underline font-medium cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="text-center py-20 text-white/40 glass rounded-3xl border border-white/5 p-12">
            <Globe className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-lg font-bold text-white mb-1">No organizations found</p>
            <p className="text-sm text-white/40 max-w-md mx-auto mb-6">
              No organizations match the selected category &ldquo;{selectedCategory}&rdquo; and search query.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearch('');
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org) => {
              const typeConfig = ORG_TYPE_LABELS[org.type?.toLowerCase()] || {
                label: org.type ? org.type.replace('_', ' ').toUpperCase() : 'ORG',
                color: 'text-cyan-400',
                badgeBg: 'bg-cyan-500/10',
                border: 'border-cyan-500/20',
              };

              return (
                <Link href={`/explorer/${org._id}`} key={org._id} className="block group">
                  <div className="glass p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_40px_rgba(34,211,238,0.15)] relative overflow-hidden h-full flex flex-col">
                    {/* Subtle background glow on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-transparent to-purple-500/0 group-hover:from-cyan-500/5 group-hover:to-purple-500/5 transition-colors duration-500 pointer-events-none" />
                    
                    <div className="flex items-start justify-between mb-6 relative z-10">
                      <ExplorerOrgLogo logoUrl={org.logoUrl} name={org.name} />
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {org.isPrivate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded-md text-xs font-bold font-mono border ${getScoreColor(org.transparencyScore)} shadow-inner`}>
                            {org.transparencyScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors relative z-10">
                      {org.name}
                    </h3>
                    <p className="text-sm text-white/50 line-clamp-2 mb-6 flex-1 relative z-10">
                      {org.description || `A registered ${typeConfig.label} organization on ChainBudget.`}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto relative z-10">
                      <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${typeConfig.badgeBg} ${typeConfig.border} ${typeConfig.color}`}>
                        <ShieldCheck className="w-3.5 h-3.5 opacity-80" />
                        {typeConfig.label}
                      </div>
                      <div className="flex items-center gap-1 text-sm font-bold text-fuchsia-400 group-hover:text-fuchsia-300 transition-colors">
                        {org.isPrivate ? "View Info" : "View Ledger"} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
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
