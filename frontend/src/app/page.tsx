"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Wallet, ShieldCheck, Users, BarChart3, ChevronRight, Link2, Lock, LogIn, UserPlus, Search } from "lucide-react";
import Link from "next/link";

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
  const { isConnected, isAsgardeoAuthenticated, login, register, linkMetaMask, isLoading, error, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConnected && user) {
      router.push("/dashboard");
    }
  }, [isConnected, user, router]);

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-[#faf9ff] dark:bg-[#0B0C10]">
      {/* ── Background Orbs ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 dark:bg-primary/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-purple-400/20 dark:bg-purple-900/20 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white/0">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-7 h-7 object-contain rounded-[8px] shadow-sm" />
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
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 animate-fade-in relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8 shadow-sm backdrop-blur-md relative group cursor-default border border-primary/20 bg-primary/5 dark:bg-primary/10 text-primary">
          <div className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <ShieldCheck className="w-4 h-4" /> 
          Blockchain-Powered Transparency
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] text-gray-900 dark:text-white">
          Transparent Fund<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-indigo-500 animate-gradient-x drop-shadow-sm pb-2 inline-block">
            Management
          </span>
        </h1>

        <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
          ChainBudget helps organizations monitor shared funds with verifiable blockchain records,
          smart contract approvals, and role-based accountability.
        </p>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm text-primary border border-primary/20 bg-primary/10">
            {error}
          </div>
        )}

        {isAsgardeoAuthenticated && !isConnected ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-primary font-medium bg-primary/20 px-4 py-2 rounded-lg border border-primary/30">
              Logged in via Asgardeo. Please link your MetaMask wallet to continue.
            </p>
            <button
              onClick={linkMetaMask}
              disabled={isLoading}
              className="relative group overflow-hidden rounded-xl text-sm font-bold px-8 py-3.5 w-full sm:w-auto min-w-[200px] text-white shadow-[0_0_30px_-10px_rgba(107,85,217,0.5)] hover:shadow-[0_0_40px_-10px_rgba(107,85,217,0.7)] transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #8B5CF6)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative flex items-center justify-center gap-2">
                <Wallet className="w-5 h-5" />
                {isLoading ? "Linking..." : "Link MetaMask Wallet"}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={login}
              disabled={isLoading}
              className="relative group overflow-hidden rounded-xl text-sm font-bold px-8 py-3.5 w-full sm:w-auto min-w-[180px] text-white shadow-[0_0_30px_-10px_rgba(107,85,217,0.5)] hover:shadow-[0_0_50px_-10px_rgba(107,85,217,0.8)] transition-all duration-300 hover:-translate-y-1"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #8B5CF6)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5" />
                {isLoading ? "Loading..." : "Login to Portal"}
              </span>
            </button>

            <button
              onClick={register}
              disabled={isLoading}
              className="relative group rounded-xl text-sm font-bold px-8 py-3.5 w-full sm:w-auto min-w-[180px] text-gray-800 dark:text-gray-100 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-primary/40 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1"
            >
              <span className="flex items-center justify-center gap-2">
                <UserPlus className="w-5 h-5" />
                Register Account
              </span>
            </button>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-200/20 max-w-md w-full flex flex-col items-center">
          <p className="text-sm text-gray-500 mb-4">No account? Public access is available.</p>
          <Link href="/verify" className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
            <Search className="w-4 h-4" /> Verify a Transaction
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-600">
          Powered by WSO2 Asgardeo · Polygon Amoy Testnet
        </p>
      </section>

      {/* ── Feature grid ── */}
      <section className="px-6 pb-24 max-w-6xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="group glass p-6 rounded-2xl animate-fade-in hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(107,85,217,0.15)] transition-all duration-300 border border-transparent hover:border-primary/20 dark:hover:border-primary/30 relative overflow-hidden bg-white/60 dark:bg-gray-900/40" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="mb-5 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300 shadow-sm border border-primary/10">
                {f.icon}
              </div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
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
