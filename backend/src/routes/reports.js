const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const { authenticate, requireRole } = require("../middleware/auth");

/// GET /api/reports/summary?orgId=xxx — Financial summary for dashboard
router.get("/summary", authenticate, requireRole(4), async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const mongoose = require("mongoose");
    const orgObjectId = mongoose.Types.ObjectId.createFromHexString(orgId);

    // ── Date range: last 6 calendar months ──────────────────────────────────
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [income, expenses, pendingCount, txCount, monthlyRaw] = await Promise.all([
      Transaction.aggregate([
        { $match: { organization: orgObjectId, type: "income", status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { organization: orgObjectId, type: "expense", status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.countDocuments({ organization: orgId, status: "pending_approval" }),
      Transaction.countDocuments({ organization: orgId, status: "approved" }),
      // Monthly grouped cash flow for the last 6 months
      Transaction.aggregate([
        {
          $match: {
            organization: orgObjectId,
            status: "approved",
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              type: "$type",
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    const totalIncome = income[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const balance = totalIncome - totalExpenses;

    // ── Build cashFlow array ─────────────────────────────────────────────────
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialise the last 6 month slots
    const cashFlowMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      cashFlowMap[key] = { month: MONTH_NAMES[d.getMonth()], income: 0, expense: 0 };
    }

    // Populate from aggregation results
    for (const row of monthlyRaw) {
      const key = `${row._id.year}-${row._id.month}`;
      if (cashFlowMap[key]) {
        cashFlowMap[key][row._id.type] += row.total;
      }
    }

    const cashFlow = Object.values(cashFlowMap);

    res.json({
      totalIncome,
      totalExpenses,
      balance,
      pendingApprovals: pendingCount,
      approvedTransactions: txCount,
      cashFlow,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/reports/by-category?orgId=xxx — Spending by category
router.get("/by-category", authenticate, requireRole(2), async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const breakdown = await Transaction.aggregate([
      {
        $match: {
          organization: require("mongoose").Types.ObjectId.createFromHexString(orgId),
          type: "expense",
          status: "approved",
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/reports/export?orgId=xxx — Export transactions as JSON (can be converted to CSV on frontend)
router.get("/export", authenticate, requireRole(2), async (req, res) => {
  try {
    const { orgId, startDate, endDate } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const filter = { organization: orgId, status: "approved" };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate("submittedBy", "walletAddress displayName")
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
