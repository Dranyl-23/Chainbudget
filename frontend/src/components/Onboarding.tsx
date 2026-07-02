"use client";

import { useState } from "react";
import { Building, Users, Plus, ArrowRight, Shield, BarChart3, Link2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function Onboarding() {
  const { user, logout } = useAuth();
  const [step, setStep] = useState<"choose" | "create">("choose");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "student_org",
    description: "",
    highValueThreshold: 10000,
    requiredApprovals: 2,
    isPrivate: false,
  });

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post("/organizations", formData);
      // Reload to refresh user memberships and redirect to dashboard
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create organization");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-8 h-8 object-contain rounded-[8px] shadow-sm flex-shrink-0" />
            <span className="text-xl font-bold tracking-tight">
              Chain<span className="gradient-text">Budget</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.displayName || "New User"}!</h1>
          <p className="text-gray-500 text-sm">Let&apos;s get you set up. Choose how you want to get started.</p>
        </div>

        {step === "choose" ? (
          <>
            {/* Two Options */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {/* Option 1: Create Org */}
              <button
                onClick={() => setStep("create")}
                disabled={!user?.walletAddress}
                className={`glass p-6 rounded-2xl text-left transition-all group border-2 border-transparent ${
                  !user?.walletAddress 
                    ? "opacity-60 cursor-not-allowed grayscale"
                    : "hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
                }`}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-2))" }}>
                  <Building className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  Create Organization
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">
                  Set up a new organization and become its <strong className="text-primary">Level 1 Admin</strong>. You can invite members and manage budgets.
                </p>
                {!user?.walletAddress ? (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-md border border-red-100 inline-block">
                    ⚠️ Link your MetaMask wallet first
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Full Control</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Invite Members</span>
                  </div>
                )}
              </button>

              {/* Option 2: I Was Invited */}
              <div className="glass p-6 rounded-2xl text-left border-2 border-transparent">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">I Was Invited</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Your admin needs to add your <strong>wallet address</strong> to their organization via the Team page.
                </p>
                <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Share this with your admin:</p>
                  <p className="text-xs font-mono text-primary break-all select-all">
                    {user?.walletAddress || "Link your MetaMask wallet first"}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Once added, refresh this page and your organization will appear automatically.
                </p>
              </div>
            </div>

            {/* Features Preview */}
            <div className="glass rounded-2xl p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">What you&apos;ll get</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Shield className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-700">Multi-Sig Approval</p>
                  <p className="text-xs text-gray-400">2-of-N signing</p>
                </div>
                <div className="text-center">
                  <BarChart3 className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-700">Budget Tracking</p>
                  <p className="text-xs text-gray-400">Real-time reports</p>
                </div>
                <div className="text-center">
                  <Link2 className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-700">Blockchain Audit</p>
                  <p className="text-xs text-gray-400">Immutable records</p>
                </div>
              </div>
            </div>

            {/* Logout */}
            <div className="text-center mt-6">
              <button onClick={logout} className="text-sm text-gray-400 hover:text-primary transition-colors">
                Sign out and use a different account
              </button>
            </div>
          </>
        ) : (
          /* Create Organization Form */
          <div className="glass rounded-2xl p-8">
            <button
              onClick={() => setStep("choose")}
              className="text-sm text-gray-400 hover:text-primary mb-6 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-2))" }}>
                <Building className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create Your Organization</h2>
                <p className="text-xs text-gray-500">You will be assigned as Level 1: Executive Approver (Founder)</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CCIS Student Council"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="student_org">Student Org</option>
                  <option value="barangay">Barangay Fund</option>
                  <option value="homeowners_association">Homeowners Assoc</option>
                  <option value="ngo">NGO</option>
                  <option value="cooperative">Cooperative</option>
                  <option value="church">Church / Religious</option>
                  <option value="sports_club">Sports Club</option>
                  <option value="startup">Startup</option>
                  <option value="family">Family Fund</option>
                  <option value="fundraising">Fundraising</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Brief description of your organization"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">High-Value Threshold (₱)</label>
                <p className="text-xs text-gray-500 mb-2">Transactions above this amount require multi-sig approval from Level 1 members.</p>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={formData.highValueThreshold}
                  onChange={(e) => setFormData({ ...formData, highValueThreshold: Number(e.target.value) })}
                />
              </div>

              <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-800">Private Organization</label>
                  <button 
                    type="button" 
                    onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isPrivate ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  If enabled, only members can view your transaction ledger and DAO. Your organization will still be listed in the public directory.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn-primary justify-center text-sm whitespace-nowrap"
                >
                  {isSubmitting ? "Creating..." : "Create Organization →"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
