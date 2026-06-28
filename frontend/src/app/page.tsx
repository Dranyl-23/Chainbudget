"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Wallet, ShieldCheck, Users, BarChart3, Lock, LogIn, UserPlus, Search } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: <ShieldCheck className="w-8 h-8 text-fuchsia-400" />,
    title: "Secure Transactions",
    desc: "Advanced encryption and multi-layer security on Polygon Amoy.",
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-cyan-400" />,
    title: "Real-Time Tracking",
    desc: "Instant processing without delays. Monitor funds live.",
  },
  {
    icon: <Lock className="w-8 h-8 text-purple-400" />,
    title: "Role-Based Access",
    desc: "Four-level permission system ensuring absolute accountability.",
  },
  {
    icon: <Users className="w-8 h-8 text-blue-400" />,
    title: "Multi-Signature",
    desc: "High-value transactions require consensus from multiple approvers.",
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
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-[#0A0216] text-white">
      {/* ── Massive Holographic Fluid Background ── */}
      <div className="absolute top-[-10%] left-[-20%] w-[120vw] md:w-[70vw] h-[120vw] md:h-[70vw] rounded-full bg-fuchsia-600/30 blur-[100px] md:blur-[150px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[20%] right-[-30%] w-[100vw] md:w-[60vw] h-[100vw] md:h-[60vw] rounded-full bg-cyan-600/20 blur-[90px] md:blur-[130px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '14s' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[120vw] md:w-[80vw] h-[120vw] md:h-[80vw] rounded-full bg-blue-800/20 blur-[120px] md:blur-[160px] pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
      
      {/* ── Noise Overlay ── */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>

      {/* ── Nav ── */}
      <nav className="relative z-20 flex items-center justify-between px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-md">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-5 h-5 md:w-7 md:h-7 object-contain rounded-md md:rounded-lg" />
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight text-white">
            CHAIN<span className="text-fuchsia-400">BUDGET</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
          <span className="hover:text-white cursor-pointer transition-colors">Why us</span>
          <span className="hover:text-white cursor-pointer transition-colors">Features</span>
          <span className="hover:text-white cursor-pointer transition-colors">Security</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-white/50 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse inline-block" />
          Polygon Amoy
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 xl:gap-12 items-center px-6 md:px-16 pt-16 md:pt-20 pb-20 md:pb-32 max-w-7xl mx-auto w-full">
        {/* Left Content */}
        <div className="flex flex-col items-start w-full lg:col-span-7 z-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-[4.5rem] font-extrabold tracking-tight mb-6 md:mb-8 leading-[1.1] text-white drop-shadow-2xl uppercase w-full">
            SIMPLIFY YOUR <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-purple-500 block mt-2 sm:mt-1 xl:mt-2">
              TRANSACTIONS
            </span>
          </h1>

          <p className="text-white/70 text-base md:text-lg xl:text-xl max-w-xl mb-10 md:mb-12 leading-relaxed">
            Seamless, secure and fast transparent fund management in an easy-to-understand app for organizations of all sizes.
          </p>

          {error && (
            <div className="mb-8 px-4 py-3 rounded-lg text-sm text-fuchsia-200 border border-fuchsia-500/30 bg-fuchsia-900/40 backdrop-blur-md">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {isAsgardeoAuthenticated && !isConnected ? (
              <button
                onClick={linkMetaMask}
                disabled={isLoading}
                style={{ backgroundColor: 'white' }}
                className="group relative overflow-hidden rounded-full text-sm font-bold px-8 py-4 w-full sm:w-auto min-w-[200px] text-[#0A0216] hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                <span className="relative flex items-center justify-center gap-2">
                  <Wallet className="w-5 h-5" />
                  {isLoading ? "Linking..." : "Link MetaMask"}
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={login}
                  disabled={isLoading}
                  style={{ backgroundColor: 'white' }}
                  className="group relative overflow-hidden rounded-full text-sm font-bold px-10 py-4 w-full sm:w-auto min-w-[180px] text-[#0A0216] hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    <LogIn className="w-5 h-5" />
                    {isLoading ? "Loading..." : "Get Started"}
                  </span>
                </button>

                <button
                  onClick={register}
                  disabled={isLoading}
                  className="group rounded-full text-sm font-bold px-10 py-4 w-full sm:w-auto min-w-[180px] text-white bg-white/5 backdrop-blur-md border border-white/20 hover:bg-white/10 hover:border-white/40 transition-all duration-300"
                >
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Register
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <Link href="/verify" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              <Search className="w-4 h-4" /> Verify a Transaction
            </Link>
          </div>
        </div>

        {/* Right Content: 3D Dashboard Preview */}
        <div className="hidden lg:flex justify-end items-center w-full lg:col-span-5 mt-10 lg:mt-0" style={{ perspective: '1200px' }}>
          {/* Static Tilt Container */}
          <div style={{ transformStyle: 'preserve-3d', transform: 'rotateX(15deg) rotateY(-20deg) scale(0.95)' }}>
            {/* Floating Container */}
            <div className="relative w-full max-w-[380px] xl:max-w-[420px]" style={{ transformStyle: 'preserve-3d', animation: 'float-delayed 6s ease-in-out infinite' }}>
              
              {/* Main Glass Panel */}
              <div className="relative bg-[#160B2E]/70 backdrop-blur-3xl border border-purple-500/40 rounded-3xl p-7 shadow-[0_30px_60px_rgba(0,0,0,0.6),_0_0_80px_rgba(139,92,246,0.3)] overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-fuchsia-500/20 via-transparent to-cyan-500/10 opacity-100 pointer-events-none" />
                
                <div className="relative z-10 flex items-center justify-between mb-8">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-widest font-bold mb-1.5">Total Balance</p>
                    <p className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">₱ 1.25M</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/30 flex items-center justify-center border border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    <Wallet className="w-6 h-6 text-cyan-200" />
                  </div>
                </div>

                {/* Mock Chart Area */}
                <div className="relative z-10 h-28 w-full flex items-end gap-3 mb-8 border-b border-white/20 pb-3">
                  {[30, 50, 40, 80, 60, 100, 75].map((h, i) => (
                    <div key={i} className="group flex-1 relative flex justify-center">
                      <div className="w-full bg-gradient-to-t from-purple-500 to-cyan-300 rounded-t-md transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.5)]" style={{ height: `${h}%` }}></div>
                    </div>
                  ))}
                </div>

                {/* Mock Transactions */}
                <div className="relative z-10 space-y-3">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-3">Recent On-Chain Activity</p>
                  {[
                    { title: "Office Supplies", amount: "-₱ 15,000", color: "text-red-300", bg: "bg-red-500/30", dot: "bg-red-400" },
                    { title: "Dept Funding", amount: "+₱ 500,000", color: "text-green-300", bg: "bg-green-500/30", dot: "bg-green-400" },
                    { title: "Server Costs", amount: "-₱ 8,500", color: "text-red-300", bg: "bg-red-500/30", dot: "bg-red-400" },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/10 rounded-2xl p-3.5 border border-white/10 hover:bg-white/20 hover:border-white/20 transition-all cursor-default shadow-sm">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-10 h-10 rounded-full ${tx.bg} flex items-center justify-center border border-white/10`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${tx.dot} shadow-[0_0_10px_currentColor]`}></div>
                        </div>
                        <span className="text-sm font-bold text-white">{tx.title}</span>
                      </div>
                      <span className={`text-sm font-extrabold tracking-wide ${tx.color}`}>{tx.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating Decorative Elements */}
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-purple-500/30 border border-purple-400/50 rounded-3xl backdrop-blur-xl animate-float-delayed flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.5),_0_0_50px_rgba(139,92,246,0.5)] z-20" style={{ transform: 'translateZ(80px)' }}>
                <ShieldCheck className="w-12 h-12 text-fuchsia-300 drop-shadow-lg" />
              </div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-cyan-500/20 border border-cyan-400/40 rounded-full backdrop-blur-xl flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.5),_0_0_50px_rgba(34,211,238,0.4)] z-0" style={{ transform: 'translateZ(-50px)', animation: 'float 7s ease-in-out infinite' }}>
                <Users className="w-14 h-14 text-cyan-200 drop-shadow-lg" />
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us (Glassmorphism Grid) ── */}
      <section className="relative z-10 px-6 md:px-16 pb-20 md:pb-32 max-w-7xl mx-auto w-full">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-8 md:mb-10 uppercase tracking-wide">
          Why Choose Us?
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {features.map((f, i) => (
            <div key={i} className="group relative p-6 md:p-8 rounded-3xl bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/20 overflow-hidden hover:-translate-y-2 hover:border-purple-400/50 hover:bg-[#1a0e35]/80 transition-all duration-500 shadow-[0_0_30px_rgba(139,92,246,0.05)]">
              {/* Inner Glow */}
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="mb-5 md:mb-6 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
                {f.icon}
              </div>
              <h3 className="font-bold text-base md:text-lg text-white mb-2 md:mb-3 tracking-wide">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed font-light">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats Banner ── */}
      <section className="relative z-10 px-6 md:px-16 pb-16 md:pb-24 max-w-7xl mx-auto w-full">
        <div className="rounded-3xl bg-[#160B2E]/40 backdrop-blur-lg border border-purple-500/20 py-8 md:py-10 px-6 md:px-8 flex flex-col md:flex-row justify-around items-center gap-6 md:gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-purple-500/20">
          <div className="flex flex-col items-center px-4 w-full">
            <span className="text-3xl md:text-4xl font-bold text-white mb-1 md:mb-2">100%</span>
            <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-widest">On-Chain Transparency</span>
          </div>
          <div className="flex flex-col items-center px-4 w-full pt-6 md:pt-0">
            <span className="text-3xl md:text-4xl font-bold text-white mb-1 md:mb-2">&lt; 2s</span>
            <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-widest">Transaction Speed</span>
          </div>
          <div className="flex flex-col items-center px-4 w-full pt-6 md:pt-0">
            <span className="text-3xl md:text-4xl font-bold text-white mb-1 md:mb-2">Multi-Sig</span>
            <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-widest">Enterprise Security</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-6 md:py-8 text-[10px] md:text-xs text-white/30 border-t border-white/5 mt-auto bg-[#05010B]/50 backdrop-blur-md">
        ChainBudget · Cor Jesu College Capstone 2025–2026 · Powered by Polygon
      </footer>
    </main>
  );
}
