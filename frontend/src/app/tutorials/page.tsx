"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { BookOpen, Video, Building2, Users, LogIn, CheckCircle2, ArrowRight, ExternalLink, Sparkles } from "lucide-react";

interface TutorialStep {
  title: string;
  desc: string;
  icon: ReactNode;
  link?: {
    label: string;
    href: string;
  };
}

interface TutorialItem {
  id: string;
  icon: ReactNode;
  color: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  steps: TutorialStep[];
}

const tutorials: TutorialItem[] = [
  {
    id: "register-login",
    icon: <LogIn className="w-5 h-5 text-zinc-300" />,
    color: "bg-[#121215] border-zinc-800",
    badge: "Step 1",
    badgeColor: "bg-zinc-800 text-zinc-300 border-zinc-700",
    title: "How to Register & Login",
    subtitle: "Google Sign-In + MetaMask Wallet Setup",
    steps: [
      {
        title: "Create a Google Account",
        desc: "Make sure you have a Google account ready (Gmail). This will be used to log in to ChainBudget.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Install MetaMask",
        desc: "Download and install the MetaMask browser extension from metamask.io. Create a new wallet and securely save your seed phrase. Never share your seed phrase with anyone!",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
        link: { label: "Get MetaMask →", href: "https://metamask.io/download/" },
      },
      {
        title: "Add Polygon Amoy Network",
        desc: "In MetaMask, go to Settings > Networks > Add Network. Add the Polygon Amoy Testnet (Chain ID: 80002). You can also use chainlist.org to add it automatically.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
        link: { label: "Use Chainlist →", href: "https://chainlist.org/?search=amoy" },
      },
      {
        title: "Sign in with Google",
        desc: "Click 'Get Started' on the ChainBudget homepage, then click 'Sign in with Google'. Use your Google account credentials to log in.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Connect Your MetaMask Wallet",
        desc: "After logging in, you will be directed to a wallet connection screen. Click 'Connect MetaMask', approve the connection request, and sign the verification message. Your account is now fully set up!",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Wait for Organization Invite",
        desc: "After connecting your wallet, share your wallet address with your Organization Admin. Once they add you to the organization, refresh the page and you will have access to the dashboard.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
    ],
  },
  {
    id: "create-org",
    icon: <Building2 className="w-5 h-5 text-zinc-300" />,
    color: "bg-[#121215] border-zinc-800",
    badge: "Step 2",
    badgeColor: "bg-zinc-800 text-zinc-300 border-zinc-700",
    title: "How to Create an Organization",
    subtitle: "Set up your organization and become a Level 1 Admin",
    steps: [
      {
        title: "Login & Connect Wallet",
        desc: "Make sure you are logged in with your Google account and your MetaMask wallet is connected (see Step 1 above).",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Click 'Create Organization'",
        desc: "After logging in for the first time, you will see the Welcome screen. Click the 'Create Organization' card on the left side.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Fill in Organization Details",
        desc: "Enter your organization name, type (e.g., Student Org, University Department), and a short description. These details will be visible to the public in the Explorer.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Submit & Confirm",
        desc: "Click 'Create Organization'. You will automatically become the Level 1 Executive Admin of your organization with full control over budget management.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Set Up Your Treasury",
        desc: "Go to the Treasury tab in your dashboard to fund your organization's smart contract wallet and start managing budgets on-chain.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
    ],
  },
  {
    id: "add-members",
    icon: <Users className="w-5 h-5 text-zinc-300" />,
    color: "bg-[#121215] border-zinc-800",
    badge: "Step 3",
    badgeColor: "bg-zinc-800 text-zinc-300 border-zinc-700",
    title: "How to Add Team Members",
    subtitle: "Invite and manage your organization members",
    steps: [
      {
        title: "Ask Members to Sign Up First",
        desc: "Before adding a member, they must first sign up to ChainBudget using their Google account and connect their MetaMask wallet. They can share their wallet address with you from the 'I Was Invited' screen.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Go to Team Management",
        desc: "In your dashboard sidebar, click on 'Team' to open the Team Management page. You must be a Level 1 Admin to add members.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Click 'Add Member'",
        desc: "Click the 'Add Member' button on the top right of the Team Management page to open the Add Member modal.",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Paste Their Wallet Address",
        desc: "Paste the member's MetaMask wallet address (starting with 0x...) in the Wallet Address field. If they have already signed up, their Name and Email will be auto-filled automatically!",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Assign Access Level & Position",
        desc: "Choose the member's access level: Level 1 (Executive Approver), Level 2 (Finance Officer), Level 3 (Member/Contributor), or Level 4 (Public Viewer). Enter their position or title (e.g., Treasurer, Secretary).",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
      {
        title: "Click 'Add Member'",
        desc: "Click the 'Add Member' button. The member will now appear in your team list. Ask them to refresh their dashboard — they will now have access to your organization!",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />,
      },
    ],
  },
];

const TutorialSection = ({ tutorial }: { tutorial: TutorialItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      id={tutorial.id}
      className="rounded-xl border border-zinc-800 bg-[#121215] overflow-hidden shadow-sm"
    >
      {/* Tutorial Header */}
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          {tutorial.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border ${tutorial.badgeColor}`}>
              {tutorial.badge}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white">{tutorial.title}</h3>
          <p className="text-xs text-zinc-400">{tutorial.subtitle}</p>
        </div>
      </div>

      {/* Steps (Hidden on mobile by default) */}
      <div className={`px-5 py-4 space-y-4 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        {tutorial.steps.map((step: TutorialStep, stepIdx: number) => (
          <div key={stepIdx} className="flex gap-3.5">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-semibold text-zinc-300 shrink-0">
                {stepIdx + 1}
              </div>
              {stepIdx < tutorial.steps.length - 1 && (
                <div className="w-px flex-1 min-h-[16px] bg-zinc-800" />
              )}
            </div>
            <div className="pb-3 flex-1 min-w-0">
              <p className="font-semibold text-white text-xs mb-0.5">{step.title}</p>
              <p className="text-zinc-400 text-xs leading-relaxed">{step.desc}</p>
              {step.link && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-xs text-zinc-200 hover:text-white underline transition-colors"
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
      <div className="sm:hidden border-t border-zinc-800 bg-zinc-900">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2.5 flex items-center justify-center text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
        >
          {isExpanded ? "Show less steps" : "Read more steps"}
        </button>
      </div>
    </div>
  );
};

export default function TutorialsPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-4 md:px-8 py-3.5 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/3D-Chainbudget.png" alt="ChainBudget" width={32} height={32} className="object-contain shrink-0" />
          <span className="text-base font-semibold tracking-tight text-white">
            ChainBudget
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1 rounded-lg border border-zinc-800 hover:bg-zinc-900">← Home</Link>
          <Link href="/dashboard" className="text-xs px-3 py-1 rounded-lg bg-white text-zinc-950 font-semibold hover:bg-zinc-200 transition-colors">
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider mb-3">
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            User Guide &amp; Tutorials
          </div>
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white mb-2">
            Getting Started with ChainBudget
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto leading-relaxed mb-4">
            Step-by-step guides to set up your account, create your organization, and manage your team on the blockchain.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("cb_tour_completed");
              } catch {}
              window.location.href = "/dashboard";
            }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs text-zinc-200 font-medium cursor-pointer transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Launch Interactive Dashboard Walkthrough Tour</span>
          </button>
        </div>

        {/* Video Tutorial */}
        <div className="mb-10 rounded-xl border border-zinc-800 bg-[#121215] overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Video className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Video Tutorial</p>
              <p className="text-[10px] text-zinc-500">Walkthrough of ChainBudget setup</p>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/dS-3-ZqTkdA"
              title="ChainBudget Video Tutorial Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Text Tutorials */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Step-by-Step Guides</h2>

          {tutorials.map((tutorial) => (
            <TutorialSection key={tutorial.id} tutorial={tutorial} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-xl border border-zinc-800 bg-[#121215] p-6 text-center shadow-sm">
          <h3 className="text-base font-semibold text-white mb-1.5">Ready to get started?</h3>
          <p className="text-zinc-400 text-xs mb-5 max-w-md mx-auto">Create your organization and start managing your budget transparently on Polygon Amoy.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors"
            >
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors"
            >
              Explore Public Ledger
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
