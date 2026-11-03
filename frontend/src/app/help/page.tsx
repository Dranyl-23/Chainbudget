"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  HelpCircle,
  Search,
  ShieldCheck,
  Wallet,
  ArrowLeftRight,
  ClipboardCheck,
  Vote,
  Sparkles,
  AlertTriangle,
  Mail,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ExternalLink,
  LifeBuoy,
  BookOpen,
  Lock,
  FileText,
  Code2,
} from "lucide-react";


interface FaqItem {
  category: "auth" | "wallet" | "transactions" | "approvals" | "dao" | "ai" | "security" | "troubleshooting";
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  // ── 1. Account & Auth ──
  {
    category: "auth",
    question: "How do I create and authenticate an account on ChainBudget Web?",
    answer:
      "ChainBudget supports enterprise Single Sign-On (SSO) via Asgardeo (OpenID Connect / Google OAuth) as well as direct non-custodial Web3 wallet authentication. When logging in with a Web3 wallet (MetaMask or WalletConnect), the backend issues a 5-minute cryptographic challenge nonce that you sign client-side with zero gas fees.",
  },
  {
    category: "auth",
    question: "Do I need a password to access my account?",
    answer:
      "No traditional passwords are stored on ChainBudget. Authentication is verified either via Asgardeo OAuth tokens or through asymmetric public-key cryptography (secp256k1) where your private key creates mathematical signature proofs.",
  },

  // ── 2. Wallet & Web3 ──
  {
    category: "wallet",
    question: "Which blockchain network does ChainBudget use?",
    answer:
      "ChainBudget is deployed on the Polygon Amoy Testnet (Chain ID: 80002 / 0x13882) and is compatible with Polygon PoS Mainnet. Polygon delivers sub-second finality and predictable, ultra-low transaction costs.",
  },
  {
    category: "wallet",
    question: "What is a Soulbound Member ID (SBT)?",
    answer:
      "A Soulbound Token (SBT) is an ERC-721 non-transferable NFT minted on Polygon that proves your role level (Level 1 Executive, Level 2 Finance, Level 3 Member) within an organization. Because SBTs cannot be transferred between wallets, they prevent credential theft.",
  },
  {
    category: "wallet",
    question: "Who pays the gas fees for blockchain transactions?",
    answer:
      "ChainBudget incorporates a gasless backend relayer. When authorized approvers execute multi-signature disbursements, our relayer submits the transaction on-chain and covers the network gas fees, providing a seamless Web2 experience with Web3 trust.",
  },

  // ── 3. Transactions ──
  {
    category: "transactions",
    question: "How do I submit an expense or fund request?",
    answer:
      "From your dashboard, navigate to 'Transactions' → 'New Request'. Enter the amount, select the budget category, provide a description, and upload proof-of-expense (receipt image or invoice PDF). The transaction is routed to your organization approvers based on your role and value thresholds.",
  },
  {
    category: "transactions",
    question: "What is the Public Transparency Ledger?",
    answer:
      "Organizations designated as 'Public' have their financial transactions, budget allocations, and on-chain verification proofs published to the ChainBudget Public Explorer. Anyone can independently verify the cryptographic hash of each disbursement.",
  },

  // ── 4. Approval Workflows ──
  {
    category: "approvals",
    question: "How does the Multi-Signature (Multi-Sig) approval workflow operate?",
    answer:
      "Transactions exceeding your organization's high-value threshold (e.g. ₱10,000) require multiple independent cryptographic signatures from Level 1 Executive Approvers and Level 2 Finance Officers. Funds cannot leave the treasury until the quorum threshold is mathematically met.",
  },
  {
    category: "approvals",
    question: "What is Smart Contract Escrow Release?",
    answer:
      "For milestone-based disbursements, funds are locked in an on-chain escrow smart contract. Once proof-of-work or physical receipts are attached and approved by designated officers, the smart contract automatically releases the escrowed funds directly to the recipient's wallet.",
  },

  // ── 5. DAO Governance & Voting ──
  {
    category: "dao",
    question: "How do DAO proposals and on-chain voting work?",
    answer:
      "Members with active SBT credentials can create governance proposals under 'DAO Governance'. Members cast 'Yes' or 'No' votes using their wallet signatures. Once the voting period ends and quorum is achieved, approved proposals can be executed directly.",
  },

  // ── 6. AI Risk Analysis ──
  {
    category: "ai",
    question: "How does Gemini AI Risk Analysis work?",
    answer:
      "ChainBudget integrates Google Gemini AI to analyze DAO governance proposals and OCR-scan uploaded receipt photos. The AI evaluates proposal feasibility, detects budget anomalies, assigns a 1–10 Risk Score, and extracts vendor and itemized line items from physical receipts.",
  },

  // ── 7. Security & Protection ──
  {
    category: "security",
    question: "How is ChainBudget protected against cyber threats (RA 10175)?",
    answer:
      "ChainBudget employs defense-in-depth: stateless HMAC-SHA256 CSRF protection, strict IP-based rate limiting, MongoDB injection sanitization, EIP-712 non-repudiation signatures, AES-256 database encryption, and immutable audit logs.",
  },
  {
    category: "security",
    question: "Are private keys ever stored on the server?",
    answer:
      "No. On Web, keys remain in your browser extension (MetaMask) or secure session storage. The server only receives signature verification proofs. Plaintext seed phrases are NEVER transmitted.",
  },

  // ── 8. Troubleshooting & Errors ──
  {
    category: "troubleshooting",
    question: "Error: 'CSRF token missing or expired' — How to fix?",
    answer:
      "CSRF tokens rotate hourly for security. If your session is idle, refresh the webpage or reopen the browser tab to generate a fresh cryptographic CSRF token automatically.",
  },
  {
    category: "troubleshooting",
    question: "Error: 'Nonce expired' during Web3 wallet login — How to fix?",
    answer:
      "Authentication nonces expire after 5 minutes to prevent replay attacks. Click 'Login / Connect Wallet' again to request a fresh challenge nonce, then sign the prompt in MetaMask promptly.",
  },
  {
    category: "troubleshooting",
    question: "Error: 'Wrong Network' in MetaMask — How to fix?",
    answer:
      "Switch your wallet network to Polygon Amoy Testnet (Chain ID: 80002 / RPC: https://rpc-amoy.polygon.technology). ChainBudget will prompt MetaMask to automatically add and switch to Amoy.",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Questions", icon: HelpCircle },
  { id: "auth", label: "Account & Auth", icon: Lock },
  { id: "wallet", label: "Wallet & Web3", icon: Wallet },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
  { id: "dao", label: "DAO Governance", icon: Vote },
  { id: "ai", label: "AI Analysis", icon: Sparkles },
  { id: "security", label: "Security & RA 10175", icon: ShieldCheck },
  { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
];

export default function HelpFaqPage() {
  const { isConnected } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter((faq) => {
    const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-[#09090b] text-white relative overflow-hidden flex flex-col">
      {/* ── Header Bar ── */}
      <header className="relative z-20 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md px-4 md:px-8 py-3.5 flex items-center justify-between">
        <Link 
          href={isConnected ? "/dashboard" : "/"} 
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium">
            {isConnected ? "Back to Dashboard" : "Back to Home"}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <img src="/3D-Chainbudget.png" alt="ChainBudget" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-sm tracking-tight text-white">
            ChainBudget <span className="text-xs text-zinc-500 font-normal">Help Center</span>
          </span>
        </div>
        <Link
          href="/privacy"
          className="text-xs text-zinc-400 hover:text-white border border-zinc-800 px-3 py-1 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          Data Privacy Notice
        </Link>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 pt-10 pb-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider mb-3">
          <LifeBuoy className="w-3.5 h-3.5 text-zinc-400" /> Help & Knowledge Base
        </div>
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white mb-2">
          How can we help you?
        </h1>
        <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto mb-6">
          Frequently asked questions regarding Web3 identity, multi-sig approvals, DAO governance, and troubleshooting.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto mb-4">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search questions, keywords, errors (e.g. 'CSRF', 'Multi-sig', 'Amoy')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#121215] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors text-xs"
          />
        </div>

        {/* Quick link to Tutorials */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Link
            href="/tutorials"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span>Looking for guides? View Step-by-Step Tutorials &amp; Video &rarr;</span>
          </Link>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-6">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setOpenIndex(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isSelected
                    ? "bg-white text-zinc-950 font-semibold border-white"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-850"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── FAQ Accordion Section ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 pb-12 flex-1 w-full">
        <div className="space-y-2.5">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-[#121215] border border-zinc-800 rounded-xl p-6">
              <HelpCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">No matching questions found</h3>
              <p className="text-zinc-500 text-xs">Try searching for a different keyword or browse all topics.</p>
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition-colors overflow-hidden ${
                    isOpen
                      ? "bg-[#121215] border-zinc-700"
                      : "bg-[#121215] border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-4 font-medium text-xs md:text-sm text-zinc-200 hover:text-white transition-colors"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-zinc-400 text-xs leading-relaxed border-t border-zinc-800/80">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Support Channels Card ── */}
        <div className="mt-8 bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Still need help?</h3>
              <p className="text-zinc-400 text-xs max-w-lg">
                Our support team and open-source developer community are available to assist with onboarding, smart contract integrations, or technical anomalies.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
              <a
                href="mailto:support@chainbudget.org"
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors"
              >
                <Mail className="w-3.5 h-3.5" /> Email Support
              </a>
              <a
                href="https://github.com/Dranyl-23/Chainbudget"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-xs transition-colors border border-zinc-800"
              >
                <Code2 className="w-3.5 h-3.5" /> GitHub Project
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-5 text-xs text-zinc-500 border-t border-zinc-800 bg-[#09090b]">
        ChainBudget · Aligned with RA 10175 (Cybercrime Prevention) & RA 10173 (Data Privacy Act)
      </footer>
    </main>
  );
}
