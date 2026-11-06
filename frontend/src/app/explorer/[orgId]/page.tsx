"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Activity, Link as LinkIcon, AlertTriangle, ExternalLink, Lock } from "lucide-react";
import api from "@/lib/api";
import { ethers } from "ethers";
import { fetchAmoyBalance } from "@/lib/rpcProvider";
import { BACKEND_URL, getExplorerAddressUrl, getExplorerTxUrl } from "@/lib/config";

interface Organization {
  _id: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  yearEstablished?: number;
  type: string;
  description: string;
  logoUrl?: string;
  contractAddress: string;
  transparencyScore: number;
  isPrivate?: boolean;
  verification?: {
    status: "legacy_unverified" | "pending" | "verified" | "revoked";
    tier?: string;
    verifiedAt?: string;
    dossierHash?: string;
    attestationTxHash?: string;
  };
}

function DetailOrgLogo({ logoUrl, name, size = "large" }: { logoUrl?: string; name?: string; size?: "small" | "large" }) {
  const [error, setError] = useState(false);

  let src = "/images/logo.png";
  if (logoUrl && !error) {
    if (logoUrl.startsWith("http") || logoUrl.startsWith("data:")) {
      src = logoUrl;
    } else if (logoUrl.startsWith("/")) {
      src = `${BACKEND_URL}${logoUrl}`;
    } else {
      src = `${BACKEND_URL}/${logoUrl}`;
    }
  }

  const initial = (name || "O").trim().charAt(0).toUpperCase();

  if (error || !logoUrl) {
    return (
      <div className={`w-full h-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold ${size === "small" ? "text-sm rounded-lg" : "text-2xl rounded-xl"}`}>
        <span>{initial}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name || "Organization"}
      onError={() => setError(true)}
      className={`w-full h-full object-contain p-1 ${size === "small" ? "rounded-lg" : "rounded-xl"}`}
    />
  );
}

interface Transaction {
  _id: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  category: string;
  createdAt: string;
  blockchainTxHash: string;
}

interface Budget {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
}

export default function PublicDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [org, setOrg] = useState<Organization | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [balance, setBalance] = useState<string>("0.0000");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;

    const fetchDashboard = async () => {
      try {
        const orgRes = await api.get(`/public/organizations/${orgId}`);
        const orgData = orgRes.data;
        setOrg(orgData);

        if (orgData.contractAddress) {
          try {
            const balanceWei = await fetchAmoyBalance(orgData.contractAddress);
            const balancePol = ethers.formatEther(balanceWei);
            setBalance(parseFloat(balancePol).toFixed(4));
          } catch (ethErr) {
            console.error("Failed to fetch balance", ethErr);
          }
        }

        if (!orgData.isPrivate) {
          const [txsRes, budgetRes] = await Promise.all([
            api.get(`/public/organizations/${orgId}/transactions`),
            api.get(`/public/organizations/${orgId}/budget`)
          ]);
          setTransactions(txsRes.data || []);
          setBudgets(budgetRes.data || []);
        } else {
          setTransactions([]);
          setBudgets([]);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load organization data. It may be inactive or private.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [orgId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-center p-6 text-white">
        <AlertTriangle className="w-10 h-10 text-rose-400 mb-3" />
        <h1 className="text-lg font-semibold mb-1">Organization Not Found</h1>
        <p className="text-zinc-400 text-xs mb-5 max-w-sm">{error}</p>
        <Link href="/explorer" className="px-4 py-2 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Explorer
        </Link>
      </div>
    );
  }

  const getScoreDotColor = (score: number) => {
    if (score >= 80) return "bg-emerald-400";
    if (score >= 50) return "bg-zinc-400";
    return "bg-rose-400";
  };

  const totalAllocated = budgets.reduce((acc, b) => acc + b.allocated, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalBudgetPercentage = totalAllocated > 0 ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100)) : 0;

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* ── Top Navigation Bar ── */}
      <nav className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50">
        <Link href="/explorer" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-xs font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Explorer</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
            <DetailOrgLogo logoUrl={org.logoUrl} name={org.name} size="small" />
          </div>
          <span className="font-semibold text-xs tracking-tight text-white">{org.name}</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-5">
        {/* ── Header Profile Card ── */}
        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-zinc-900 border border-zinc-800 p-2 shrink-0 overflow-hidden">
              <DetailOrgLogo logoUrl={org.logoUrl} name={org.name} size="large" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-[10px] font-medium text-zinc-400 uppercase tracking-wider border border-zinc-800">
                  {org.type ? org.type.replace('_', ' ') : 'ORG'}
                </span>
                {org.verification?.status === "verified" ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Verified Legitimacy ({org.verification.tier === "light" ? "Light Tier" : "Standard Tier"})
                  </span>
                ) : org.verification?.status === "revoked" ? (
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-[10px] font-semibold text-rose-400 border border-rose-500/30">
                    Verification Revoked
                  </span>
                ) : null}
                {org.contractAddress && (
                  <a 
                    href={getExplorerAddressUrl(org.contractAddress)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-2 py-0.5 rounded bg-zinc-900 text-[10px] font-medium text-zinc-300 uppercase tracking-wider border border-zinc-800 flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <LinkIcon className="w-2.5 h-2.5 text-zinc-400" /> Polygon Amoy
                  </a>
                )}
              </div>
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight text-white mb-1">{org.name || "Unknown Organization"}</h1>
              <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">{org.description || "Public verified organization ledger on Polygon."}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center min-w-32 text-center shadow-xs">
            <span className="text-[10px] uppercase tracking-wider font-medium mb-1 text-zinc-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${getScoreDotColor(org.transparencyScore || 0)}`} />
              Transparency Score
            </span>
            <div className="text-2xl font-bold font-mono text-white">{org.transparencyScore || 0}%</div>
          </div>
        </div>

        {/* ── On-Chain Verification Attestation Banner ── */}
        {org.verification?.status === "verified" && (
          <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-xs">
                  On-Chain Legitimacy Attestation ({org.verification.tier === "light" ? "Light Tier" : "Standard Tier"})
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Dossier Keccak-256: {org.verification.dossierHash || "Off-chain verified"}
                </p>
              </div>
            </div>

            {org.verification.attestationTxHash && (
              <a
                href={`https://amoy.polygonscan.com/tx/${org.verification.attestationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
              >
                <span>PolygonScan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {org.isPrivate ? (
          <div className="bg-[#121215] rounded-xl p-10 text-center border border-zinc-800 flex flex-col items-center justify-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-white mb-1">Private Institutional Ledger</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              This organization has restricted public access. Only authenticated active members can inspect treasury balances, budget lines, and transactions.
            </p>
            <Link href="/dashboard" className="mt-5 px-4 py-2 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-lg transition-colors shadow-xs">
              Go to Member Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* ── Overview Stats ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Live Balance Card */}
              <div className="bg-[#121215] rounded-xl p-5 flex flex-col justify-between border border-zinc-800 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Treasury Vault Balance</h3>
                  </div>
                  <div className="py-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white font-mono tracking-tight">
                        {balance || "0.0000"}
                      </span>
                      <span className="text-sm font-semibold text-zinc-400 font-mono">POL</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 mt-3">
                  {org.contractAddress ? (
                    <div className="text-[11px] text-zinc-400 flex items-center justify-between font-mono">
                      <span>{org.contractAddress.slice(0, 8)}...{org.contractAddress.slice(-6)}</span>
                      <a href={getExplorerAddressUrl(org.contractAddress)} target="_blank" rel="noopener noreferrer" className="text-zinc-200 hover:text-white hover:underline flex items-center gap-1">
                        PolygonScan <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      Master Vault (<a href={getExplorerAddressUrl()} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline">PolygonScan</a>)
                    </p>
                  )}
                </div>
              </div>

              {/* Budget Overview Card */}
              <div className="lg:col-span-2 bg-[#121215] rounded-xl p-5 border border-zinc-800 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-zinc-400" />
                      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Budget Allocation Utilization</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-500 mr-1.5">Total Cap:</span>
                      <span className="text-xs font-semibold text-white font-mono">₱{(totalAllocated || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mb-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-400">Disbursed Funds: ₱{(totalSpent || 0).toLocaleString()}</span>
                      <span className="text-zinc-200 font-medium">{totalBudgetPercentage || 0}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-white h-full rounded-full transition-all duration-300"
                        style={{ width: `${totalBudgetPercentage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Top Categories Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-zinc-800/80">
                  {(budgets || []).slice(0, 4).map((b) => (
                    <div key={b._id} className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase truncate mb-0.5" title={b.name || "Budget"}>{b.name || "Budget"}</p>
                      <p className="text-xs font-semibold text-white font-mono">₱{(b.spent || 0).toLocaleString()}</p>
                    </div>
                  ))}
                  {(!budgets || budgets.length === 0) && (
                    <div className="col-span-full text-center text-xs text-zinc-500 py-2">No public budget line items registered.</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Public Verified Ledger Table ── */}
            <div className="bg-[#121215] rounded-xl border border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Verified Public Ledger</h2>
                  <p className="text-[11px] text-zinc-500">Immutable cryptographic record of disbursements and receipts</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-[#0e0e11] text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                      <th className="p-3 pl-4">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-center pr-4">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {(!transactions || transactions.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs">
                          No verified on-chain transactions yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx._id} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="p-3 pl-4 text-zinc-500 font-mono whitespace-nowrap">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "Unknown"}
                          </td>
                          <td className="p-3 text-zinc-200 font-medium">
                            {tx.description || "No description"}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 text-[10px] text-zinc-400 border border-zinc-800">
                              {tx.category || "General"}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-semibold font-mono whitespace-nowrap ${tx.type === "income" ? "text-emerald-400" : "text-zinc-200"}`}>
                            {tx.type === "income" ? "+" : "-"}₱{(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center pr-4">
                            {tx.blockchainTxHash ? (
                              <a 
                                href={getExplorerTxUrl(tx.blockchainTxHash)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 hover:text-white transition-colors border border-zinc-800 text-[10px] font-mono"
                                title="Verify on Polygonscan"
                              >
                                <span>Verify</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
