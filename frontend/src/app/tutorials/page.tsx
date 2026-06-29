"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Video, ChevronRight, UserPlus, Building2, Users, LogIn, Wallet, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";

const tutorials = [
  {
    id: "register-login",
    icon: <LogIn className="w-6 h-6 text-cyan-400" />,
    color: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
    badge: "Step 1",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    title: "How to Register & Login",
    subtitle: "Google Sign-In + MetaMask Wallet Setup",
    steps: [
      {
        title: "Create a Google Account",
        desc: "Make sure you have a Google account ready (Gmail). This will be used to log in to ChainBudget.",
        icon: <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Install MetaMask",
        desc: "Download and install the MetaMask browser extension from metamask.io. Create a new wallet and securely save your seed phrase. Never share your seed phrase with anyone!",
        icon: <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
        link: { label: "Get MetaMask →", href: "https://metamask.io/download/" },
      },
      {
        title: "Add Polygon Amoy Network",
        desc: "In MetaMask, go to Settings > Networks > Add Network. Add the Polygon Amoy Testnet (Chain ID: 80002). You can also use chainlist.org to add it automatically.",
        icon: <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
        link: { label: "Use Chainlist →", href: "https://chainlist.org/?search=amoy" },
      },
      {
        title: "Sign in with Google",
        desc: "Click 'Get Started' on the ChainBudget homepage, then click 'Sign in with Google'. Use your Google account credentials to log in.",
        icon: <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Connect Your MetaMask Wallet",
        desc: "After logging in, you will be directed to a wallet connection screen. Click 'Connect MetaMask', approve the connection request, and sign the verification message. Your account is now fully set up!",
        icon: <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Wait for Organization Invite",
        desc: "After connecting your wallet, share your wallet address with your Organization Admin. Once they add you to the organization, refresh the page and you will have access to the dashboard.",
        icon: <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />,
      },
    ],
  },
  {
    id: "create-org",
    icon: <Building2 className="w-6 h-6 text-fuchsia-400" />,
    color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30",
    badge: "Step 2",
    badgeColor: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
    title: "How to Create an Organization",
    subtitle: "Set up your organization and become a Level 1 Admin",
    steps: [
      {
        title: "Login & Connect Wallet",
        desc: "Make sure you are logged in with your Google account and your MetaMask wallet is connected (see Step 1 above).",
        icon: <CheckCircle2 className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Click 'Create Organization'",
        desc: "After logging in for the first time, you will see the Welcome screen. Click the 'Create Organization' card on the left side.",
        icon: <CheckCircle2 className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Fill in Organization Details",
        desc: "Enter your organization name, type (e.g., Student Org, University Department), and a short description. These details will be visible to the public in the Explorer.",
        icon: <CheckCircle2 className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Submit & Confirm",
        desc: "Click 'Create Organization'. You will automatically become the Level 1 Executive Admin of your organization with full control over budget management.",
        icon: <CheckCircle2 className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Set Up Your Treasury",
        desc: "Go to the Treasury tab in your dashboard to fund your organization's smart contract wallet and start managing budgets on-chain.",
        icon: <CheckCircle2 className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />,
      },
    ],
  },
  {
    id: "add-members",
    icon: <Users className="w-6 h-6 text-purple-400" />,
    color: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
    badge: "Step 3",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    title: "How to Add Team Members",
    subtitle: "Invite and manage your organization members",
    steps: [
      {
        title: "Ask Members to Sign Up First",
        desc: "Before adding a member, they must first sign up to ChainBudget using their Google account and connect their MetaMask wallet. They can share their wallet address with you from the 'I Was Invited' screen.",
        icon: <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Go to Team Management",
        desc: "In your dashboard sidebar, click on 'Team' to open the Team Management page. You must be a Level 1 Admin to add members.",
        icon: <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Click 'Add Member'",
        desc: "Click the 'Add Member' button on the top right of the Team Management page to open the Add Member modal.",
        icon: <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Paste Their Wallet Address",
        desc: "Paste the member's MetaMask wallet address (starting with 0x...) in the Wallet Address field. If they have already signed up, their Name and Email will be auto-filled automatically!",
        icon: <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Assign Access Level & Position",
        desc: "Choose the member's access level: Level 1 (Executive Approver), Level 2 (Finance Officer), Level 3 (Member/Contributor), or Level 4 (Public Viewer). Enter their position or title (e.g., Treasurer, Secretary).",
        icon: <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />,
      },
      {
        title: "Click 'Add Member'",
        desc: "Click the 'Add Member' button. The member will now appear in your team list. Ask them to refresh their dashboard — they will now have access to your organization!",
        icon: <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />,
      },
    ],
  },
];

const TutorialSection = ({ tutorial }: { tutorial: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      id={tutorial.id}
      className={`rounded-2xl border bg-gradient-to-br ${tutorial.color} backdrop-blur-md overflow-hidden`}
    >
      {/* Tutorial Header */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tutorial.color} border flex items-center justify-center flex-shrink-0`}>
          {tutorial.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${tutorial.badgeColor}`}>
              {tutorial.badge}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">{tutorial.title}</h3>
          <p className="text-sm text-white/50">{tutorial.subtitle}</p>
        </div>
      </div>

      {/* Steps (Hidden on mobile by default) */}
      <div className={`px-6 py-5 space-y-5 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        {tutorial.steps.map((step: any, stepIdx: number) => (
          <div key={stepIdx} className="flex gap-4">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white/70 flex-shrink-0">
                {stepIdx + 1}
              </div>
              {stepIdx < tutorial.steps.length - 1 && (
                <div className="w-px flex-1 min-h-[20px] bg-white/10" />
              )}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className="font-semibold text-white text-sm mb-1">{step.title}</p>
              <p className="text-white/55 text-sm leading-relaxed">{step.desc}</p>
              {step.link && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {step.link.label}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Toggle Button */}
      <div className="sm:hidden border-t border-white/5 bg-white/5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-4 flex items-center justify-center text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {isExpanded ? "Show less steps" : "Read more steps"}
        </button>
      </div>
    </div>
  );
};

export default function TutorialsPage() {
  return (
    <main className="min-h-screen bg-[#0A0216] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-fuchsia-600/20 blur-[150px] animate-pulse" style={{ animationDuration: "10s" }} />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/15 blur-[130px] animate-pulse" style={{ animationDuration: "14s" }} />
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-4 md:px-12 py-4 border-b border-white/5 backdrop-blur-md bg-black/20">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 flex-shrink-0">
            <img src="/images/logo.png" alt="ChainBudget" className="w-5 h-5 object-contain rounded-lg" />
          </div>
          <span className="text-base font-bold tracking-tight hidden sm:block">
            CHAIN<span className="text-fuchsia-400">BUDGET</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30">← Home</Link>
          <Link href="/dashboard" className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-fuchsia-600/20 border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-600/30 transition-colors">
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-sm font-medium mb-6">
            <BookOpen className="w-4 h-4" />
            User Guide
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Getting Started with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-purple-500">
              ChainBudget
            </span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Follow these step-by-step guides to set up your account, create your organization, and manage your team on the blockchain.
          </p>
        </div>

        {/* Video Tutorial */}
        <div className="mb-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Video className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Video Tutorial</p>
              <p className="text-xs text-white/40">Full walkthrough of ChainBudget setup</p>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/9Nyc9pwVXkE"
              title="Tutorial for ChainBudget"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Text Tutorials */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-white/90">Step-by-Step Text Guide</h2>

          {tutorials.map((tutorial) => (
            <TutorialSection key={tutorial.id} tutorial={tutorial} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-8 text-center">
          <h3 className="text-2xl font-bold mb-3">Ready to get started?</h3>
          <p className="text-white/60 mb-6">Create your organization and start managing your budget transparently on the blockchain.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
            >
              Explore Public Ledger
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
