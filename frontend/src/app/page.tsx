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

        {/* Right Content: 3D Glowing Coin */}
        <div className="hidden lg:flex justify-end items-center w-full lg:col-span-5 mt-10 lg:mt-0" style={{ perspective: '1200px' }}>
          <div className="relative animate-float w-full max-w-[380px] xl:max-w-[420px] flex justify-center h-[400px] items-center" style={{ transformStyle: 'preserve-3d' }}>
            
            {/* The 3D Spinning Coin */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 animate-spin-slow-3d" style={{ transformStyle: 'preserve-3d' }}>
              
              {/* Back Face */}
              <div className="absolute inset-0 rounded-full border-[6px] border-fuchsia-500/80 bg-gradient-to-br from-[#160B2E] to-purple-900/60 backdrop-blur-xl shadow-[0_0_80px_rgba(217,70,239,0.4)] flex items-center justify-center" style={{ transform: 'translateZ(-16px) rotateY(180deg)' }}>
                <div className="absolute inset-2 rounded-full border border-fuchsia-400/20" />
                <div className="absolute inset-4 rounded-full border border-fuchsia-400/10" />
                
                <div className="flex flex-col items-center justify-center z-10 relative">
                  <div className="w-24 h-24 rounded-full bg-fuchsia-500/10 border border-fuchsia-400/30 flex items-center justify-center shadow-[0_0_30px_rgba(217,70,239,0.2)] mb-4">
                    {/* Simulated Polygon Logo */}
                    <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]">
                      <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" stroke="#E879F9" strokeWidth="6" fill="#8B5CF6" fillOpacity="0.5" />
                      <circle cx="50" cy="50" r="15" fill="#E879F9" />
                    </svg>
                  </div>
                  <span className="text-white font-extrabold tracking-[0.2em] text-lg uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    Polygon
                  </span>
                  <span className="text-fuchsia-300 font-bold tracking-widest text-[10px] uppercase mt-1">
                    Network
                  </span>
                </div>
              </div>
              
              {/* Inner Core / Edge Thickness */}
              {[...Array(16)].map((_, i) => (
                <div key={i} className="absolute inset-0 rounded-full border-[3px] border-purple-500/30 bg-[#0A0216]/50" style={{ transform: `translateZ(${-15 + i * 2}px)` }}></div>
              ))}

              {/* Front Face */}
              <div className="absolute inset-0 rounded-full border-[6px] border-cyan-400 bg-gradient-to-tr from-[#160B2E]/90 to-purple-900/80 backdrop-blur-2xl flex items-center justify-center shadow-[inset_0_0_60px_rgba(34,211,238,0.3),_0_0_100px_rgba(34,211,238,0.5)]" style={{ transform: 'translateZ(16px)' }}>
                <div className="absolute inset-2 rounded-full border border-white/10" />
                <div className="absolute inset-4 rounded-full border border-white/5" />
                
                <div className="flex flex-col items-center justify-center z-10 relative">
                  {/* Outer glowing ring for the logo */}
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4">
                    <img src="/images/logo.png" alt="ChainBudget" className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]" />
                  </div>
                  <span className="text-white font-extrabold tracking-[0.2em] text-lg uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                    ChainBudget
                  </span>
                  <span className="text-cyan-300 font-bold tracking-widest text-[10px] uppercase mt-1">
                    Powered By Polygon
                  </span>
                </div>
              </div>

            </div>

            {/* Floating Decorative Elements around the coin */}
            <div className="absolute top-10 -right-10 w-24 h-24 bg-purple-500/20 border border-purple-400/40 rounded-3xl backdrop-blur-xl animate-float flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.5),_0_0_50px_rgba(139,92,246,0.5)] z-20" style={{ transform: 'translateZ(60px)' }}>
              <ShieldCheck className="w-10 h-10 text-fuchsia-300 drop-shadow-lg" />
            </div>
            <div className="absolute bottom-10 -left-10 w-28 h-28 bg-cyan-500/20 border border-cyan-400/40 rounded-full backdrop-blur-xl flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.5),_0_0_50px_rgba(34,211,238,0.4)] z-0" style={{ transform: 'translateZ(-40px)', animation: 'float-delayed 7s ease-in-out infinite' }}>
              <Users className="w-12 h-12 text-cyan-200 drop-shadow-lg" />
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
        <div className="rounded-3xl bg-[#160B2E]/60 backdrop-blur-xl border border-purple-500/30 py-8 md:py-10 px-6 md:px-8 flex flex-col md:flex-row justify-around items-center text-center divide-y md:divide-y-0 md:divide-x divide-purple-500/30 shadow-[0_0_40px_rgba(139,92,246,0.1)]">
          <div className="flex flex-col items-center px-4 py-5 md:py-0 w-full">
            <span className="text-3xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">100%</span>
            <span className="text-[10px] md:text-xs text-cyan-300 font-bold uppercase tracking-[0.2em]">On-Chain Transparency</span>
          </div>
          <div className="flex flex-col items-center px-4 py-6 md:py-0 w-full">
            <span className="text-3xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">&lt; 2s</span>
            <span className="text-[10px] md:text-xs text-cyan-300 font-bold uppercase tracking-[0.2em]">Transaction Speed</span>
          </div>
          <div className="flex flex-col items-center px-4 py-5 md:py-0 w-full">
            <span className="text-3xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">Multi-Sig</span>
            <span className="text-[10px] md:text-xs text-cyan-300 font-bold uppercase tracking-[0.2em]">Enterprise Security</span>
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
