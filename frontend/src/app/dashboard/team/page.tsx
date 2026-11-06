"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Trash2, Shield, User as UserIcon, Crown, CheckCircle2, Eye, Edit2 } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import TableSkeleton from "@/components/TableSkeleton";
import axios from "axios";
import ConfirmModal from "@/components/ConfirmModal";
import { getErrorMessage } from "@/lib/utils";
import CustomSelect, { CustomSelectOption } from "@/components/CustomSelect";

const ACCESS_LEVEL_OPTIONS: CustomSelectOption[] = [
  { value: "1", label: "Level 1: Executive Approver", hint: "Required for multi-sig approvals" },
  { value: "2", label: "Level 2: Finance / Transaction Officer", hint: "Create and submit proposals" },
  { value: "3", label: "Level 3: Member / Contributor", hint: "View & participate in discussions" },
  { value: "4", label: "Level 4: Public Viewer", hint: "Read-only access" },
];

// ── Types ────────────────────────────────────────────────────────────────────
interface UserOrgRef {
  _id?: string;
  name?: string;
}

interface UserMembership {
  organization?: string | UserOrgRef;
  roleLevel: number;
  roleLabel?: string;
  isActive?: boolean;
}

interface MemberMembership {
  organization: string | UserOrgRef;
  roleLevel: number;
  roleLabel: string;
  isActive: boolean;
}

interface Member {
  _id: string;
  walletAddress: string;
  displayName?: string;
  email?: string;
  memberships: MemberMembership[];
}

interface UserLookupResponse {
  _id?: string;
  displayName?: string;
  email?: string;
  walletAddress?: string;
}

interface AddMemberFormData {
  walletAddress: string;
  displayName: string;
  email: string;
  roleLevel: number;
  roleLabel: string;
}

function getOrgId(org: string | UserOrgRef | undefined): string | undefined {
  if (!org) return undefined;
  return typeof org === "string" ? org : org._id;
}

export default function TeamPage() {
  const { user, activeOrgId } = useAuth();
  const [members, setMembers] = useState<Member[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_team");
      if (cached) {
        try {
          return JSON.parse(cached) as Member[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("cb_cache_team");
  });
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit role modal state
  const [editingMember, setEditingMember] = useState<{ member: Member; roleLevel: number; roleLabel: string } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [formData, setFormData] = useState<AddMemberFormData>({
    walletAddress: "",
    displayName: "",
    email: "",
    roleLevel: 3,
    roleLabel: "",
  });

  const orgId = activeOrgId;
  
  // Current user's role level in this org
  const memberships = (user?.memberships || []) as UserMembership[];
  const currentUserRole = memberships.find(
    (m) => getOrgId(m.organization) === orgId
  )?.roleLevel || 4;

  const canManage = currentUserRole === 1;

  const refreshMembers = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api.get<Member[]>(`/users/${orgId}/members`);
      const data = res.data || [];
      setMembers(data);
      sessionStorage.setItem("cb_cache_team", JSON.stringify(data));
    } catch (err: unknown) {
      console.error("Failed to refresh members:", err);
    }
  }, [orgId]);

  // ── Data Fetching Effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;

    let isCancelled = false;

    const loadMembers = async () => {
      try {
        const res = await api.get<Member[]>(`/users/${orgId}/members`);
        const data = res.data || [];
        if (!isCancelled) {
          setMembers(data);
          sessionStorage.setItem("cb_cache_team", JSON.stringify(data));
        }
      } catch (err: unknown) {
        console.error("Failed to fetch members:", err);
        if (!isCancelled) {
          setError("Failed to load team members.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [orgId]);

  // ── Lookup Identifier (Declared BEFORE debounced effect) ──────────────────
  const checkIdentifier = useCallback(async (endpoint: string) => {
    try {
      // Use api directly — HttpOnly cookie auth is handled automatically by the axios instance
      const res = await api.get<UserLookupResponse>(endpoint);
      if (res.data) {
        const fetchedName = res.data.displayName === "New User" ? "" : res.data.displayName;
        toast.success(`Found User: ${fetchedName || res.data.email || res.data.walletAddress || "Unknown"}`);
        setFormData((prev) => ({
          ...prev,
          displayName: prev.displayName || fetchedName || "",
        }));
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status !== 404) {
        console.error("Error fetching user", err);
      }
    }
  }, []);

  // ── Debounced Identifier Check Effect ─────────────────────────────────────
  useEffect(() => {
    const identifier = formData.email.trim();
    if (!identifier) return;

    const timeoutId = setTimeout(() => {
      if (identifier.startsWith("0x") && identifier.length === 42) {
        checkIdentifier(`/users/by-wallet/${identifier}`);
      } else if (identifier.includes("@")) {
        checkIdentifier(`/users/by-email/${encodeURIComponent(identifier)}`);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.email, checkIdentifier]);

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      setError("Email or Wallet Address is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/users/${orgId}/invite`, {
        identifier: formData.email.trim(),
        displayName: formData.displayName,
        roleLevel: Number(formData.roleLevel),
        roleLabel: formData.roleLabel || "Member",
      });
      setShowAddModal(false);
      setFormData({ walletAddress: "", displayName: "", email: "", roleLevel: 3, roleLabel: "" });
      await refreshMembers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add member."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditRole = (member: Member) => {
    const membership = member.memberships.find(
      (m) => getOrgId(m.organization) === orgId
    );
    setEditingMember({
      member,
      roleLevel: membership?.roleLevel || 3,
      roleLabel: membership?.roleLabel || ""
    });
  };

  const handleUpdateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember || !orgId) return;

    setIsUpdatingRole(true);
    try {
      await api.put(`/users/${orgId}/members/${editingMember.member._id}/role`, {
        roleLevel: Number(editingMember.roleLevel),
        roleLabel: editingMember.roleLabel
      });
      toast.success("Member role updated successfully!");
      setEditingMember(null);
      await refreshMembers();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update member role."));
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const handleRemoveMember = (member: Member) => {
    setMemberToRemove(member);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    try {
      await api.delete(`/users/${orgId}/members/${memberToRemove._id}`);
      setMembers((prev) => prev.filter((m) => m._id !== memberToRemove._id));
      toast.success("Member removed");
      setMemberToRemove(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to remove member."));
    } finally {
      setIsRemovingMember(false);
    }
  };

  const getRoleBadge = (level: number) => {
    switch (level) {
      case 1: return <span className="whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-white text-[10px] font-medium tracking-wide uppercase"><Crown className="w-3 h-3" /> Super Admin</span>;
      case 2: return <span className="whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700/80 bg-zinc-850 text-zinc-200 text-[10px] font-medium tracking-wide uppercase"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Approver</span>;
      case 3: return <span className="whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 text-[10px] font-medium tracking-wide uppercase"><UserIcon className="w-3 h-3" /> Member</span>;
      case 4: return <span className="whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/60 text-zinc-400 text-[10px] font-medium tracking-wide uppercase"><Eye className="w-3 h-3" /> Public</span>;
      default: return null;
    }
  };

  const currentUserId = user?.id;

  return (
    <>
      <div className="p-4 md:p-6 pb-20 animate-fade-in max-w-7xl mx-auto space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-zinc-400" />
            Team Management
          </h1>
          <p className="text-xs text-zinc-400 mt-1">View and manage organization members, permissions, and roles.</p>
        </div>
        {canManage && (
          <button className="btn-primary py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5" onClick={() => { setShowAddModal(true); setError(null); }}>
            <Plus className="w-3.5 h-3.5" /> Add Member
          </button>
        )}
      </header>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="bg-[#121215] rounded-xl overflow-hidden border border-zinc-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0e0e11] border-b border-zinc-800">
                  <th className="p-3.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Member</th>
                  <th className="p-3.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Role Access</th>
                  <th className="p-3.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Position/Label</th>
                  {canManage && <th className="p-3.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {[1, 2, 3, 4].map((level) => {
                  const levelMembers = members.filter((member) => {
                    const membership = member.memberships.find(
                      (m) => getOrgId(m.organization) === orgId
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
                      <tr className="bg-zinc-900/40 border-y border-zinc-800">
                        <td colSpan={canManage ? 4 : 3} className="px-4 py-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                          {levelTitles[level]}
                        </td>
                      </tr>
                      {levelMembers.map((member) => {
                        const membership = member.memberships.find(
                          (m) => getOrgId(m.organization) === orgId
                        );
                        const isSelf = Boolean(currentUserId && member._id === currentUserId);

                        return (
                          <tr key={member._id} className="hover:bg-zinc-900/50 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                                  {level === 1 ? <Shield className="w-3.5 h-3.5 text-zinc-300" /> : <UserIcon className="w-3.5 h-3.5 text-zinc-400" />}
                                </div>
                                <div>
                                  <p className="font-mono text-xs font-medium text-zinc-200">
                                    {member.walletAddress ? `${member.walletAddress.slice(0, 6)}...${member.walletAddress.slice(-4)}` : "No Wallet"}
                                    {isSelf && <span className="ml-1.5 text-[10px] text-zinc-400 font-medium uppercase tracking-wider">(You)</span>}
                                  </p>
                                  {member.displayName && <p className="text-[11px] text-zinc-500">{member.displayName}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              {getRoleBadge(level)}
                            </td>
                            <td className="p-3.5">
                              <span className="text-xs text-zinc-300 font-medium">
                                {membership?.roleLabel || "Member"}
                              </span>
                            </td>
                            {canManage && (
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenEditRole(member)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                    title="Edit member role"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMember(member)}
                                    disabled={isSelf} // Don't allow removing yourself to prevent lockout
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isSelf ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                                    }`}
                                    title={isSelf ? "Cannot remove yourself" : "Remove member"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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
                    <td colSpan={canManage ? 4 : 3} className="p-8 text-center text-zinc-500 text-xs">
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
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 md:p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Add Team Member</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg text-xs text-rose-400 border border-rose-500/20 bg-rose-500/10">
                {error}
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-3.5">
              {/* Email or Wallet Address */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Email or Wallet Address</label>
                <input
                  type="text"
                  placeholder="e.g., user@cjc.edu.ph or 0x123..."
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  We will auto-generate their Web3 wallet if they log in via email later.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Name</label>
                <input
                  type="text"
                  placeholder="e.g., Alfie Lynard"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
              </div>

              {/* Role Level */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Access Level</label>
                <CustomSelect
                  value={String(formData.roleLevel)}
                  onChange={(val) => setFormData({ ...formData, roleLevel: Number(val) })}
                  options={ACCESS_LEVEL_OPTIONS}
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Level 1 is required for multi-sig approvals.
                </p>
              </div>

              {/* Role Label */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Position / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Treasurer, Secretary"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  value={formData.roleLabel}
                  onChange={(e) => setFormData({ ...formData, roleLabel: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  className="flex-1 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Role Modal ── */}
      {editingMember && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingMember(null); }}
        >
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 md:p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Edit Member Role</h2>
              <button
                onClick={() => setEditingMember(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Editing permissions for</p>
              <p className="text-xs font-semibold text-white mt-0.5">
                {editingMember.member.displayName || editingMember.member.email || editingMember.member.walletAddress}
              </p>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-3.5">
              {/* Role Level */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Access Level</label>
                <CustomSelect
                  value={String(editingMember.roleLevel)}
                  onChange={(val) => setEditingMember({ ...editingMember, roleLevel: Number(val) })}
                  options={ACCESS_LEVEL_OPTIONS}
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Level 1 is required for multi-sig approvals.
                </p>
              </div>

              {/* Role Label */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Position / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Treasurer, Secretary"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  value={editingMember.roleLabel}
                  onChange={(e) => setEditingMember({ ...editingMember, roleLabel: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  className="flex-1 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {isUpdatingRole ? "Saving..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Remove Member Confirmation Modal ── */}
      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        title="Remove Team Member"
        message={`Are you sure you want to remove "${memberToRemove?.displayName || memberToRemove?.email || 'this member'}" from the organization? They will lose dashboard and multi-signature authorization rights.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={isRemovingMember}
        onConfirm={confirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />
    </>
  );
}
