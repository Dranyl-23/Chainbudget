"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Wallet, ShieldCheck, Users, BarChart3, Lock, LogIn, UserPlus, Search, Hexagon, Menu, X, ArrowRight, ArrowUpRight, Globe, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    title: "Secure Transactions",
    desc: "Cryptographic consensus and multi-layer verification on Polygon Amoy testnet.",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-cyan-400" />,
    title: "Real-Time Tracking",
    desc: "Instant ledger recording without delays. Track inflows, outflows, and remaining limits.",
  },
  {
    icon: <Lock className="w-6 h-6 text-zinc-200" />,
    title: "Role-Based Access (RBAC)",
    desc: "Four-tier institutional hierarchy: Executives, Approvers, Members, and Public Viewers.",
  },
  {
    icon: <Users className="w-6 h-6 text-emerald-400" />,
    title: "Multi-Signature Governance",
    desc: "High-value transactions strictly require threshold consensus before smart contract release.",
  },
];

export default function LandingPage() {
  const { isConnected, isAsgardeoAuthenticated, login, register, linkMetaMask, isLoading, error, user } = useAuth();
  const router = useRouter();

  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const modalData = {
    whyUs: {
      title: "Why ChainBudget?",
      content: "ChainBudget brings 100% verifiable financial transparency to educational and institutional organizations.\n\nBy anchoring treasury releases to the Polygon blockchain, we eliminate undisclosed disbursements and build lasting stakeholder trust. Organizations can publicly prove fiscal integrity without sacrificing administrative agility."
    },
    features: {
      title: "Key Capabilities",
      content: "• Real-Time Treasury: Observe safe reserves and category envelopes with zero latency.\n• EIP-712 Typed Signatures: Authenticate disbursements using cryptographic off-chain signatures verified on-chain.\n• Gasless Relayer: Web3 cryptographic assurance without gas fee hurdles—the relayer handles blockchain execution.\n• Public Explorer: Publicly verifiable student body portal for transparent auditability."
    },
    security: {
      title: "Enterprise Multi-Sig Security",
      content: "Our Smart Contract Safe acts as an autonomous decentralized custodian.\n\nNo solitary executive can withdraw funds unilaterally. High-value disbursements mandate multi-party consensus (e.g. 2-of-N signers) before the smart contract releases funds directly to verified vendors."
    }
  };

  useEffect(() => {
    if (isConnected && user) {
      router.push("/dashboard");
    }
  }, [isConnected, user, router]);

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-[#09090b] text-white">
      {/* ── Top Navigation Bar ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-3.5 md:py-4 border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/3D-Chainbudget.png" alt="ChainBudget logo" className="w-8 h-8 object-contain shrink-0" />
          <span className="text-lg font-bold tracking-tight text-white">
            CHAIN<span className="text-zinc-400">BUDGET</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <button onClick={() => setInfoModal(modalData.whyUs)} className="hover:text-white transition-colors cursor-pointer">
            Why Us
          </button>
          <button onClick={() => setInfoModal(modalData.features)} className="hover:text-white transition-colors cursor-pointer">
            Features
          </button>
          <button onClick={() => setInfoModal(modalData.security)} className="hover:text-white transition-colors cursor-pointer">
            Security
          </button>
          <Link href="/explorer" className="hover:text-white transition-colors">
            Public Explorer
          </Link>
          <Link href="/help" className="hover:text-white transition-colors">
            Help &amp; FAQ
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Data Privacy
          </Link>
        </div>

        <div className="hidden sm:flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Polygon Amoy</span>
          </div>

          <button
            onClick={login}
            disabled={isLoading}
            className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            Sign In
          </button>
        </div>
        
        {/* Mobile Menu Toggle Button */}
        <button 
          className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* ── Mobile Menu Dropdown ── */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[65px] left-0 w-full bg-[#0e1017]/95 backdrop-blur-xl border-b border-white/[0.08] z-40 p-6 flex flex-col gap-4 text-xs font-medium text-white/70 shadow-2xl animate-fade-in">
          <button onClick={() => { setInfoModal(modalData.whyUs); setIsMobileMenuOpen(false); }} className="text-left py-1 hover:text-white transition-colors">
            Why Us
          </button>
          <button onClick={() => { setInfoModal(modalData.features); setIsMobileMenuOpen(false); }} className="text-left py-1 hover:text-white transition-colors">
            Features
          </button>
          <button onClick={() => { setInfoModal(modalData.security); setIsMobileMenuOpen(false); }} className="text-left py-1 hover:text-white transition-colors">
            Security
          </button>
          <Link href="/explorer" onClick={() => setIsMobileMenuOpen(false)} className="py-1 hover:text-white transition-colors">
            Public Explorer
          </Link>
          <Link href="/help" onClick={() => setIsMobileMenuOpen(false)} className="py-1 hover:text-white transition-colors">
            Help & FAQ
          </Link>
          <Link href="/privacy" onClick={() => setIsMobileMenuOpen(false)} className="py-1 hover:text-white transition-colors">
            Data Privacy (RA 10173)
          </Link>
          <div className="pt-3 border-t border-white/[0.08] flex gap-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); login(); }}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold text-center"
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsMobileMenuOpen(false); register(); }}
              className="flex-1 py-2.5 rounded-xl bg-[#13151f] border border-white/[0.08] text-white text-xs font-semibold text-center"
            >
              Register
            </button>
          </div>
        </div>
      )}

      {/* ── Hero Section ── */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center px-6 md:px-16 pt-16 md:pt-24 pb-16 md:pb-24 max-w-7xl mx-auto w-full">
        {/* Left Content */}
        <div className="flex flex-col items-start w-full lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium mb-5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Institutional Web3 Governance</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 leading-[1.1] text-white">
            Simplify Your <br />
            <span className="text-zinc-400">Organizational Finances</span>
          </h1>

          <p className="text-zinc-400 text-xs sm:text-sm md:text-base max-w-xl mb-7 leading-relaxed">
            Multi-signature blockchain treasury and transparent fund disbursement built for collegiate institutions, clubs, and cooperatives.
          </p>

          {error && (
            <div className="mb-5 px-3.5 py-2 rounded-lg text-xs text-rose-400 border border-rose-500/20 bg-rose-500/10">
              {error}
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {isAsgardeoAuthenticated && !isConnected ? (
              <button
                onClick={linkMetaMask}
                disabled={isLoading}
                className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                {isLoading ? "Linking..." : "Link MetaMask Wallet"}
              </button>
            ) : (
              <>
                <button
                  onClick={login}
                  disabled={isLoading}
                  className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {isLoading ? "Authenticating..." : "Get Started"}
                </button>

                <button
                  onClick={register}
                  disabled={isLoading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Register Account
                </button>
              </>
            )}
          </div>

          {/* Explorer Quick Links */}
          <div className="mt-7 flex items-center gap-4 text-xs">
            <Link href="/explorer" className="flex items-center gap-1.5 text-zinc-300 hover:text-white hover:underline font-medium">
              <Globe className="w-3.5 h-3.5" />
              Explore Public Ledgers
            </Link>
            <span className="text-zinc-700">•</span>
            <Link href="/verify" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Search className="w-3.5 h-3.5" />
              Verify Transaction
            </Link>
          </div>
        </div>

        {/* Right Content: 3D Holographic Spinning Coin */}
        <div className="hidden lg:flex justify-end items-center w-full lg:col-span-5" style={{ perspective: '1200px' }}>
          <div className="relative animate-float w-full max-w-[380px] flex justify-center h-[380px] items-center" style={{ transformStyle: 'preserve-3d' }}>
            
            {/* The 3D Spinning Coin */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 animate-spin-slow-3d" style={{ transformStyle: 'preserve-3d' }}>
              
              {/* Back Face */}
              <div className="absolute inset-0 rounded-full border-2 border-zinc-700 bg-[#121215] shadow-xl flex items-center justify-center" style={{ transform: 'translateZ(-14px) rotateY(180deg)' }}>
                <div className="flex flex-col items-center justify-center z-10 relative">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Matic-logo.png" alt="Polygon" className="w-12 h-12 object-contain" />
                  </div>
                  <span className="text-white font-semibold tracking-wider text-xs uppercase">Polygon</span>
                  <span className="text-zinc-400 font-mono text-[10px] uppercase mt-0.5">Amoy Testnet</span>
                </div>
              </div>
              
              {/* Thickness layers */}
              {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute inset-0 rounded-full border border-zinc-800 bg-[#09090b]" style={{ transform: `translateZ(${-12 + i * 2}px)` }} />
              ))}

              {/* Front Face */}
              <div className="absolute inset-0 rounded-full border-2 border-zinc-700 bg-[#121215] flex items-center justify-center shadow-xl" style={{ transform: 'translateZ(14px)' }}>
                <div className="flex flex-col items-center justify-center z-10 relative">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/3D-Chainbudget.png" alt="ChainBudget" className="w-16 h-16 object-contain" />
                  </div>
                  <span className="text-white font-semibold tracking-wider text-xs uppercase">ChainBudget</span>
                  <span className="text-zinc-400 font-mono text-[10px] uppercase mt-0.5">Decentralized Vault</span>
                </div>
              </div>

            </div>

            {/* Floating Decorative Elements */}
            <div className="absolute top-6 -right-6 z-20 animate-float" style={{ transform: 'translateZ(50px)' }}>
              <div className="w-14 h-14 rounded-xl bg-[#121215] border border-zinc-800 shadow-lg flex items-center justify-center">
                <Hexagon className="w-6 h-6 text-zinc-300" />
              </div>
            </div>

            <div className="absolute bottom-6 -left-6 z-0" style={{ transform: 'translateZ(-30px)' }}>
              <div className="w-14 h-14 rounded-xl bg-[#121215] border border-zinc-800 shadow-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-zinc-400" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Feature Highlights Grid ── */}
      <section className="relative z-10 px-6 md:px-16 pb-16 md:pb-20 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Institutional Architecture</h2>
          <p className="text-xs text-zinc-400 mt-1">Engineered to eliminate financial opacity without operational friction.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {features.map((f, i) => (
            <div key={i} className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 p-4.5 rounded-xl transition-all shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3.5 text-zinc-300">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-xs md:text-sm text-white mb-1">{f.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Metrics Banner ── */}
      <section className="relative z-10 px-6 md:px-16 pb-16 md:pb-20 max-w-7xl mx-auto w-full">
        <div className="bg-[#121215] border border-zinc-800 rounded-xl py-5 px-6 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800 text-center shadow-xs">
          <div className="py-3 md:py-0 px-4">
            <span className="text-2xl md:text-3xl font-bold text-white font-mono">100%</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mt-1">Cryptographic Transparency</p>
          </div>
          <div className="py-3 md:py-0 px-4">
            <span className="text-2xl md:text-3xl font-bold text-white font-mono">&lt; 2s</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mt-1">Polygon Block Finality</p>
          </div>
          <div className="py-3 md:py-0 px-4">
            <span className="text-2xl md:text-3xl font-bold text-white font-mono">2-of-N</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mt-1">Multi-Sig Consensus Guard</p>
          </div>
        </div>
      </section>

      {/* ── Institutional Footer ── */}
      <footer className="relative z-10 text-center py-7 text-xs text-zinc-500 border-t border-zinc-800 bg-[#09090b] flex flex-col items-center justify-center gap-2.5">
        <div className="flex items-center justify-center gap-4 text-zinc-400">
          <Link href="/help" className="hover:text-white transition-colors">Help &amp; FAQ</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-white transition-colors">Data Privacy (RA 10173)</Link>
          <span>·</span>
          <Link href="/tutorials" className="hover:text-white transition-colors">Tutorials</Link>
          <span>·</span>
          <Link href="/verify" className="hover:text-white transition-colors">Verify Receipt</Link>
        </div>
        <p className="text-zinc-600 text-[11px] max-w-xl mx-auto px-4">
          ChainBudget · Cor Jesu College Capstone Project · Anchored on Polygon Amoy · Aligned with RA 10175 (Cybercrime Prevention) &amp; RA 10173 (Data Privacy Act)
        </p>
      </footer>

      {/* ── Info Modal ── */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121215] border border-zinc-800 p-5 md:p-6 rounded-xl max-w-lg w-full shadow-xl flex flex-col text-white">
            <div className="flex items-center justify-between mb-3.5 border-b border-zinc-800 pb-2.5">
              <h2 className="text-sm font-semibold text-white">{infoModal.title}</h2>
              <button 
                onClick={() => setInfoModal(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line space-y-2">
              {infoModal.content}
            </div>
            <div className="mt-5 flex justify-end pt-3 border-t border-zinc-800">
              <button 
                onClick={() => setInfoModal(null)}
                className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
