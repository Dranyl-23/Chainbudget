const express = require("express");
const router = express.Router();
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const { authenticate } = require("../middleware/auth");
const mongoose = require("mongoose");

/// GET /api/budget?orgId=xxx — Get budget categories and calculate spent amounts
router.get("/", authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    // Ensure the user has access to this org
    const role = req.user.getRoleInOrg(orgId);
    if (!req.user.isSuperAdmin && (!role || role > 3)) {
      return res.status(403).json({ error: "Access denied. Minimum Level 3 required." });
    }

    // 1. Fetch all budget categories for the org
    const budgets = await Budget.find({ organization: orgId }).lean();

    // 2. Aggregate total spent per category from transactions
    // We count expenses that are approved or pending approval
    const spendingAgg = await Transaction.aggregate([
      {
        $match: {
          organization: new mongoose.Types.ObjectId(orgId),
          type: "expense",
          status: { $in: ["approved", "pending_approval"] },
          category: { $exists: true, $ne: null, $ne: "" }
        }
      },
      {
        $group: {
          _id: { $toLower: "$category" },
          totalSpent: { $sum: "$amount" }
        }
      }
    ]);

    // Create a map for quick lookup: map["events"] = 15000
    const spentMap = {};
    spendingAgg.forEach((item) => {
      spentMap[item._id] = item.totalSpent;
    });

    // 3. Map spent amounts to budgets
    const budgetsWithSpent = budgets.map((b) => {
      const lowerName = b.name.toLowerCase();
      return {
        ...b,
        spent: spentMap[lowerName] || 0
      };
    });

    res.json(budgetsWithSpent);
  } catch (err) {
    console.error("Fetch budgets error:", err);
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/budget — Create a new budget category
router.post("/", authenticate, async (req, res) => {
  try {
    const { organizationId, name, allocated, color } = req.body;

    if (!organizationId) return res.status(400).json({ error: "organizationId required" });
    if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
    if (!allocated || typeof allocated !== "number" || allocated < 0) {
      return res.status(400).json({ error: "valid allocated amount required" });
    }

    // Ensure the user has access to this org and is at least level 2 (optional check, assuming level 2 can create budgets)
    const role = req.user.getRoleInOrg(organizationId);
    if (!req.user.isSuperAdmin && (!role || role > 2)) {
      return res.status(403).json({ error: "Insufficient permissions to create budget" });
    }

    const budget = new Budget({
      organization: organizationId,
      name: name.trim(),
      allocated: allocated ?? req.body.allocatedAmount,
      color: color || "#6B55D9"
    });

    await budget.save();
    
    // Return with spent = 0 since it's brand new
    res.status(201).json({ ...budget.toObject(), spent: 0, allocatedAmount: budget.allocated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Budget category with this name already exists in this organization." });
    }
    console.error("Create budget error:", err);
    res.status(500).json({ error: err.message });
  }
});

/// PUT /api/budget/:id — Update a budget category (Level 1 & 2)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { name, allocated, allocatedAmount, color } = req.body;
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: "Budget category not found" });

    const role = req.user.getRoleInOrg(budget.organization);
    if (!req.user.isSuperAdmin && (!role || role > 2)) {
      return res.status(403).json({ error: "Insufficient permissions to edit budget" });
    }

    if (name && typeof name === "string") budget.name = name.trim();
    if (allocated !== undefined || allocatedAmount !== undefined) {
      const newAllocated = Number(allocated ?? allocatedAmount);
      if (isNaN(newAllocated) || newAllocated < 0) {
        return res.status(400).json({ error: "Valid allocated amount required" });
      }
      budget.allocated = newAllocated;
    }
    if (color && typeof color === "string") budget.color = color;

    await budget.save();
    res.json(budget);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Budget category with this name already exists." });
    }
    console.error("Update budget error:", err);
    res.status(500).json({ error: err.message });
  }
});

/// DELETE /api/budget/:id — Delete a budget category (Level 1 & 2)
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: "Budget category not found" });

    const role = req.user.getRoleInOrg(budget.organization);
    if (!req.user.isSuperAdmin && (!role || role > 2)) {
      return res.status(403).json({ error: "Insufficient permissions to delete budget" });
    }

    await Budget.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Budget category deleted" });
  } catch (err) {
    console.error("Delete budget error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

