"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Vote, CheckCircle2, XCircle, Clock, Search, Link2, X, Sparkles, BrainCircuit, Info, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import Portal from "@/components/Portal";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import TableSkeleton from "@/components/TableSkeleton";

interface Proposal {
  _id: string;
  title: string;
  description: string;
  amount: number;
  status: "active" | "passed" | "rejected" | "executed";
  endTime: string;
  creator: { 
    displayName: string;
    memberships?: any[];
  };
  blockchainProposalId?: number;
  yesVotes?: number;
  noVotes?: number;
  hasVoted?: boolean;
  votesList?: {
    support: boolean;
    voter: {
      displayName: string;
      memberships?: any[];
    }
  }[];
}

export default function DAOGovernancePage() {
  const { user, activeOrgId, isConnected } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dao");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [loading, setLoading] = useState(proposals.length === 0);
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
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(6);
  }, [activeFilter, searchQuery]);

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

  useEffect(() => {
    fetchProposals();

    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || "http://localhost:5000";
    const socket = io(socketUrl);

    socket.on("dao_vote_updated", (data) => {
      // Auto-refresh when someone votes
      fetchProposals();
    });

    return () => {
      socket.disconnect();
    };
  }, [activeOrgId]);

  const fetchProposals = async () => {
    try {
      if (!activeOrgId) return;
      const res = await api.get("/dao/proposals", { params: { orgId: activeOrgId } });
      // In a real app, we would fetch the live vote counts from the smart contract here
      const data = res.data.proposals || [];
      setProposals(data);
      sessionStorage.setItem("cb_cache_dao", JSON.stringify(data));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposal: Proposal, support: boolean) => {
    if (!isConnected) {
      toast.error("Please connect wallet first");
      return;
    }
    
    // Placeholder for actual smart contract interaction
    // await contract.castVote(proposal.blockchainProposalId, support);
    
    setVotingOn(proposal._id);
    try {
      await api.post(`/dao/proposals/${proposal._id}/vote`, { support });
      toast.success(`Vote "${support ? 'Yes' : 'No'}" cast successfully!`);
      
      // Re-fetch proposals to get updated votes list
      fetchProposals();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Voting failed");
    } finally {
      setVotingOn(null);
    }
  };

  const getCreatorLabel = (creatorObj: any) => {
    if (!creatorObj || !creatorObj.displayName) return "Unknown User";
    let orgRole = "Member";
    if (creatorObj.memberships && creatorObj.memberships.length > 0 && activeOrgId) {
      const activeMembership = creatorObj.memberships.find(
        (m: any) => (m.organization?._id || m.organization) === activeOrgId
      );
      if (activeMembership) orgRole = activeMembership.role;
    }
    return `${creatorObj.displayName} (${orgRole})`;
  };

  const currentMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === activeOrgId
  );

  const handleAiInsight = async (proposal: Proposal) => {
    setShowAiModal(proposal._id);
    setIsAnalyzing(true);
    setAiInsight(null);
    try {
      const res = await api.post("/ai/analyze-proposal", {
        title: proposal.title,
        description: proposal.description,
        amount: proposal.amount,
        currentBudget: 500000 // In a real app we fetch actual org treasury
      });
      setAiInsight(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate AI insights");
      setShowAiModal(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
    setIsSubmitting(true);
    try {
      const res = await api.post("/dao/proposals", {
        orgId: activeOrgId,
        title: formData.title,
        description: formData.description,
        amount: Number(formData.amount)
      });
      setProposals([res.data.proposal, ...proposals]);
      setShowCreateModal(false);
      setFormData({ title: "", description: "", amount: "" });
      toast.success("Proposal created successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create proposal");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center animate-pulse text-gray-500">Loading Governance...</div>;
  }

  const membership = user?.memberships?.find((m: any) => 
    m.organization === activeOrgId || m.organization?._id === activeOrgId
  );
  const canInteract = user?.isSuperAdmin || (membership && membership.roleLevel <= 3);

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
            <Vote className="w-8 h-8 text-primary" />
            DAO Governance
          </h1>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Decentralized voting for major organizational decisions. 1 Member = 1 Vote.
          </p>
        </div>
        {canInteract && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="hidden md:flex btn-primary items-center gap-2 flex-shrink-0"
          >
            <ShieldCheck className="w-4 h-4" /> Create Proposal
          </button>
        )}
      </div>

      {/* ── Filters & Desktop Search ── */}
      <div className="sticky top-0 md:static z-30 flex flex-row items-center justify-between w-[calc(100%+2rem)] md:w-auto -mx-4 md:mx-0 pointer-events-none pb-2 md:pb-0">
        
        {/* Tabs */}
        <div className="w-full md:w-auto glass border-x-0 md:border-x md:rounded-xl p-2 px-4 md:px-2 backdrop-blur-xl shadow-sm md:shadow-none pointer-events-auto">
          <div className="flex w-full gap-1 bg-gray-100 dark:bg-black/20 p-1 rounded-lg overflow-x-auto custom-scrollbar">
            {["active", "all", "passed", "rejected"].map((status) => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all whitespace-nowrap text-center ${
                  activeFilter === status 
                    ? "bg-primary text-white shadow-lg" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:block relative w-64 glass rounded-xl p-1.5 backdrop-blur-xl pointer-events-auto mr-4 md:mr-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden relative w-full glass rounded-xl p-2 backdrop-blur-xl">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search proposals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* ── Active Proposals Grid ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProposals.length === 0 ? (
            <div className="col-span-full py-16 text-center text-gray-500 glass rounded-2xl">
              <Vote className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No {activeFilter !== "all" ? activeFilter : ""} proposals found.</p>
            </div>
          ) : (
            filteredProposals.slice(0, visibleCount).map(p => (
            <div key={p._id} className="glass p-3.5 md:p-6 rounded-xl md:rounded-2xl flex flex-col hover:-translate-y-1 transition-transform duration-300">
              <div className="flex justify-between items-start mb-2 md:mb-4">
                <span className={`badge text-[10px] md:text-xs px-2 py-0.5 md:py-1 ${p.status === 'active' ? 'badge-pending' : p.status === 'passed' ? 'badge-approved' : 'badge-rejected'}`}>
                  {p.status.toUpperCase()}
                </span>
                {p.blockchainProposalId && (
                  <span className="text-[9px] md:text-xs text-primary flex items-center gap-1 font-medium bg-primary/10 px-2 py-0.5 md:py-1 rounded-full">
                    <Link2 className="w-3 h-3" /> On-Chain
                  </span>
                )}
              </div>
                
                <h3 className="text-sm md:text-lg font-bold text-gray-800 mb-1 leading-tight line-clamp-2 md:line-clamp-none">{p.title}</h3>
                <p className="text-[11px] md:text-sm text-gray-500 mb-3 md:mb-4 line-clamp-2 md:line-clamp-3 flex-1">{p.description}</p>
                
                <div className="bg-gray-50/50 dark:bg-gray-800/30 p-2.5 md:p-4 rounded-xl mb-3 md:mb-6">
                  <div className="flex justify-between items-center mb-1 md:mb-2">
                    <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">Requested Amount</span>
                    <span className="text-xs md:text-sm font-bold text-primary dark:text-primary/90">₱{p.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">Proposed By</span>
                    <span className="text-[10px] md:text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[130px] md:max-w-none text-right">{getCreatorLabel(p.creator)}</span>
                  </div>
                </div>

                {/* ── AI Insights Button ── */}
                <button
                  onClick={() => handleAiInsight(p)}
                  className="w-full mb-3 md:mb-4 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 py-1.5 md:py-2 rounded-xl text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Risk Analysis
                </button>

                {p.status === "active" && !p.hasVoted && canInteract && (
                  <div className="grid grid-cols-2 gap-2 md:gap-3 mt-auto">
                    <button 
                      onClick={() => handleVote(p, true)}
                      disabled={votingOn === p._id}
                      className="btn-primary bg-emerald-500 hover:bg-emerald-600 border-none w-full py-1.5 md:py-2.5 text-[11px] md:text-base dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      {votingOn === p._id ? "..." : "Vote Yes"}
                    </button>
                    <button 
                      onClick={() => handleVote(p, false)}
                      disabled={votingOn === p._id}
                      className="btn-outline border-red-200 text-red-600 hover:bg-red-50 w-full py-1.5 md:py-2.5 text-[11px] md:text-base dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {votingOn === p._id ? "..." : "Vote No"}
                    </button>
                  </div>
                )}

                {p.hasVoted && (
                  <div className="mt-auto bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-center py-2 rounded-xl text-xs md:text-sm font-medium flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> You have already voted
                  </div>
                )}

                {/* Display Voters Count Only */}
                <div className="mt-3 pt-3 md:mt-4 md:pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-2 md:gap-4">
                  <div className="flex-1 bg-emerald-50/50 dark:bg-emerald-900/20 py-1.5 px-2 md:p-2 rounded-lg text-center border border-emerald-100/50 dark:border-emerald-800/30">
                    <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5 md:mb-1">Yes Votes</span>
                    <span className="text-lg md:text-xl font-bold text-emerald-700 dark:text-emerald-300">{p.yesVotes}</span>
                  </div>
                  <div className="flex-1 bg-red-50/50 dark:bg-red-900/20 py-1.5 px-2 md:p-2 rounded-lg text-center border border-red-100/50 dark:border-red-800/30">
                    <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 block mb-0.5 md:mb-1">No Votes</span>
                    <span className="text-lg md:text-xl font-bold text-red-700 dark:text-red-300">{p.noVotes}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More Button */}
        {filteredProposals.length > visibleCount && (
          <div className="flex justify-center mt-8 w-full">
            <button
              onClick={() => setVisibleCount(prev => prev + 6)}
              className="px-8 py-3 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-semibold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.1)] hover:-translate-y-1"
            >
              Load More Proposals
            </button>
          </div>
        )}
      </>
      )}

      {/* ── Mobile FAB for Create Proposal ── */}
      {canInteract && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="md:hidden fixed bottom-[90px] right-4 w-14 h-14 bg-primary text-white rounded-full shadow-[0_4px_20px_rgba(139,92,246,0.6)] flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-transform"
        >
          <ShieldCheck className="w-6 h-6" />
        </button>
      )}

      {/* ── Create Proposal Modal ── */}
      {showCreateModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-hidden flex flex-col relative" style={{ maxHeight: '90vh' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Create Proposal
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProposal} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="e.g. Upgrade Sound System"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="25000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Why is this proposal necessary?"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 mt-auto">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="glass rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.15)] border border-purple-500/20 w-full max-w-lg p-6 overflow-hidden flex flex-col relative" style={{ maxHeight: '90vh' }}>
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <BrainCircuit className="w-6 h-6 text-purple-400" />
                  AI Risk Analysis
                </h2>
                <button
                  onClick={() => setShowAiModal(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 custom-scrollbar space-y-5">
                {isAnalyzing ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <BrainCircuit className="absolute inset-0 m-auto w-6 h-6 text-purple-400 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-200">Analyzing Proposal</h3>
                    <p className="text-sm text-gray-400 max-w-[250px] mx-auto mt-2">Our AI is reading the details and calculating the financial risk...</p>
                  </div>
                ) : aiInsight ? (
                  <div className="animate-fade-in space-y-5">
                    {/* Risk Score */}
                    <div className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shrink-0 shadow-lg ${
                        aiInsight.riskScore <= 3 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                        aiInsight.riskScore <= 6 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                        "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}>
                        {aiInsight.riskScore}/10
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-200">Risk Score</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{aiInsight.riskReason}</p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" /> Summary
                      </h4>
                      <p className="text-sm text-gray-200 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">{aiInsight.summary}</p>
                    </div>

                    {/* Pros & Cons */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pros
                        </h4>
                        <ul className="space-y-2">
                          {aiInsight.pros?.map((pro: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                              <span className="text-emerald-500 mt-0.5">•</span> <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Cons
                        </h4>
                        <ul className="space-y-2">
                          {aiInsight.cons?.map((con: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                              <span className="text-red-500 mt-0.5">•</span> <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-red-400 py-8">Failed to load insights.</div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
