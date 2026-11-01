"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Vote, CheckCircle2, Search, Link2, X, Sparkles, BrainCircuit, Info, AlertTriangle, Clock, Zap, Plus, ArrowUpRight } from "lucide-react";
import api from "@/lib/api";
import Portal from "@/components/Portal";
import ConfirmModal from "@/components/ConfirmModal";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import TableSkeleton from "@/components/TableSkeleton";
import { BACKEND_URL } from "@/lib/config";
import { getErrorMessage } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserOrgRef {
  _id?: string;
  name?: string;
}

interface ProposalMemberMembership {
  organization?: string | UserOrgRef;
  role?: string;
  roleLevel?: number;
  roleLabel?: string;
  isActive?: boolean;
}

interface ProposalCreator {
  displayName: string;
  walletAddress?: string;
  memberships?: ProposalMemberMembership[];
}

interface VoteEntry {
  support: boolean;
  voter: {
    displayName: string;
    walletAddress?: string;
    memberships?: ProposalMemberMembership[];
  };
}

interface Proposal {
  _id: string;
  title: string;
  description: string;
  amount: number;
  status: "active" | "passed" | "rejected" | "executed";
  endTime: string;
  creator: ProposalCreator;
  blockchainProposalId?: number;
  yesVotes?: number;
  noVotes?: number;
  hasVoted?: boolean;
  votesList?: VoteEntry[];
}

interface ProposalsResponse {
  proposals?: Proposal[];
  total?: number;
}

interface CreateProposalResponse {
  proposal: Proposal;
  message?: string;
}

interface AiInsightData {
  riskScore: number;
  riskReason: string;
  summary: string;
  pros?: string[];
  cons?: string[];
}

function formatDeadline(endTime?: string) {
  if (!endTime) return null;
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Voting closed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export default function DAOGovernancePage() {
  const { user, activeOrgId, isConnected } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dao");
      if (cached) {
        try {
          return JSON.parse(cached) as Proposal[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("cb_cache_dao");
  });
  const [votingOn, setVotingOn] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: ""
  });
  const [activeFilter, setActiveFilter] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);

  // AI Insights State
  const [showAiModal, setShowAiModal] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<AiInsightData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Vote Confirmation State — prevents accidental irreversible votes
  const [pendingVote, setPendingVote] = useState<{ proposal: Proposal; support: boolean } | null>(null);

  // Treasury balance for AI analysis (fetched once per org)
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);

  const handleFilterChange = (status: string) => {
    setActiveFilter(status);
    setVisibleCount(6);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setVisibleCount(6);
  };

  const filteredProposals = proposals.filter((p) => {
    if (activeFilter !== "all" && p.status !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const refreshProposals = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const res = await api.get<ProposalsResponse>("/dao/proposals", {
        params: { orgId: activeOrgId },
      });
      const data = res.data.proposals || [];
      setProposals(data);
      sessionStorage.setItem("cb_cache_dao", JSON.stringify(data));
    } catch (err: unknown) {
      console.error("Failed to refresh proposals:", err);
    }
  }, [activeOrgId]);

  // ── Data Fetching & Socket Lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (!activeOrgId) return;

    let isCancelled = false;

    const loadProposals = async () => {
      try {
        const res = await api.get<ProposalsResponse>("/dao/proposals", {
          params: { orgId: activeOrgId },
        });
        const data = res.data.proposals || [];
        if (!isCancelled) {
          setProposals(data);
          sessionStorage.setItem("cb_cache_dao", JSON.stringify(data));
        }
      } catch (err: unknown) {
        console.error("Failed to load proposals:", err);
        if (!isCancelled) {
          toast.error("Failed to load proposals");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadProposals();

    const socketUrl = BACKEND_URL;
    const socket = io(socketUrl);

    socket.on("dao_vote_updated", () => {
      if (!isCancelled) {
        loadProposals();
      }
    });

    return () => {
      isCancelled = true;
      socket.disconnect();
    };
  }, [activeOrgId]);

  // Fetch treasury balance once per org for AI analysis accuracy
  useEffect(() => {
    if (!activeOrgId) return;
    api.get(`/organizations/${activeOrgId}`)
      .then((res) => {
        const bal = res.data?.treasuryBalance ?? res.data?.subsidyAmount ?? 0;
        setTreasuryBalance(Number(bal));
      })
      .catch(() => {});
  }, [activeOrgId]);

  const handleVote = (proposal: Proposal, support: boolean) => {
    if (!isConnected) {
      toast.error("Please connect wallet first");
      return;
    }
    setPendingVote({ proposal, support });
  };

  const confirmVote = async () => {
    if (!pendingVote) return;
    const { proposal, support } = pendingVote;
    setPendingVote(null);
    setVotingOn(proposal._id);
    try {
      await api.post(`/dao/proposals/${proposal._id}/vote`, { support });
      toast.success(`Vote "${support ? "Yes" : "No"}" cast successfully!`);
      await refreshProposals();
    } catch (err: unknown) {
      console.error("Voting failed:", err);
      toast.error(getErrorMessage(err, "Voting failed"));
    } finally {
      setVotingOn(null);
    }
  };

  const getCreatorLabel = (creatorObj?: ProposalCreator) => {
    if (!creatorObj || !creatorObj.displayName) return "Unknown User";
    let orgRole = "Member";
    if (creatorObj.memberships && creatorObj.memberships.length > 0 && activeOrgId) {
      const activeMembership = creatorObj.memberships.find((m) => {
        const orgId = typeof m.organization === "string" ? m.organization : m.organization?._id;
        return orgId === activeOrgId;
      });
      if (activeMembership && activeMembership.role) {
        orgRole = activeMembership.role;
      }
    }
    return `${creatorObj.displayName} (${orgRole})`;
  };

  const handleAiInsight = async (proposal: Proposal) => {
    setShowAiModal(proposal._id);
    setIsAnalyzing(true);
    setAiInsight(null);
    try {
      const res = await api.post<AiInsightData>("/ai/analyze-proposal", {
        title: proposal.title,
        description: proposal.description,
        amount: proposal.amount,
        currentBudget: treasuryBalance
      });
      setAiInsight(res.data);
    } catch (err: unknown) {
      console.error("AI Insight error:", err);
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const errMsg = axiosErr.response?.data?.error || "Failed to generate AI insights";
      toast.error(errMsg);
      setShowAiModal(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [executingId, setExecutingId] = useState<string | null>(null);
  const [proposalToExecute, setProposalToExecute] = useState<Proposal | null>(null);

  const handleExecute = (p: Proposal) => {
    setProposalToExecute(p);
  };

  const confirmExecute = async () => {
    if (!proposalToExecute) return;
    const p = proposalToExecute;
    setExecutingId(p._id);
    try {
      await api.post(`/dao/proposals/${p._id}/execute`);
      toast.success("Proposal executed successfully! 🎉");
      setProposalToExecute(null);
      await refreshProposals();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to execute proposal."));
    } finally {
      setExecutingId(null);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeOrgId) return;
    setIsSubmitting(true);
    try {
      const res = await api.post<CreateProposalResponse>("/dao/proposals", {
        orgId: activeOrgId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        amount: Number(formData.amount)
      });
      setProposals((prev) => [res.data.proposal, ...prev]);
      setShowCreateModal(false);
      setFormData({ title: "", description: "", amount: "" });
      toast.success("Proposal created successfully!");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create proposal"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const memberships = (user?.memberships || []) as ProposalMemberMembership[];
  const userMembership = memberships.find((m) => {
    const orgId = typeof m.organization === "string" ? m.organization : m.organization?._id;
    return orgId === activeOrgId;
  });
  const canCreate = Boolean(user?.isSuperAdmin || (userMembership && (userMembership.roleLevel || 4) <= 2));
  const canVote = Boolean(user?.isSuperAdmin || (userMembership && (userMembership.roleLevel || 4) <= 3));

  // Tally counts for filter tabs
  const activeCount = proposals.filter((p) => p.status === "active").length;
  const passedCount = proposals.filter((p) => p.status === "passed").length;
  const rejectedCount = proposals.filter((p) => p.status === "rejected").length;

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
              Decentralized Governance
            </span>
            <span className="text-[11px] text-zinc-500">1 Member = 1 Vote</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Vote className="w-6 h-6 text-zinc-300" />
            DAO Governance
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-2xl">
            Community-driven voting for organizational resource allocation, policy updates, and treasury expenditures.
          </p>
        </div>

        {canCreate && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Proposal
          </button>
        )}
      </div>

      {/* ── Segmented Control & Search Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#121215] p-2 rounded-xl border border-zinc-800">
        {/* Segmented Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-0.5 custom-scrollbar">
          {[
            { id: "active", label: "Active", count: activeCount },
            { id: "all", label: "All Proposals", count: proposals.length },
            { id: "passed", label: "Passed", count: passedCount },
            { id: "rejected", label: "Rejected", count: rejectedCount },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-zinc-800 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? "bg-zinc-700 text-white font-semibold" : "bg-zinc-800/60 text-zinc-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search proposals by title..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 text-white rounded-lg pl-8.5 pr-3 py-1.5 text-xs placeholder:text-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* ── Proposals Grid ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProposals.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-[#121215] rounded-xl border border-zinc-800 p-8">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500">
                  <Vote className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">No proposals found</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  There are currently no {activeFilter !== "all" ? activeFilter : ""} proposals matching your filter.
                </p>
                {canCreate && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium"
                  >
                    Create the first proposal <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              filteredProposals.slice(0, visibleCount).map((p) => {
                const totalVotes = (p.yesVotes ?? 0) + (p.noVotes ?? 0);
                const yesPercent = totalVotes > 0 ? Math.round(((p.yesVotes ?? 0) / totalVotes) * 100) : 50;
                const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;

                return (
                  <div 
                    key={p._id} 
                    className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 p-4.5 rounded-xl transition-all shadow-xs flex flex-col justify-between group"
                  >
                    <div>
                      {/* Status + On-chain pill */}
                      <div className="flex justify-between items-center mb-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          p.status === "active" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          p.status === "passed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          p.status === "executed" ? "bg-zinc-800 text-zinc-300 border-zinc-700" :
                          "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === "active" ? "bg-amber-400" :
                            p.status === "passed" ? "bg-emerald-400" :
                            p.status === "executed" ? "bg-zinc-300" :
                            "bg-rose-400"
                          }`} />
                          {p.status}
                        </span>

                        {p.blockchainProposalId && (
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono font-medium bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                            <Link2 className="w-2.5 h-2.5 text-zinc-500" /> Polygon #{p.blockchainProposalId}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-sm font-semibold text-white mb-1.5 leading-snug line-clamp-2 transition-colors">
                        {p.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mb-3.5 line-clamp-3 leading-relaxed">
                        {p.description}
                      </p>

                      {/* Deadline */}
                      {formatDeadline(p.endTime) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-3 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md w-fit">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{formatDeadline(p.endTime)}</span>
                        </div>
                      )}

                      {/* Meta Box (Amount & Proposer) */}
                      <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg mb-3.5 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500">Requested Amount</span>
                          <span className="font-mono font-semibold text-white text-sm">
                            ₱{p.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-zinc-800/80 pt-1.5">
                          <span className="text-zinc-500">Proposed By</span>
                          <span className="font-medium text-zinc-300 truncate max-w-44 text-right">
                            {getCreatorLabel(p.creator)}
                          </span>
                        </div>
                      </div>

                      {/* Voting Tally Progress Meter */}
                      <div className="mb-3.5 space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-emerald-400 flex items-center gap-1">
                            Yes: <strong>{p.yesVotes ?? 0}</strong> ({totalVotes > 0 ? yesPercent : 0}%)
                          </span>
                          <span className="text-zinc-400 flex items-center gap-1">
                            No: <strong>{p.noVotes ?? 0}</strong> ({totalVotes > 0 ? noPercent : 0}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${totalVotes > 0 ? yesPercent : 50}%` }} 
                            className="bg-emerald-500 transition-all duration-300" 
                          />
                          <div 
                            style={{ width: `${totalVotes > 0 ? noPercent : 50}%` }} 
                            className="bg-zinc-600 transition-all duration-300" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      {/* AI Risk Analysis Button */}
                      <button
                        onClick={() => handleAiInsight(p)}
                        className="w-full flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> AI Risk Analysis
                      </button>

                      {/* Execute Button for Passed proposals */}
                      {p.status === "passed" && canCreate && (
                        <button
                          onClick={() => handleExecute(p)}
                          disabled={executingId === p._id}
                          className="w-full py-2 px-4 rounded-lg btn-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {executingId === p._id ? "Executing..." : "Execute Proposal"}
                        </button>
                      )}

                      {/* Vote Buttons */}
                      {p.status === "active" && !p.hasVoted && canVote && (
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => handleVote(p, true)}
                            disabled={votingOn === p._id}
                            className="py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            {votingOn === p._id ? "..." : "Vote Yes"}
                          </button>
                          <button 
                            onClick={() => handleVote(p, false)}
                            disabled={votingOn === p._id}
                            className="py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            {votingOn === p._id ? "..." : "Vote No"}
                          </button>
                        </div>
                      )}

                      {p.hasVoted && (
                        <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-center py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> You already voted
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load More Button */}
          {filteredProposals.length > visibleCount && (
            <div className="flex justify-center mt-6 w-full">
              <button
                onClick={() => setVisibleCount((prev) => prev + 6)}
                className="px-5 py-2 rounded-lg border border-zinc-800 bg-[#121215] hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all font-medium text-xs flex items-center gap-2 cursor-pointer"
              >
                Load More Proposals
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Create Proposal Modal ── */}
      {showCreateModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121215] rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-lg p-5 md:p-6 overflow-hidden flex flex-col text-white" style={{ maxHeight: "90vh" }}>
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Create Governance Proposal</h2>
                    <p className="text-[11px] text-zinc-400">Submit a new initiative for member voting</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProposal} className="space-y-3.5 overflow-y-auto pr-1 custom-scrollbar">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Proposal Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input"
                    placeholder="e.g. Upgrade College Laboratory Audio System"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Requested Amount (PHP)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input font-mono"
                    placeholder="25000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Rationale &amp; Objectives
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input resize-none"
                    placeholder="Explain why this proposal is needed and how the funds will be utilized..."
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 mt-auto border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating..." : "Submit Proposal"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* ── AI Insights Modal ── */}
      {showAiModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121215] rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-lg p-5 md:p-6 overflow-hidden flex flex-col text-white" style={{ maxHeight: "90vh" }}>
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                    <BrainCircuit className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">AI Financial Risk Intelligence</h2>
                    <p className="text-[11px] text-zinc-400">Autonomous analysis of budgetary impact</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiModal(null)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto pr-1 custom-scrollbar space-y-3.5">
                {isAnalyzing ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="relative w-12 h-12 mb-3">
                      <div className="absolute inset-0 border-2 border-zinc-800 rounded-full" />
                      <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <BrainCircuit className="absolute inset-0 m-auto w-4 h-4 text-zinc-400 animate-pulse" />
                    </div>
                    <h3 className="text-xs font-semibold text-white">Evaluating Proposal Risk</h3>
                    <p className="text-[11px] text-zinc-500 max-w-xs mt-1">Cross-referencing requested amount against treasury balance and burn rate...</p>
                  </div>
                ) : aiInsight ? (
                  <div className="animate-fade-in space-y-3.5">
                    {/* Risk Score Pill */}
                    <div className="flex items-center gap-3 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-mono font-bold shrink-0 border ${
                        aiInsight.riskScore <= 3 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                        aiInsight.riskScore <= 6 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                        "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}>
                        {aiInsight.riskScore}/10
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Risk Score</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">{aiInsight.riskReason}</p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" /> Executive Summary
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        {aiInsight.summary}
                      </p>
                    </div>

                    {/* Pros & Cons */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-emerald-500/[0.04] border border-emerald-500/20 p-3 rounded-lg">
                        <h4 className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pros
                        </h4>
                        <ul className="space-y-1">
                          {aiInsight.pros?.map((pro, i) => (
                            <li key={i} className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug">
                              <span className="text-emerald-400 shrink-0">•</span> <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-rose-500/[0.04] border border-rose-500/20 p-3 rounded-lg">
                        <h4 className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Cons
                        </h4>
                        <ul className="space-y-1">
                          {aiInsight.cons?.map((con, i) => (
                            <li key={i} className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug">
                              <span className="text-rose-400 shrink-0">•</span> <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-rose-400 py-6 text-xs">Failed to load AI insights.</div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Vote Confirmation Modal ── */}
      {pendingVote && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121215] rounded-xl shadow-xl border border-zinc-800 w-full max-w-sm p-5 flex flex-col gap-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  pendingVote.support 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  <Vote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-xs">Confirm On-Chain Vote</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">This transaction is irreversible on Polygon.</p>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-[10px] text-zinc-500 mb-1">Proposal</p>
                <p className="text-xs font-semibold text-white line-clamp-2">{pendingVote.proposal.title}</p>
                <p className={`text-xs mt-2 font-bold tracking-wide uppercase ${
                  pendingVote.support ? "text-emerald-400" : "text-rose-400"
                }`}>
                  Your Decision: {pendingVote.support ? "✓ YES (In Support)" : "✗ NO (Against)"}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPendingVote(null)}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmVote}
                  className={`flex-1 px-3 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer ${
                    pendingVote.support 
                      ? "bg-emerald-600 hover:bg-emerald-500" 
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  Confirm {pendingVote.support ? "Yes" : "No"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Execute Proposal Confirmation Modal ── */}
      <ConfirmModal
        isOpen={Boolean(proposalToExecute)}
        title="Execute Proposal On-Chain"
        message={`Are you sure you want to execute proposal "${proposalToExecute?.title}" on-chain? This will execute authorized disbursements and record final DAO governance states on Polygon Amoy.`}
        confirmText="Execute On-Chain"
        variant="primary"
        isLoading={Boolean(executingId)}
        onConfirm={confirmExecute}
        onCancel={() => setProposalToExecute(null)}
      />
    </div>
  );
}
