"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  Lock,
  FileText,
  UserCheck,
  Server,
  Key,
  Eye,
  AlertCircle,
  Mail,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Scale,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export default function PrivacyPolicyPage() {
  const { isConnected } = useAuth();

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
            ChainBudget <span className="text-xs text-zinc-500 font-normal">Privacy Center</span>
          </span>
        </div>
        <Link
          href="/help"
          className="text-xs text-zinc-400 hover:text-white border border-zinc-800 px-3 py-1 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          Help & FAQs
        </Link>
      </header>

      {/* ── Main Content Container ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-10 flex-1 w-full">
        {/* Title Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider mb-3">
            <Scale className="w-3.5 h-3.5 text-zinc-400" /> Republic Act No. 10173 & RA 10175 Compliance
          </div>
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white mb-2">
            Data Privacy & Security Center
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
            Privacy Notice and Information Security Safeguards governing the processing of personal data on the ChainBudget decentralized platform.
          </p>
          <div className="text-[11px] text-zinc-500 mt-2 font-mono">
            Effective Date: August 21, 2026 · Version: 2.0 (DPA Compliant)
          </div>
        </div>

        {/* Executive Principle Banner */}
        <div className="mb-6 p-5 rounded-xl bg-[#121215] border border-zinc-800 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white mb-1">Non-Custodial Zero-Knowledge Guarantee</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ChainBudget operates under the foundational principles of <strong className="text-zinc-200">Transparency, Legitimate Purpose, and Proportionality (RA 10173 Section 11)</strong>. We adhere to a non-custodial model: <strong className="text-zinc-200">your private keys, seed phrases, and passwords are never collected, transmitted, or stored on our servers</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Structured Sections */}
        <div className="space-y-5">
          {/* Section 1: What PI is collected */}
          <section className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3 text-zinc-300">
              <UserCheck className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">1. Personal Information We Collect</h2>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed mb-3.5">
              We collect only the minimum personal data strictly necessary to fulfill organizational budget governance and decentralized authorization:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <h3 className="font-semibold text-xs text-zinc-200 mb-1">Identity & Account Profile</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Display name, email address (for organization invites), and profile avatar provided during SSO or wallet registration.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <h3 className="font-semibold text-xs text-zinc-200 mb-1">Public Cryptographic Identifiers</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  secp256k1 public key and public wallet address (0x...). Plaintext private keys and mnemonic phrases are NEVER collected.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <h3 className="font-semibold text-xs text-zinc-200 mb-1">Transaction Documentation</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Itemized expense descriptions, invoice totals, budget categories, and uploaded physical receipt photographs for verification.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <h3 className="font-semibold text-xs text-zinc-200 mb-1">Audit & Device Telemetry</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Client IP addresses for rate-limiting, browser metadata, and immutable timestamped audit logs.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Purpose and Legal Basis */}
          <section className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3 text-zinc-300">
              <FileText className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">2. Purpose and Legal Basis for Processing</h2>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed mb-3">
              Pursuant to Section 11 & Section 12 of RA 10173, personal data is processed under the legal bases of <strong className="text-zinc-200">contractual necessity</strong> and <strong className="text-zinc-200">explicit data subject consent</strong> for:
            </p>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-200">Multi-Signature Verification:</strong> Validating EIP-712 digital signatures before authorizing on-chain treasury disbursements.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-200">AI Receipt Analysis:</strong> Automated data extraction from receipt photos using Google Gemini AI to detect anomalies and match budget allocations.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-200">Audit Trail Compliance:</strong> Maintaining tamper-evident records of DAO votes and organizational budget approvals.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span><strong className="text-zinc-200">Security & Anti-Abuse:</strong> Enforcing rate-limiting and lockout protection against unauthorized intrusions (RA 10175).</span>
              </li>
            </ul>
          </section>

          {/* Section 3: Data Storage, Retention & Security */}
          <section className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3 text-zinc-300">
              <Server className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">3. Data Storage, Retention & Security Safeguards</h2>
            </div>
            <div className="space-y-3.5 text-xs text-zinc-400">
              <div>
                <h3 className="font-semibold text-zinc-200 mb-0.5">Storage Architecture</h3>
                <p className="leading-relaxed">
                  Database storage utilizes MongoDB with encryption at rest. Network transit is strictly enforced over TLS 1.3 with automated HTTPS redirects.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-200 mb-0.5">Data Retention Schedule</h3>
                <p className="leading-relaxed">
                  User profile metadata is retained for the active lifecycle of the account. Financial transactions, approval logs, and audit records are retained for a statutory period of <strong className="text-zinc-200">five (5) years</strong> to comply with Philippine financial accounting and auditing standards.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-200 mb-0.5">Cybercrime Defenses (RA 10175)</h3>
                <p className="leading-relaxed">
                  Technical defenses include stateless HMAC-SHA256 CSRF protection, per-IP rate-limiters on authentication routes, MongoDB injection parameter sanitizers, and role-based access control (RBAC Levels 0–4).
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Data Subject Rights (RA 10173 Sec 16) */}
          <section className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3 text-zinc-300">
              <Scale className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">4. Rights of Data Subjects (RA 10173 Section 16)</h2>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed mb-3.5">
              Under Section 16 of the Data Privacy Act of 2012, all registered users and data subjects enjoy the following statutory rights:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                { title: "Right to be Informed", desc: "To be notified of the nature, purpose, and extent of data processing." },
                { title: "Right to Access", desc: "To obtain a copy of your personal data held in our systems upon reasonable demand." },
                { title: "Right to Object", desc: "To withhold consent or object to automated processing and profiling." },
                { title: "Right to Erasure / Blocking", desc: "To request deletion or anonymization of your account profile." },
                { title: "Right to Rectification", desc: "To dispute and correct inaccurate or outdated personal information." },
                { title: "Right to Data Portability", desc: "To receive your personal data in an electronic, structured JSON format." },
                { title: "Right to Damages", desc: "To be indemnified for damages suffered due to inaccurate or unlawful data processing." },
                { title: "Transmissibility of Rights", desc: "Rights may be invoked by lawful heirs or assignees pursuant to Section 17." },
              ].map((r, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-xs text-zinc-200">{r.title}</h3>
                    <p className="text-[11px] text-zinc-500 leading-4">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Data Correction, Erasure & DPO Contact */}
          <section className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3 text-zinc-300">
              <Mail className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">5. Exercising Your Rights & DPO Contact</h2>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              To exercise your data subject rights (access, rectification, erasure, data portability) or report suspected vulnerabilities, contact our Data Protection Officer:
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <div>
                <div className="text-xs font-semibold text-white">Data Protection Office (DPO)</div>
                <div className="text-[11px] text-zinc-500">Republic Act No. 10173 Compliance Desk</div>
                <div className="text-xs font-mono text-zinc-300 mt-1">dpo@chainbudget.ph · privacy@chainbudget.org</div>
              </div>
              <a
                href="mailto:dpo@chainbudget.ph?subject=Data%20Privacy%20Inquiry%20(RA%2010173)"
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors shrink-0"
              >
                Contact DPO Desk
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-5 text-xs text-zinc-500 border-t border-zinc-800 bg-[#09090b]">
        ChainBudget · Cor Jesu College Capstone 2025–2026 · Aligned with RA 10173 & RA 10175
      </footer>
    </main>
  );
}
