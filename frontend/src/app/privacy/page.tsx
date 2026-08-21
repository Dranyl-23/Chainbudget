"use client";

import Link from "next/link";
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
  return (
    <main className="min-h-screen bg-[#0A0216] text-white relative overflow-hidden flex flex-col">
      {/* ── Background Ambient Glows ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/20 blur-[150px] pointer-events-none mix-blend-screen" />
      <div className="absolute top-[40%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/20 blur-[150px] pointer-events-none mix-blend-screen" />

      {/* ── Header Bar ── */}
      <header className="relative z-20 border-b border-white/10 backdrop-blur-xl bg-[#0A0216]/70 px-4 md:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-white hover:text-cyan-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back to Home</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src="/3D-Chainbudget.png" alt="ChainBudget" className="w-8 h-8 object-contain" />
          <span className="font-extrabold tracking-tight text-white">
            CHAIN<span className="text-cyan-400">BUDGET</span> <span className="text-xs text-white/50 font-normal">Privacy Center</span>
          </span>
        </div>
        <Link
          href="/help"
          className="text-xs text-white/70 hover:text-white border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
        >
          Help & FAQs
        </Link>
      </header>

      {/* ── Main Content Container ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        {/* Title Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Scale className="w-4 h-4" /> Republic Act No. 10173 & RA 10175 Compliance
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
            Data Privacy & <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-fuchsia-400">Security Center</span>
          </h1>
          <p className="text-white/60 text-xs md:text-sm max-w-2xl mx-auto">
            Comprehensive Privacy Notice and Information Security Safeguards governing the processing of personal data on the ChainBudget decentralized platform.
          </p>
          <div className="text-[11px] text-white/40 mt-3 font-mono">
            Effective Date: August 21, 2026 · Version: 2.0 (DPA Compliant)
          </div>
        </div>

        {/* Executive Principle Banner */}
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 to-emerald-950/40 border border-cyan-500/30 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white mb-1">Non-Custodial Zero-Knowledge Guarantee</h2>
              <p className="text-xs md:text-sm text-white/70 leading-relaxed">
                ChainBudget operates under the foundational principles of <strong className="text-white">Transparency, Legitimate Purpose, and Proportionality (RA 10173 Section 11)</strong>. We adhere to a non-custodial cryptographic model: <strong className="text-white">your private keys, seed phrases, and passwords are NEVER collected, transmitted, or stored on our servers</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Structured Sections Accordion/Cards */}
        <div className="space-y-6">
          {/* Section 1: What PI is collected */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4 text-cyan-400">
              <UserCheck className="w-6 h-6" />
              <h2 className="text-lg md:text-xl font-bold text-white">1. Personal Information We Collect</h2>
            </div>
            <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-4">
              We collect only the minimum personal data strictly necessary to fulfill organizational budget governance and decentralized authorization:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <h3 className="font-bold text-xs text-white mb-1">Identity & Account Profile</h3>
                <p className="text-xs text-white/60 leading-5">
                  Display name, email address (for organization invites), and profile avatar provided during Asgardeo SSO or wallet registration.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <h3 className="font-bold text-xs text-white mb-1">Public Cryptographic Identifiers</h3>
                <p className="text-xs text-white/60 leading-5">
                  secp256k1 public key and public wallet address (0x...). Plaintext private keys and mnemonic phrases are NEVER collected.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <h3 className="font-bold text-xs text-white mb-1">Transaction Documentation</h3>
                <p className="text-xs text-white/60 leading-5">
                  Itemized expense descriptions, invoice totals, budget categories, and uploaded physical receipt photographs for verification.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <h3 className="font-bold text-xs text-white mb-1">Audit & Device Telemetry</h3>
                <p className="text-xs text-white/60 leading-5">
                  Client IP addresses for brute-force rate-limiting, browser metadata, and immutable timestamped audit logs.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Purpose and Legal Basis */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4 text-purple-400">
              <FileText className="w-6 h-6" />
              <h2 className="text-lg md:text-xl font-bold text-white">2. Purpose and Legal Basis for Processing</h2>
            </div>
            <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-4">
              Pursuant to Section 11 & Section 12 of RA 10173, personal data is processed under the legal bases of <strong className="text-white">contractual necessity</strong> and <strong className="text-white">explicit data subject consent</strong> for:
            </p>
            <ul className="space-y-2 text-xs md:text-sm text-white/70">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span><strong>Multi-Signature Cryptographic Verification:</strong> Validating EIP-712 digital signatures before authorizing on-chain treasury disbursements.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span><strong>AI Optical Character Recognition:</strong> Automated data extraction from receipt photos using Google Gemini AI to detect anomalies and match budget allocations.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span><strong>Audit Trail Compliance:</strong> Maintaining tamper-evident records of DAO votes and organizational budget approvals.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span><strong>Security & Anti-Abuse:</strong> Enforcing rate-limiting and lockout protection against unauthorized cyber intrusions (RA 10175).</span>
              </li>
            </ul>
          </section>

          {/* Section 3: Data Storage, Retention & Security */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <Server className="w-6 h-6" />
              <h2 className="text-lg md:text-xl font-bold text-white">3. Data Storage, Retention & Security Safeguards</h2>
            </div>
            <div className="space-y-4 text-xs md:text-sm text-white/70">
              <div>
                <h3 className="font-bold text-white mb-1">Storage Architecture</h3>
                <p className="leading-relaxed">
                  Cloud database storage utilizes MongoDB with AES-256 encryption at rest. Network transit is strictly enforced over TLS 1.3 with automated HTTPS redirects.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Data Retention Schedule</h3>
                <p className="leading-relaxed">
                  User profile metadata is retained for the active lifecycle of the user account. Financial transactions, approval logs, and audit records are retained for a statutory period of <strong className="text-white">five (5) years</strong> to comply with Philippine financial accounting, tax, and auditing standards.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Cybercrime Defenses (RA 10175)</h3>
                <p className="leading-relaxed">
                  Technical defenses include stateless HMAC-SHA256 CSRF protection, strict per-IP rate-limiters on authentication routes, MongoDB injection parameter sanitizers, and role-based access control (RBAC Levels 0–4).
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Data Subject Rights (RA 10173 Sec 16) */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <Scale className="w-6 h-6" />
              <h2 className="text-lg md:text-xl font-bold text-white">4. Rights of Data Subjects (RA 10173 Section 16)</h2>
            </div>
            <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-4">
              Under Section 16 of the Data Privacy Act of 2012, all registered users and data subjects enjoy the following statutory rights:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Right to be Informed", desc: "To be notified of the nature, purpose, and extent of data processing." },
                { title: "Right to Access", desc: "To obtain a copy of your personal data held in our systems upon reasonable demand." },
                { title: "Right to Object", desc: "To withhold consent or object to automated processing and profiling." },
                { title: "Right to Erasure / Blocking", desc: "To request the deletion or anonymization of your account profile." },
                { title: "Right to Rectification", desc: "To dispute and correct inaccurate or outdated personal information." },
                { title: "Right to Data Portability", desc: "To receive your personal data in an electronic, structured JSON format." },
                { title: "Right to Damages", desc: "To be indemnified for damages suffered due to inaccurate or unlawful data processing." },
                { title: "Transmissibility of Rights", desc: "Rights may be invoked by lawful heirs or assignees pursuant to Section 17." },
              ].map((r, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-xs text-white">{r.title}</h3>
                    <p className="text-[11px] text-white/60 leading-4">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Data Correction, Erasure & DPO Contact */}
          <section className="bg-gradient-to-br from-cyan-950/30 via-purple-950/30 to-fuchsia-950/30 border border-cyan-500/40 rounded-3xl p-6 md:p-8 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4 text-cyan-400">
              <Mail className="w-6 h-6" />
              <h2 className="text-lg md:text-xl font-bold text-white">5. Exercising Your Rights & DPO Contact</h2>
            </div>
            <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-6">
              To exercise your data subject rights (access, rectification, erasure, data portability) or to report suspected data breaches or security vulnerabilities, contact our designated Data Protection Officer:
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <div className="text-sm font-bold text-white">Data Protection Office (DPO)</div>
                <div className="text-xs text-white/60">Republic Act No. 10173 Compliance Desk</div>
                <div className="text-xs font-mono text-cyan-300 mt-1">dpo@chainbudget.ph · privacy@chainbudget.org</div>
              </div>
              <a
                href="mailto:dpo@chainbudget.ph?subject=Data%20Privacy%20Inquiry%20(RA%2010173)"
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs md:text-sm transition-all shrink-0"
              >
                Contact DPO Desk
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-6 text-xs text-white/40 border-t border-white/5 bg-[#05010B]/50 backdrop-blur-md">
        ChainBudget · Cor Jesu College Capstone 2025–2026 · Aligned with RA 10173 & RA 10175
      </footer>
    </main>
  );
}
