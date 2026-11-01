"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  PiggyBank, TrendingUp, TrendingDown, Plus, X, Edit2, Trash2,
  PieChart as PieChartIcon, AlertTriangle, Layers, Wallet, CheckCircle2
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "@/lib/api";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import Portal from "@/components/Portal";
import ConfirmModal from "@/components/ConfirmModal";
import axios from "axios";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────
interface BudgetCategory {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
  organization?: string;
}

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

interface AddCategoryFormData {
  name: string;
  allocated: string;
  color: string;
}

export default function BudgetPage() {
  const { user, activeOrgId } = useAuth();
  
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_budgets");
      if (cached) {
        try {
          return JSON.parse(cached) as BudgetCategory[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("cb_cache_budgets");
  });

  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<AddCategoryFormData>({
    name: "",
    allocated: "",
    color: "#3B82F6"
  });

  // Edit category state
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [editFormData, setEditFormData] = useState<AddCategoryFormData>({
    name: "",
    allocated: "",
    color: "#3B82F6"
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const DISTINCT_CATEGORY_COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EC4899", // Pink
    "#8B5CF6", // Purple
    "#06B6D4", // Cyan
    "#E11D48", // Rose
    "#84CC16", // Lime
    "#6366F1", // Indigo
    "#F97316", // Orange
  ];

  const availableColors = [
    "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6",
    "#06B6D4", "#E11D48", "#84CC16", "#6366F1", "#F97316"
  ];

  // ── Single Asynchronous Effect with Cancellation Guard ────────────────────
  useEffect(() => {
    if (!activeOrgId) return;

    let isCancelled = false;

    const loadBudgets = async () => {
      try {
        const res = await api.get<BudgetCategory[]>("/budget", {
          params: { orgId: activeOrgId },
        });
        const data = res.data || [];
        if (!isCancelled) {
          setBudgetCategories(data);
          sessionStorage.setItem("cb_cache_budgets", JSON.stringify(data));
        }
      } catch (err: unknown) {
        console.error("Failed to fetch budgets:", err);
        if (!isCancelled) {
          let msg = "Failed to load budgets";
          if (axios.isAxiosError(err)) {
            msg = err.response?.data?.error || err.message || msg;
          } else if (err instanceof Error) {
            msg = err.message;
          }
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadBudgets();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId]);

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeOrgId) return;

    if (!formData.name.trim() || !formData.allocated || isNaN(Number(formData.allocated))) {
      setError("Please fill out all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post<BudgetCategory>("/budget", {
        organizationId: activeOrgId,
        name: formData.name.trim(),
        allocated: Number(formData.allocated),
        color: formData.color,
      });
      setBudgetCategories((prev) => [...prev, res.data]);
      setShowAddModal(false);
      setFormData({ name: "", allocated: "", color: "#8B5CF6" });
      toast.success("Budget category created successfully!");
    } catch (err: unknown) {
      let msg = "Failed to create budget category.";
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.error || err.message || msg;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (cat: BudgetCategory) => {
    setEditingCategory(cat);
    setEditFormData({
      name: cat.name,
      allocated: cat.allocated.toString(),
      color: cat.color || "#8B5CF6"
    });
    setError(null);
  };

  const handleUpdateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;
    if (!editFormData.name.trim() || !editFormData.allocated || isNaN(Number(editFormData.allocated))) {
      setError("Please fill out all required fields correctly.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.put<BudgetCategory>(`/budget/${editingCategory._id}`, {
        name: editFormData.name.trim(),
        allocated: Number(editFormData.allocated),
        color: editFormData.color,
      });
      setBudgetCategories((prev) =>
        prev.map((c) => (c._id === editingCategory._id ? { ...c, ...res.data, spent: c.spent } : c))
      );
      setEditingCategory(null);
      toast.success("Budget category updated!");
    } catch (err: unknown) {
      let msg = "Failed to update category.";
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.error || err.message || msg;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteCategory = (id: string, name: string) => {
    setCategoryToDelete({ id, name });
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const { id } = categoryToDelete;
    setDeletingId(id);
    try {
      await api.delete(`/budget/${id}`);
      setBudgetCategories((prev) => prev.filter((c) => c._id !== id));
      toast.success("Budget category deleted!");
      setCategoryToDelete(null);
    } catch (err: unknown) {
      let msg = "Failed to delete category.";
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.error || err.message || msg;
      }
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const totalAllocated = budgetCategories.reduce((s, c) => s + c.allocated, 0);
  const totalSpent = budgetCategories.reduce((s, c) => s + c.spent, 0);
  const totalRemaining = Math.max(0, totalAllocated - totalSpent);
  const overallUtilization = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  // RBAC: Only Level 1 & 2 or Super Admin can add categories. Level 3 is read-only.
  const memberships = (user?.memberships || []) as UserMembership[];
  const userRoleInOrg = memberships.find((m) => {
    const orgId = typeof m.organization === "string" ? m.organization : m.organization?._id;
    return orgId === activeOrgId;
  })?.roleLevel || 4;
  const canManageBudget = user?.isSuperAdmin || userRoleInOrg <= 2;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Budget Planning & Limits
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
              Fiscal Control
            </span>
          </div>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Establish organizational department limits and enforce automated spending thresholds.
          </p>
        </div>

        {canManageBudget && (
          <button
            onClick={() => { setShowAddModal(true); setError(null); }}
            className="btn-primary py-2 px-3.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* ── Summary KPI Cards (Studio Admin Style) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Total Allocated */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="font-medium">Total Allocation</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
              {budgetCategories.length} Categories
            </span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
            ₱{totalAllocated.toLocaleString()}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-2">Approved Fiscal Allocation</p>
        </div>

        {/* Total Spent */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="font-medium">Disbursed Funds</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {overallUtilization}%
            </span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
            ₱{totalSpent.toLocaleString()}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-2">Overall Consumption</p>
        </div>

        {/* Total Remaining */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="font-medium">Remaining Headroom</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Available
            </span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
            ₱{totalRemaining.toLocaleString()}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-2">Uncommitted Balance</p>
        </div>
      </div>

      {/* ── Main Breakdown Chart & Categories Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Donut Chart Visual */}
        <div className="p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-zinc-400" />
              <span>Expenditure Breakdown</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Proportional fund consumption by department</p>
          </div>

          <div className="h-64 my-4 flex items-center justify-center">
            {totalSpent > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={budgetCategories.filter((c) => c.spent > 0)} 
                    cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="spent" nameKey="name" paddingAngle={4}
                  >
                    {budgetCategories.filter((c) => c.spent > 0).map((entry, idx) => (
                      <Cell 
                        key={idx} 
                        fill={entry.color || DISTINCT_CATEGORY_COLORS[idx % DISTINCT_CATEGORY_COLORS.length]} 
                        stroke="#121215" 
                        strokeWidth={2} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#121215",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(val: unknown) => `₱${Number(val || 0).toLocaleString()}`}
                  />
                  <Legend 
                    formatter={(value) => <span className="text-xs text-zinc-400 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-zinc-500 text-xs py-8">
                <PieChartIcon className="w-8 h-8 opacity-30 text-zinc-400 mx-auto mb-2" />
                <span>No disbursements recorded yet to visualize breakdown.</span>
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Categories automatically validate transactions against remaining balances.</span>
          </div>
        </div>

        {/* Category Cards List */}
        <div className="lg:col-span-2 p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <span>Category Utilization & Caps</span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Real-time depletion trackers for each authorized envelope</p>
              </div>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                {budgetCategories.length} Envelopes
              </span>
            </div>

            {budgetCategories.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
                <p className="text-xs font-medium text-zinc-400">No budget envelopes defined</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Click &quot;Add Category&quot; to establish spending limits.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {budgetCategories.map((cat, catIdx) => {
                  const pct = cat.allocated > 0 ? Math.round((cat.spent / cat.allocated) * 100) : 0;
                  const remaining = Math.max(0, cat.allocated - cat.spent);
                  const envelopeColor = cat.color || DISTINCT_CATEGORY_COLORS[catIdx % DISTINCT_CATEGORY_COLORS.length];

                  return (
                    <div 
                      key={cat._id}
                      className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/40 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: envelopeColor }} 
                          />
                          <span className="font-semibold text-sm text-white">{cat.name}</span>
                          {pct >= 90 && (
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> High Usage
                            </span>
                          )}
                        </div>

                        {canManageBudget && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(cat)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                              title="Edit Category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat._id, cat.name)}
                              disabled={deletingId === cat._id}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 95 ? "bg-rose-500" :
                            pct >= 75 ? "bg-amber-400" : "bg-white"
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                        <div>
                          <span className="text-zinc-200">₱{cat.spent.toLocaleString()} spent</span>
                          <span className="text-zinc-600 mx-1.5">/</span>
                          <span className="text-zinc-400">₱{cat.allocated.toLocaleString()} cap</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${pct >= 95 ? "text-rose-400" : pct >= 75 ? "text-amber-400" : "text-zinc-200"}`}>
                            {pct}%
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            (₱{remaining.toLocaleString()} left)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Category Modal ── */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 w-full max-w-md shadow-2xl animate-modal-pop">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-zinc-300" />
                  <span>New Budget Envelope</span>
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Marketing, Logistics, Venue"
                    className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white outline-none focus:border-zinc-500 transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                    Allocated Amount (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    placeholder="e.g., 25000"
                    className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white outline-none focus:border-zinc-500 font-mono transition-colors"
                    value={formData.allocated}
                    onChange={(e) => setFormData({ ...formData, allocated: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                    Theme Color Indicator
                  </label>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {availableColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          formData.color === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : "hover:scale-105 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "Creating..." : "Save Envelope"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Edit Category Modal ── */}
      {editingCategory && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 w-full max-w-md shadow-2xl animate-modal-pop">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-zinc-300" />
                  <span>Edit Budget Envelope</span>
                </h3>
                <button onClick={() => setEditingCategory(null)} className="text-zinc-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white outline-none focus:border-zinc-500 transition-colors"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                    Allocated Amount (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    className="w-full px-3.5 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white outline-none focus:border-zinc-500 font-mono transition-colors"
                    value={editFormData.allocated}
                    onChange={(e) => setEditFormData({ ...editFormData, allocated: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                    Theme Color Indicator
                  </label>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {availableColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, color: c })}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          editFormData.color === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : "hover:scale-105 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "Updating..." : "Update Envelope"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title="Delete Budget Envelope"
        message={`Are you sure you want to delete the "${categoryToDelete?.name}" budget category? All transaction associations will remain in ledger history.`}
        confirmText="Delete Envelope"
        variant="danger"
        isLoading={Boolean(deletingId)}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}
