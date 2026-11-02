"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Globe, ShieldCheck, ArrowRight, ArrowUpRight, Activity, Lock, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { BACKEND_URL } from "@/lib/config";

interface Organization {
  _id: string;
  name: string;
  legalName?: string;
  type: string;
  description: string;
  logoUrl?: string;
  transparencyScore: number;
  isPrivate?: boolean;
  verification?: {
    status: "legacy_unverified" | "pending" | "verified" | "revoked";
    tier?: string;
    verifiedAt?: string;
    dossierHash?: string;
    attestationTxHash?: string;
  };
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
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-lg shrink-0">
        <span>{initial}</span>
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 p-1">
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
  student_org: { label: "Student Org", color: "text-zinc-200", badgeBg: "bg-zinc-800", border: "border-zinc-700" },
  homeowners_association: { label: "Homeowners (HOA)", color: "text-amber-400", badgeBg: "bg-amber-500/10", border: "border-amber-500/20" },
  ngo: { label: "Non-Profit / NGO", color: "text-rose-400", badgeBg: "bg-rose-500/10", border: "border-rose-500/20" },
  church: { label: "Church / Religious", color: "text-zinc-300", badgeBg: "bg-zinc-800", border: "border-zinc-700" },
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
        setOrgs(orgsRes.data || []);
        setFeed(feedRes.data || []);
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

  const getScoreDotColor = (score: number) => {
    if (score >= 80) return "bg-emerald-400";
    if (score >= 50) return "bg-zinc-400";
    return "bg-rose-400";
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* ── Top Navigation Bar ── */}
      <nav className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-[#09090b] sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/3D-Chainbudget.png" alt="ChainBudget" className="w-7 h-7 object-contain" />
          <span className="font-bold text-base tracking-tight text-white">
            CHAIN<span className="text-zinc-400">BUDGET</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full ml-1 hidden sm:inline-block">
            Transparency Portal
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link 
            href="/verify" 
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors hidden sm:inline-block"
          >
            Verify On-Chain Tx
          </Link>
          <Link 
            href="/dashboard" 
            className="btn-primary text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all"
          >
            Enter App
          </Link>
        </div>
      </nav>

      {/* ── Live Blockchain Feed Ticker ── */}
      {feed.length > 0 && (
        <div className="w-full bg-[#121215] border-b border-zinc-800 py-2.5 flex overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#09090b] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#09090b] to-transparent z-10 pointer-events-none" />
          
          <div className="flex items-center whitespace-nowrap animate-[scroll_35s_linear_infinite] px-4 gap-8">
            {feed.concat(feed).map((tx, idx) => (
              <div key={`${tx._id}-${idx}`} className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-semibold text-white">{tx.organization?.name}</span>
                <span className={tx.type === "income" ? "text-emerald-400" : "text-rose-400"}>
                  {tx.type === "income" ? "+" : "-"}₱{tx.amount.toLocaleString()}
                </span>
                <span className="text-zinc-500 truncate max-w-44">{tx.description}</span>
                <span className="text-zinc-700">•</span>
                <a 
                  href={`https://amoy.polygonscan.com/tx/${tx.blockchainTxHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-white underline underline-offset-2 flex items-center gap-0.5 text-[11px] transition-colors"
                >
                  PolygonScan <ArrowUpRight className="w-3 h-3" />
                </a>
                <span className="text-zinc-800 ml-4">•</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header & Search Hero ── */}
      <header className="px-6 py-12 md:py-16 max-w-7xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium mb-3.5">
          <Globe className="w-3.5 h-3.5" />
          <span>Institutional Open Ledger</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight text-white">
          Public Transparency <span className="text-zinc-400">Explorer</span>
        </h1>
        <p className="text-xs md:text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Verify decentralized organizational treasuries, inspect cryptographic transactions on Polygon, and evaluate institutional accountability metrics.
        </p>

        {/* Search Input Box */}
        <div className="mt-7 max-w-xl mx-auto relative">
          <div className="relative flex items-center bg-[#121215] border border-zinc-800 focus-within:border-zinc-500 rounded-xl shadow-xs transition-colors">
            <Search className="w-4 h-4 text-zinc-500 ml-3.5 shrink-0" />
            <input
              type="text"
              placeholder="Search organizations by name, category, or mission..."
              className="w-full bg-transparent border-none text-white placeholder-zinc-500 px-3.5 py-2.5 text-xs focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="mt-5 flex items-center justify-center gap-1.5 flex-wrap max-w-4xl mx-auto">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = selectedCategory === cat.id;

            if (cat.id !== "all" && count === 0) return null;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-white text-zinc-950 font-semibold shadow-xs"
                    : "bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? "bg-zinc-200 text-zinc-950 font-bold" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Org Grid Section ── */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5 border-b border-zinc-800 pb-3">
          <p className="text-xs text-zinc-400">
            Showing <span className="font-semibold text-white font-mono">{filteredOrgs.length}</span> verified organization{filteredOrgs.length === 1 ? '' : 's'}
            {selectedCategory !== 'all' && (
              <> in <span className="font-medium text-white capitalize">{selectedCategory.replace('_', ' ')}</span></>
            )}
          </p>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-xs text-zinc-400 hover:text-white hover:underline font-medium cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-5 rounded-xl bg-[#121215] border border-zinc-800 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-32 h-4 rounded bg-zinc-800 animate-pulse" />
                    <div className="w-20 h-3 rounded bg-zinc-800/60 animate-pulse" />
                  </div>
                </div>
                <div className="h-8 rounded bg-zinc-900/60 border border-zinc-800/80 animate-pulse" />
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="w-24 h-3.5 rounded bg-zinc-800/70 animate-pulse" />
                  <div className="w-16 h-3.5 rounded bg-zinc-800/70 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 bg-[#121215] rounded-xl border border-zinc-800 p-8">
            <Globe className="w-8 h-8 text-zinc-600 mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-white mb-1">No organizations found</p>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
              No registered organizations match the selected category &ldquo;{selectedCategory}&rdquo; and keyword query.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearch('');
              }}
              className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrgs.map((org) => {
              const typeConfig = ORG_TYPE_LABELS[org.type?.toLowerCase()] || {
                label: org.type ? org.type.replace('_', ' ').toUpperCase() : 'ORG',
                color: 'text-zinc-300',
                badgeBg: 'bg-zinc-800',
                border: 'border-zinc-700',
              };

              return (
                <Link href={`/explorer/${org._id}`} key={org._id} className="block group">
                  <div className="bg-[#121215] hover:bg-[#151518] p-5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all shadow-xs flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <ExplorerOrgLogo logoUrl={org.logoUrl} name={org.name} />
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {org.verification?.status === "verified" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Verified
                            </span>
                          )}
                          {org.isPrivate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
                            <span className={`w-1.5 h-1.5 rounded-full ${getScoreDotColor(org.transparencyScore)}`} />
                            {org.transparencyScore}% Score
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-zinc-200 transition-colors line-clamp-1">
                      {org.name}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
                      {org.description || `A registered ${typeConfig.label} institution on ChainBudget.`}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800 mt-auto">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-400">
                        <ShieldCheck className="w-3 h-3 text-zinc-400" />
                        {typeConfig.label}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">
                        {org.isPrivate ? "View Info" : "View Ledger"} <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-8 text-center text-xs text-zinc-500 bg-[#09090b]">
        <p>ChainBudget Institutional Transparency Portal · Powered by Polygon Amoy · Cor Jesu College</p>
      </footer>

      <style jsx global>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
