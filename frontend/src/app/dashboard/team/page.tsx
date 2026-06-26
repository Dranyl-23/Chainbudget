"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Users, Plus, X, Trash2, Shield, User as UserIcon } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import TableSkeleton from "@/components/TableSkeleton";

interface Member {
  _id: string;
  walletAddress: string;
  displayName?: string;
  memberships: {
    organization: string;
    roleLevel: number;
    roleLabel: string;
    isActive: boolean;
  }[];
}

export default function TeamPage() {
  const { user, activeOrgId } = useAuth();
  const [members, setMembers] = useState<Member[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_team");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [loading, setLoading] = useState(members.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    walletAddress: "",
    displayName: "",
    roleLevel: 3,
    roleLabel: "",
  });

  const orgId = activeOrgId;
  
  // Current user's role level in this org
  const currentUserRole = user?.memberships?.find(
    (m: any) => (typeof m.organization === "string" ? m.organization : m.organization?._id) === orgId
  )?.roleLevel || 4;

  const canManage = currentUserRole === 1;

  const fetchMembers = async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/users/${orgId}/members`);
      const data = res.data || [];
      setMembers(data);
      sessionStorage.setItem("cb_cache_team", JSON.stringify(data));
    } catch (err) {
      console.error("Failed to fetch members:", err);
      setError("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [orgId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.walletAddress.trim()) {
      setError("Wallet address is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/users/${orgId}/invite`, {
        walletAddress: formData.walletAddress,
        displayName: formData.displayName,
        roleLevel: Number(formData.roleLevel),
        roleLabel: formData.roleLabel || "Member",
      });
      setShowAddModal(false);
      setFormData({ walletAddress: "", displayName: "", roleLevel: 3, roleLabel: "" });
      fetchMembers(); // Refresh the list
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await api.delete(`/users/${orgId}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m._id !== userId));
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to remove member.");
    }
  };

  const getRoleBadge = (level: number) => {
    switch (level) {
      case 1: return <span className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">Level 1: Executive</span>;
      case 2: return <span className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">Level 2: Finance</span>;
      case 3: return <span className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600 border border-green-200">Level 3: Request</span>;
      case 4: return <span className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Level 4: Read-Only</span>;
      default: return null;
    }
  };

  return (
    <>
      <div className="p-4 md:p-8 pb-20 animate-fade-in">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Team Management</h1>
          <p className="text-sm text-gray-500">View and manage organization members and their roles.</p>
        </div>
        {canManage && (
          <button className="btn-primary py-2" onClick={() => { setShowAddModal(true); setError(null); }}>
            <Plus className="w-4 h-4" /> Add Member
          </button>
        )}
      </header>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="glass rounded-xl overflow-hidden border border-[var(--color-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role Access</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position/Label</th>
                  {canManage && <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1, 2, 3, 4].map(level => {
                  const levelMembers = members.filter(member => {
                    const membership = member.memberships.find(
                      (m) => (typeof m.organization === "string" ? m.organization : (m.organization as any)?._id) === orgId
                    );
                    return (membership?.roleLevel || 4) === level;
                  });

                  if (levelMembers.length === 0) return null;

                  const levelTitles: Record<number, string> = {
                    1: "Executive Approvers (Level 1)",
                    2: "Finance / Transaction Officers (Level 2)",
                    3: "Members / Contributors (Level 3)",
                    4: "Public Viewers (Level 4)"
                  };

                  return (
                    <React.Fragment key={`level-${level}`}>
                      <tr className="bg-gray-50/80 border-y border-gray-100">
                        <td colSpan={canManage ? 4 : 3} className="px-4 py-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
                          {levelTitles[level]}
                        </td>
                      </tr>
                      {levelMembers.map((member) => {
                        const membership = member.memberships.find(
                          (m) => (typeof m.organization === "string" ? m.organization : (m.organization as any)?._id) === orgId
                        );
                        const isSelf = member._id === user?.id || member._id === (user as any)?._id;

                        return (
                          <tr key={member._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                                  {level === 1 ? <Shield className="w-5 h-5 text-primary" /> : <UserIcon className="w-5 h-5 text-gray-500" />}
                                </div>
                                <div>
                                  <p className="font-mono text-sm font-medium text-gray-900">
                                    {member.walletAddress.slice(0, 6)}...{member.walletAddress.slice(-4)}
                                    {isSelf && <span className="ml-2 text-xs text-primary font-semibold">(You)</span>}
                                  </p>
                                  {member.displayName && <p className="text-xs text-gray-500">{member.displayName}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {getRoleBadge(level)}
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-600 font-medium">
                                {membership?.roleLabel || "Member"}
                              </span>
                            </td>
                            {canManage && (
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleRemoveMember(member._id)}
                                  disabled={isSelf} // Don't allow removing yourself to prevent lockout
                                  className={`p-2 rounded-lg transition-colors ${
                                    isSelf ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-danger hover:bg-danger/10"
                                  }`}
                                  title={isSelf ? "Cannot remove yourself" : "Remove member"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="p-8 text-center text-gray-500">
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>

      {/* ── Add Member Modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="glass rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add Team Member</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary/10 text-gray-500 hover:text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm text-danger border border-danger/20 bg-danger/10">
                {error}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              {/* Wallet Address */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="input font-mono text-sm"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                  required
                />
              </div>

              {/* Name (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Alfie Lynard"
                  className="input text-sm"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                />
              </div>

              {/* Role Level */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Access Level</label>
                <select
                  className="input"
                  value={formData.roleLevel}
                  onChange={(e) => setFormData({ ...formData, roleLevel: Number(e.target.value) })}
                >
                  <option value={1}>Level 1: Executive Approver</option>
                  <option value={2}>Level 2: Finance / Transaction Officer</option>
                  <option value={3}>Level 3: Member / Contributor</option>
                  <option value={4}>Level 4: Public Viewer</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Level 1 is required for multi-sig approvals.
                </p>
              </div>

              {/* Role Label */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Position / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Treasurer, Secretary"
                  className="input"
                  value={formData.roleLabel}
                  onChange={(e) => setFormData({ ...formData, roleLabel: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="btn-secondary flex-1 py-2.5"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 py-2.5"
                >
                  {isSubmitting ? "Saving..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
