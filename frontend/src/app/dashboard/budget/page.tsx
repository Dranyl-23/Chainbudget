"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { PiggyBank, TrendingUp, TrendingDown, Plus, X } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "@/lib/api";

interface BudgetCategory {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
}

export default function BudgetPage() {
  const { user, activeOrgId } = useAuth();
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    allocated: "",
    color: "#6B55D9"
  });

  const availableColors = [
    "#6B55D9", "#A892F0", "#7B66C7", "#D4D0F5", "#B8A5F8",
    "#E05C5C", "#F09292", "#10B981", "#34D399", "#F59E0B"
  ];

  const fetchBudgets = async () => {
    try {
      
      if (!activeOrgId) {
        setLoading(false);
        return;
      }
      const orgId = activeOrgId || "";
      
      const res = await api.get("/budget", { params: { orgId } });
      setBudgetCategories(res.data || []);
    } catch (err) {
      console.error("Failed to fetch budgets:", err);
      setError("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [activeOrgId]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeOrgId) return;
    const orgId = activeOrgId || "";

    if (!formData.name.trim() || !formData.allocated || isNaN(Number(formData.allocated))) {
      setError("Please fill out all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/budget", {
        organizationId: orgId,
        name: formData.name,
        allocated: Number(formData.allocated),
        color: formData.color,
      });
      setBudgetCategories((prev) => [...prev, res.data]);
      setShowAddModal(false);
      setFormData({ name: "", allocated: "", color: "#6B55D9" });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create budget category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAllocated = budgetCategories.reduce((s, c) => s + c.allocated, 0);
  const totalSpent = budgetCategories.reduce((s, c) => s + c.spent, 0);

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in relative">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Budget</h1>
          <p className="text-sm text-gray-500">Manage and monitor your organizational budget allocations.</p>
        </div>
        {/* RBAC Fix: Only Level 1 & 2 can add categories. Level 3 is read-only. */}
        {(user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) && (
          <button className="btn-primary py-2 w-full sm:w-auto justify-center" onClick={() => { setShowAddModal(true); setError(null); }}>
            <Plus className="w-4 h-4" /> Add Category
          </button>
        )}
      </header>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading budget data...</div>
      ) : (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="stat-card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 mb-4">
                <PiggyBank className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-gray-500 mb-1">Total Budget</p>
              <h3 className="text-2xl font-bold">&#8369;{totalAllocated.toLocaleString()}</h3>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-danger/10 mb-4">
                <TrendingDown className="w-5 h-5 text-danger" />
              </div>
              <p className="text-sm text-gray-500 mb-1">Total Spent</p>
              <h3 className="text-2xl font-bold text-danger">&#8369;{totalSpent.toLocaleString()}</h3>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 mb-4">
                <TrendingUp className="w-5 h-5 text-primary/80" />
              </div>
              <p className="text-sm text-gray-500 mb-1">Remaining</p>
              <h3 className="text-2xl font-bold text-primary">&#8369;{(totalAllocated - totalSpent).toLocaleString()}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Breakdown chart ── */}
            <div className="glass p-6 rounded-xl">
              <h3 className="text-base font-semibold mb-6">Spending Breakdown</h3>
              <div className="h-[260px]">
                {totalSpent > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={budgetCategories.filter(c => c.spent > 0)} 
                        cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                        dataKey="spent" nameKey="name" paddingAngle={3}
                      >
                        {budgetCategories.filter(c => c.spent > 0).map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#F8F6FF", border: "1px solid rgba(107,85,217,0.16)", borderRadius: "8px", color: "#1A1A2E" }}
                        formatter={(val: any) => `₱${Number(val).toLocaleString()}`}
                      />
                      <Legend iconType="circle" iconSize={8}
                        formatter={(value) => <span className="text-xs text-gray-400">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <PieChart className="opacity-20 mb-2 w-12 h-12" />
                    <span className="text-sm">No spending data yet</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Category bars ── */}
            <div className="lg:col-span-2 glass p-6 rounded-xl">
              <h3 className="text-base font-semibold mb-6">Category Utilization</h3>
              {budgetCategories.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No budget categories defined. Click "Add Category" to start.</div>
              ) : (
                <div className="space-y-5">
                  {budgetCategories.map((cat, i) => {
                    const pct = cat.allocated > 0 ? Math.round((cat.spent / cat.allocated) * 100) : 0;
                    const isOver = pct > 85;
                    return (
                      <div key={cat._id || i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold ${isOver ? "text-danger" : "text-gray-400"}`}>
                              {pct}% used
                            </span>
                            <span className="text-xs text-gray-600 ml-2">
                              &#8369;{cat.spent.toLocaleString()} / &#8369;{cat.allocated.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-[#f2efff] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: isOver ? "#E05C5C" : cat.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Add Category Modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,26,46,0.55)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="glass rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Budget Category</h2>
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

            <form onSubmit={handleAddCategory} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Events & Activities"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Allocated Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Allocated Amount (&#8369;)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="input"
                  value={formData.allocated}
                  onChange={(e) => setFormData({ ...formData, allocated: e.target.value })}
                  required
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Category Color</label>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: col })}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        background: col,
                        borderColor: formData.color === col ? "#fff" : "transparent",
                        boxShadow: formData.color === col ? `0 0 0 2px ${col}` : "none",
                      }}
                    />
                  ))}
                </div>
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
                  {isSubmitting ? "Saving..." : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
