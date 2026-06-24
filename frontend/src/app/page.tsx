"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Wallet, ShieldCheck, Users, BarChart3, ChevronRight, Link2, Lock } from "lucide-react";

const features = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    title: "Blockchain Audit Trail",
    desc: "Every transaction is hashed and recorded on Polygon Amoy — tamper-evident by design.",
  },
  {
    icon: <Users className="w-6 h-6 text-primary/80" />,
    title: "2-of-N Multi-Signature",
    desc: "High-value transactions require consensus from multiple Level-1 approvers via smart contract rules.",
  },
  {
    icon: <Lock className="w-6 h-6 text-primary/80" />,
    title: "Role-Based Access",
    desc: "Four-level permission system: Executive Approvers, Finance Officers, Members, and Public Viewers.",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-primary/70" />,
    title: "Real-Time Dashboard",
    desc: "Live fund monitoring with spending breakdowns, pending approvals, and exportable reports.",
  },
];

export default function LandingPage() {
  const { isConnected, login, isLoading, error, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConnected && user) {
      window.location.href = "/dashboard";
    }
  }, [isConnected, user]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "radial-gradient(ellipse at 20% 20%, rgba(107,85,217,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168,146,240,0.06) 0%, transparent 50%), var(--color-bg)" }}>
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white/0">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-7 h-7 object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Chain<span className="gradient-text">Budget</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
          Polygon Amoy Testnet
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-8"
          style={{ background: "rgba(107,85,217,0.12)", border: "1px solid rgba(107,85,217,0.2)", color: "#5A3EAE" }}>
          <ShieldCheck className="w-3.5 h-3.5" /> Blockchain-Powered Transparency
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Transparent Fund<br />
          <span className="gradient-text">Management</span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
          ChainBudget helps organizations monitor shared funds with verifiable blockchain records,
          smart contract approvals, and role-based accountability.
        </p>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm text-primary border border-primary/20 bg-primary/10">
            {error}
          </div>
        )}

        <button
          id="connect-wallet-btn"
          onClick={login}
          disabled={isLoading}
          className="btn-primary text-base px-8 py-3 pulse-glow"
          style={{ borderRadius: "12px" }}
        >
          <Wallet className="w-5 h-5" />
          {isLoading ? "Connecting..." : "Connect MetaMask Wallet"}
          {!isLoading && <ChevronRight className="w-4 h-4" />}
        </button>

        <p className="mt-4 text-xs text-gray-600">
          Requires MetaMask browser extension · Polygon Amoy Testnet
        </p>
      </section>

      {/* ── Feature grid ── */}
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm text-white mb-1">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center py-6 text-xs text-gray-700 border-t border-white/5">
        ChainBudget · Cor Jesu College Capstone 2025–2026 · Supporting SDG 16
      </footer>
    </main>
  );
}
