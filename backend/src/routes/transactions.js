const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const Budget = require("../models/Budget");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { recordTransactionOnChain, releaseEscrowOnChain } = require("../services/blockchain");
const { authenticate, requireRole } = require("../middleware/auth");
const { requireIdempotency } = require("../middleware/idempotency");
const { sendEmail } = require("../services/email");
const { ethers } = require("ethers");
const { sendPushNotifications } = require("./users");

/// POST /api/transactions — Create a new transaction (Level 2+) or Request (Level 3)
router.post("/", authenticate, requireRole(3), requireIdempotency, async (req, res) => {
  try {
    const {
      organizationId,
      type,
      amount,
      description,
      category,
      referenceNumber,
      budgetCategory,
      notes,
      documentHash,
      urgency,
      isEscrow,
      documentUrl,
    } = req.body;

    // Input validation
    if (!organizationId || typeof organizationId !== "string") {
      return res.status(400).json({ error: "organizationId is required and must be a string" });
    }
    if (!type || !["income", "expense"].includes(type)) {
      return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }
    const MIN_AMOUNT = 1;
    if (!amount || typeof amount !== "number" || amount < MIN_AMOUNT) {
      return res.status(400).json({ error: `amount must be at least ${MIN_AMOUNT}` });
    }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ error: "description is required and must be non-empty" });
    }

    const org = await Organization.findById(organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (!org.isActive) {
      return res.status(400).json({ error: "Organization is inactive" });
    }

    // Budget Dissemination Validation
    if (type === "expense" && category) {
      // MED-2 FIX: $regex with case-insensitive flag requires a full collection scan and
      // cannot use an index. Normalize the category to lowercase for an exact $eq lookup,
      // which is fast, deterministic, and index-friendly.
      const normalizedCategory = category.trim().toLowerCase();
      const escapedCategory = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const budget = await Budget.findOne({
        organization: organizationId,
        $or: [
          { name: category.trim() },
          { name: normalizedCategory },
          { name: { $regex: new RegExp(`^${escapedCategory}$`, "i") } }
        ]
      });

      if (!budget) {
        return res.status(400).json({ error: `Budget category '${category}' not found. Please create it in the Budget tab first.` });
      }

      const spendingAgg = await Transaction.aggregate([
        {
          $match: {
            organization: new mongoose.Types.ObjectId(organizationId),
            type: "expense",
            status: { $in: ["approved", "pending_approval", "requested"] },
            category: { $regex: new RegExp(`^${escapedCategory}$`, "i") },
          }
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: "$amount" }
          }
        }
      ]);
      const spentSoFar = spendingAgg.length > 0 ? spendingAgg[0].totalSpent : 0;
      
      if (amount + spentSoFar > budget.allocated) {
        return res.status(400).json({ 
          error: `Transaction exceeds remaining budget allocation. Allocated: ₱${budget.allocated.toLocaleString()}, Spent/Pending: ₱${spentSoFar.toLocaleString()}, Requested: ₱${amount.toLocaleString()}.`
        });
      }
    }

    const isHighValue = amount >= org.highValueThreshold;

    // Determine status based on role
    const roleLevel = req.user.getRoleInOrg(organizationId);
    const isRequest = roleLevel === 3;
    
    let initialStatus;
    if (isRequest) {
      initialStatus = "requested";
    } else {
      initialStatus = isHighValue ? "pending_approval" : "approved";
    }

    const txn = new Transaction({
      organization: organizationId,
      submittedBy: req.user._id,
      type,
      amount,
      description: description.trim(),
      category: category ? category.trim() : undefined,
      referenceNumber: referenceNumber ? referenceNumber.trim() : undefined,
      budgetCategory: budgetCategory ? budgetCategory.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      documentUrl: documentUrl || undefined,
      documentHash: documentHash || undefined,
      isHighValue,
      isEscrow: isEscrow === true,
      escrowStatus: "none",
      status: initialStatus,
      urgency: urgency && urgency === "urgent" ? "urgent" : "normal",
    });

    await txn.save();

    let blockchainResult = null;
    
    // Only record on blockchain if it's NOT a level 3 request
    if (!isRequest) {
      try {
        const payload = JSON.stringify({
          orgId: organizationId,
          amount,
          type,
          description,
          submittedBy: req.user.walletAddress,
          timestamp: new Date().toISOString(),
          documentHash: documentHash || null,  // Bind receipt hash on-chain
        });

        blockchainResult = await recordTransactionOnChain(
          payload,
        Math.floor(amount),
          req.user.walletAddress || "0x0000000000000000000000000000000000000000",
          isHighValue,
          isEscrow === true
        );

        if (blockchainResult && !blockchainResult.skipped) {
          txn.onChainTxId = blockchainResult.onChainTxId;
          txn.blockchainTxHash = blockchainResult.blockchainTxHash;
          txn.dataHash = blockchainResult.dataHash;
          txn.isRecordedOnChain = true;
          await txn.save();
        }
      } catch (blockchainError) {
        console.error("Blockchain recording failed:", blockchainError.message);
        // Continue - blockchain is optional for now
      }

      // Send Email to Level 1 Approvers if high value transaction
      if (isHighValue) {
        try {
          const level1Users = await User.find({
            "memberships": {
              $elemMatch: { organization: organizationId, roleLevel: 1, isActive: true }
            },
            email: { $exists: true, $ne: "" }
          });
          const emails = level1Users.map(u => u.email);
          if (emails.length > 0) {
            sendEmail(
              emails.join(","),
              "Action Required: High-Value Transaction Pending Approval",
              `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #4F46E5;">High-Value Transaction Alert</h2>
                <p>A new transaction requires your executive approval.</p>
                <table style="width: 100%; max-width: 400px; border-collapse: collapse; margin-bottom: 20px;">
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">₱${amount.toLocaleString()}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Description:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${description}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Requested By:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${req.user.displayName}</td></tr>
                </table>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/approvals" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Review in ChainBudget</a>
              </div>
              `
            ).catch(console.error); // don't block
          }
        } catch (emailErr) {
          console.error("Email sending error:", emailErr);
        }
      }
    }

    // Audit log
    await AuditLog.create({
      organization: organizationId,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "transaction.created",
      targetType: "Transaction",
      targetId: txn._id,
      details: { amount, type, isHighValue },
      blockchainTxHash: blockchainResult?.blockchainTxHash,
      onChainTxId: blockchainResult?.onChainTxId,
    });

    // Save and Emit Notification
    const notifTitle = isRequest ? (urgency === "urgent" ? "Urgent Request" : "Budget Request") : "New Transaction";
    const notifMessage = isRequest 
      ? `${req.user.displayName || 'A member'} requested ₱${amount.toLocaleString()} for ${description.substring(0,30)}...`
      : `A new transaction of ₱${amount.toLocaleString()} was created.`;
    const notifType = (isRequest || urgency === "urgent") ? "urgent" : "blockchain";

    const newNotif = await Notification.create({
      organization: organizationId,
      title: notifTitle,
      message: notifMessage,
      type: notifType,
      readBy: []
    });

    const io = req.app.get("io");
    if (io) {
      // Scope events to the organization's room — only members in this org
      // receive this broadcast. io.emit() would leak events cross-org.
      io.to(`org:${organizationId}`).emit("transaction_updated", { orgId: organizationId });
      io.to(`org:${organizationId}`).emit("new_notification", {
        orgId: organizationId,
        id: newNotif._id,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        timestamp: newNotif.createdAt
      });
    }

    // ── Push Notification to Approvers ────────────────────────────────────────
    // Find all active Level 1 & 2 members in this org who can approve, then
    // push a notification so they act immediately without opening the app.
    // Fire-and-forget — never delays the HTTP response.
    if (txn.status === "pending_approval") {
      try {
        // HIGH-2 FIX: Organization schema has no `members` field — memberships live
        // in User.memberships[]. The previous code always resolved to an empty array
        // so approvers never received push notifications for new transactions.
        // Query Users directly using $elemMatch, same pattern as the email block above.
        const approvers = await User.find({
          memberships: {
            $elemMatch: { organization: organizationId, roleLevel: { $lte: 2 }, isActive: true },
          },
        }).select("_id").lean();
        const approverIds = approvers.map((u) => u._id.toString());

        if (approverIds.length > 0) {
          sendPushNotifications(
            approverIds,
            "New Approval Request",
            `${req.user.displayName || "A member"} submitted a ₱${txn.amount} request: "${txn.description.slice(0, 40)}"`,
            { txId: txn._id.toString(), screen: "Approvals", channelId: "chainbudget-approvals" }
          );
        }
      } catch (pushErr) {
        console.warn("[Push] Could not notify approvers:", pushErr.message);
      }
    }

    res.status(201).json({ transaction: txn, blockchain: blockchainResult });
  } catch (err) {
    console.error("Transaction creation error:", err.message);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

// GET /api/transactions/pending-count?orgId=xxx
router.get("/pending-count", authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    // Only Level 1 & Level 2 can approve/reject
    const roleLevel = req.user.getRoleInOrg(orgId);
    if (roleLevel > 2 && !req.user.isSuperAdmin) {
      return res.json({ count: 0 }); // They don't have pending actions
    }

    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.json({ count: 0 });
    }

    // Count both requested and pending_approval
    const count = await Transaction.countDocuments({
      organization: new mongoose.Types.ObjectId(orgId),
      status: { $in: ["requested", "pending_approval"] }
    });

    res.json({ count });
  } catch (err) {
    console.error("Failed to fetch pending count:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/// GET /api/transactions?orgId=xxx — List transactions for an org
router.get("/", authenticate, async (req, res) => {
  try {
    const { orgId, status, type, page = 1, limit = 20 } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const mongoose = require("mongoose");

    // Validate orgId format before creating ObjectId
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }

    // MED-3 FIX: Cap limit to prevent a client from passing ?limit=999999 and
    // dumping the entire transaction table in one request (memory/DoS risk).
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const filter = { organization: orgObjectId };
    if (type) filter.type = type;

    // Security filters based on Role Level
    const roleLevel = req.user.getRoleInOrg(orgId);
    if (!req.user.isSuperAdmin) {
      if (roleLevel === 4) {
        // Level 4 (Public Viewers) ONLY see approved transactions
        filter.status = "approved";
      } else if (roleLevel === 3) {
        // Level 3 can see approved and their own requested transactions
        if (status) {
          if (["approved", "requested"].includes(status)) {
            filter.status = status;
            if (status === "requested") {
              filter.submittedBy = req.user._id;
            }
          } else {
            filter.status = "unauthorized_status";
          }
        } else {
          filter.status = { $in: ["approved", "requested"] };
        }
      } else {
        // Admins (Level 1 & 2) can filter by any status
        if (status) filter.status = status;
      }
    } else {
      // SuperAdmins can filter by any status
      if (status) filter.status = status;
    }

    const skip = (Number(page) - 1) * safeLimit;

    // Aggregate to include approvalCount and organization data in one query
    const [transactions, total] = await Promise.all([
      Transaction.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: safeLimit },
        // Join submittedBy user
        {
          $lookup: {
            from: "users",
            localField: "submittedBy",
            foreignField: "_id",
            as: "submittedByArr",
          },
        },
        {
          $addFields: {
            submittedBy: {
              $let: {
                vars: { u: { $arrayElemAt: ["$submittedByArr", 0] } },
                in: { _id: "$$u._id", walletAddress: "$$u.walletAddress", displayName: "$$u.displayName" },
              },
            },
          },
        },
        { $project: { submittedByArr: 0 } },
        // Join organization (for threshold info)
        {
          $lookup: {
            from: "organizations",
            localField: "organization",
            foreignField: "_id",
            as: "organizationArr",
          },
        },
        {
          $addFields: {
            organization: {
              $let: {
                vars: { o: { $arrayElemAt: ["$organizationArr", 0] } },
                in: {
                  _id: "$$o._id",
                  name: "$$o.name",
                  highValueThreshold: "$$o.highValueThreshold",
                  requiredApprovals: "$$o.requiredApprovals",
                },
              },
            },
          },
        },
        { $project: { organizationArr: 0 } },
        // Fetch the "approved" approvals and their approver details
        {
          $lookup: {
            from: "approvals",
            let: { txId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$transaction", "$$txId"] },
                      { $eq: ["$action", "approved"] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: "users",
                  localField: "approver",
                  foreignField: "_id",
                  as: "approverUser"
                }
              },
              {
                $project: {
                  _id: "$approver",
                  walletAddress: { $arrayElemAt: ["$approverUser.walletAddress", 0] },
                  displayName: { $arrayElemAt: ["$approverUser.displayName", 0] },
                  memberships: { $arrayElemAt: ["$approverUser.memberships", 0] }
                }
              }
            ],
            as: "approvedBy",
          },
        },
        {
          $addFields: {
            approvalCount: { $size: "$approvedBy" },
            hasVoted: {
              $in: [
                new mongoose.Types.ObjectId(req.user._id),
                "$approvedBy._id"
              ]
            }
          },
        },
      ]),
      Transaction.countDocuments(filter),
    ]);

    res.json({ transactions, total, page: Number(page), limit: safeLimit });
  } catch (err) {
    console.error("GET /transactions error:", err.message);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

/// PATCH /api/transactions/:id/process-request — Approve/Reject Level 3 Request
router.patch("/:id/process-request", authenticate, requireRole(2), async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    }

    const txn = await Transaction.findById(req.params.id).populate("organization");
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    if (txn.status !== "requested") {
      return res.status(400).json({ error: "Transaction is not in requested state" });
    }

    const orgId = txn.organization._id.toString();
    const userRole = req.user.getRoleInOrg(orgId);
    if (!req.user.isSuperAdmin && (!userRole || userRole > 2)) {
      return res.status(403).json({ error: "Insufficient permissions to process request" });
    }

    if (action === "reject") {
      txn.status = "rejected";
      await txn.save();
      
      await AuditLog.create({
        organization: orgId,
        actor: req.user._id,
        actorWallet: req.user.walletAddress,
        action: "transaction.request_rejected",
        targetType: "Transaction",
        targetId: txn._id,
        details: { reason: "Rejected by admin" }
      });

      return res.json({ transaction: txn, message: "Request rejected" });
    }

    // Process Approval
    const org = txn.organization;
    const isHighValue = txn.amount >= org.highValueThreshold;
    txn.isHighValue = isHighValue;
    txn.status = isHighValue ? "pending_approval" : "approved";

    // Now record on blockchain
    let blockchainResult = null;
    try {
      const payload = JSON.stringify({
        orgId,
        amount: txn.amount,
        type: txn.type,
        description: txn.description,
        submittedBy: txn.submittedBy.toString(), // Original requester
        timestamp: new Date().toISOString(),
        documentHash: txn.documentHash || null,
      });

      // Retrieve requester wallet address
      const requester = await User.findById(txn.submittedBy);
      const toAddress = requester ? requester.walletAddress : "0x0000000000000000000000000000000000000000";

      blockchainResult = await recordTransactionOnChain(
        payload,
        Math.floor(txn.amount),
        toAddress,
        isHighValue,
        txn.isEscrow === true
      );

      if (blockchainResult && !blockchainResult.skipped) {
        txn.onChainTxId = blockchainResult.onChainTxId;
        txn.blockchainTxHash = blockchainResult.blockchainTxHash;
        txn.dataHash = blockchainResult.dataHash;
        txn.isRecordedOnChain = true;
      }
    } catch (blockchainError) {
      console.error("Blockchain recording failed for request:", blockchainError.message);
    }

    await txn.save();

    await AuditLog.create({
      organization: orgId,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "transaction.request_approved",
      targetType: "Transaction",
      targetId: txn._id,
      details: { amount: txn.amount, type: txn.type, isHighValue },
      blockchainTxHash: blockchainResult?.blockchainTxHash,
      onChainTxId: blockchainResult?.onChainTxId,
    });

    res.json({ transaction: txn, blockchain: blockchainResult, message: "Request approved and processed" });
  } catch (err) {
    console.error("Process request error:", err);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

/// GET /api/transactions/public-overview — Get public stats and recent transactions
router.get("/public-overview", async (req, res) => {
  try {
    // High-performance aggregation pipeline running inside MongoDB engine
    const [statsResult, activeOrgs, recentTxns] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            blockchainTxHash: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            totalVerified: { $sum: 1 },
            totalFunds: { $sum: "$amount" },
          },
        },
      ]),
      Organization.countDocuments({ isActive: true }),
      Transaction.find({
        blockchainTxHash: { $exists: true, $ne: null },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("organization", "name")
        .lean(),
    ]);

    const totalVerified = statsResult[0]?.totalVerified || 0;
    const totalFunds = statsResult[0]?.totalFunds || 0;

    const formattedRecent = recentTxns.map((txn) => ({
      txHash: txn.blockchainTxHash,
      amount: txn.amount,
      description: txn.description,
      category: txn.category || "Uncategorized",
      status: txn.status === "approved" ? "Approved" : txn.status === "rejected" ? "Rejected" : "Pending",
      organization: txn.organization?.name || "Unknown",
      date: txn.createdAt,
    }));

    res.json({
      stats: {
        totalVerified,
        totalFunds,
        activeOrgs,
      },
      recent: formattedRecent,
    });
  } catch (error) {
    console.error("Public overview error:", error);
    res.status(500).json({ error: "Failed to fetch public overview" });
  }
});

/// GET /api/transactions/public/:hash — Verify a transaction publicly (No Auth)
router.get("/public/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    
    // Allow searching by blockchainTxHash or short reference if implemented
    const idFilter = mongoose.Types.ObjectId.isValid(hash) ? [{ _id: hash }] : [];
    const txn = await Transaction.findOne({
      $or: [
        { blockchainTxHash: hash },
        { referenceNumber: hash },
        ...idFilter,
      ]
    }).populate("organization", "name");

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Return safe public fields only
    res.json({
      txHash: txn.blockchainTxHash,
      amount: txn.amount,
      description: txn.description,
      category: txn.category || "Uncategorized",
      status: txn.status === "approved" ? "Approved" : txn.status === "rejected" ? "Rejected" : "Pending",
      organization: txn.organization?.name || "Unknown",
      date: txn.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: "Server error during verification" });
  }
});

/// PATCH /api/transactions/:id/execute — Mark as executed (called by frontend after on-chain execute)
router.patch("/:id/execute", authenticate, requireRole(2), async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // CRIT-3 FIX: requireRole(2) only proves the user has Level 2 in *some* org.
    // Explicitly verify they belong to the *same* org as this transaction.
    const txnOrgId = txn.organization.toString();
    const roleLevel = req.user.getRoleInOrg(txnOrgId);
    if (!req.user.isSuperAdmin && (roleLevel === null || roleLevel > 2)) {
      return res.status(403).json({ error: "Access denied. You are not an admin of this organization." });
    }

    txn.executed = true;
    if (txn.isEscrow) {
      txn.escrowStatus = "locked";
    }
    await txn.save();

    res.json({ success: true, transaction: txn });
  } catch (err) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

/// POST /api/transactions/:id/release-escrow — Release escrow funds with proper identity validation
router.post("/:id/release-escrow", authenticate, async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id).populate("submittedBy", "walletAddress displayName email");
    if (!txn) return res.status(404).json({ error: "Transaction not found" });
    if (!txn.isEscrow) return res.status(400).json({ error: "Not an escrow transaction" });
    if (txn.escrowStatus === "released") return res.status(400).json({ error: "Escrow funds have already been released" });

    // Validate identity: map database user to wallet address
    const requester = txn.submittedBy;
    const requesterId = requester?._id?.toString();
    const requesterWallet = requester?.walletAddress ? requester.walletAddress.toLowerCase() : null;
    const currentUserId = req.user._id.toString();
    const currentUserWallet = req.user.walletAddress ? req.user.walletAddress.toLowerCase() : null;

    // HIGH-5 FIX: Before checking supplier/admin roles, verify the user is associated
    // with this transaction's organization at all. Without this guard, a user from
    // a different org who coincidentally matches the submittedBy ID (or wallet) could
    // interact with another org's escrow.
    const roleLevel = req.user.getRoleInOrg(txn.organization.toString());
    const isOrgMember = req.user.isSuperAdmin || roleLevel !== null;

    // A supplier is either the user who submitted the request or whose wallet matches the payee.
    // They must also be an org member (or the designated payee of this specific transaction).
    const isSupplier = isOrgMember && Boolean(
      (requesterId && requesterId === currentUserId) ||
      (requesterWallet && currentUserWallet && requesterWallet === currentUserWallet)
    );

    // An org admin is a level 1 or 2 member of this transaction's organization
    const isOrgAdmin = req.user.isSuperAdmin || (roleLevel !== null && roleLevel <= 2);

    if (!isOrgMember) {
      return res.status(403).json({
        error: "Access denied. You are not a member of this organization.",
      });
    }

    if (!isSupplier && !isOrgAdmin) {
      return res.status(403).json({
        error: "Access denied. You are not authorized to approve or release this escrow. Only the designated payee/supplier or an organization executive (Level 1/2) can authorize release."
      });
    }

    // Apply role-specific approvals
    if (isOrgAdmin) {
      txn.payerApproved = true;
    }
    if (isSupplier) {
      txn.payeeApproved = true;
    }

    // Interact with smart contract if on-chain transaction ID exists
    let blockchainTxHash = null;
    if (txn.onChainTxId && process.env.CONTRACT_ADDRESS && process.env.BACKEND_WALLET_PRIVATE_KEY) {
      try {
        const { ethers } = require("ethers");
        const rpcUrl = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(process.env.BACKEND_WALLET_PRIVATE_KEY, provider);
        const ChainBudgetABI = require("../lib/ChainBudget.json");
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ChainBudgetABI.abi, signer);

        // MED-4 FIX: Wrap tx.wait() in a 60-second timeout to prevent requests from hanging indefinitely
        const waitWithTimeout = (txPromise, timeoutMs = 60000) =>
          Promise.race([
            txPromise.wait(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Blockchain transaction timeout (${timeoutMs / 1000}s)`)), timeoutMs)
            ),
          ]);

        if (isOrgAdmin && !isSupplier) {
          const tx = await contract.releaseEscrow(txn.onChainTxId);
          const receipt = await waitWithTimeout(tx);
          blockchainTxHash = receipt.hash;
        } else if (isSupplier && !isOrgAdmin) {
          let tx;
          if (req.body?.payeeSig) {
            tx = await contract.releaseEscrowWithPayeeSignature(txn.onChainTxId, req.body.payeeSig);
          } else {
            const evidenceURI = req.body?.evidenceURI || `chainbudget://escrow/release/${txn._id}`;
            tx = await contract.recordOffchainPayeeConfirmation(txn.onChainTxId, evidenceURI);
          }
          const receipt = await waitWithTimeout(tx);
          blockchainTxHash = receipt.hash;
        } else {
          // Admin is acting as both payer and payee (e.g. supplier account is
          // the same as the org admin). Call payer release first, then record
          // payee confirmation on-chain.
          const tx1 = await contract.releaseEscrow(txn.onChainTxId);
          await waitWithTimeout(tx1);
          let tx2;
          if (req.body?.payeeSig) {
            tx2 = await contract.releaseEscrowWithPayeeSignature(txn.onChainTxId, req.body.payeeSig);
          } else {
            const evidenceURI = req.body?.evidenceURI || `chainbudget://escrow/release/${txn._id}`;
            tx2 = await contract.recordOffchainPayeeConfirmation(txn.onChainTxId, evidenceURI);
          }
          const receipt = await waitWithTimeout(tx2);
          blockchainTxHash = receipt.hash;
        }
      } catch (chainErr) {
        console.error("Blockchain escrow release warning:", chainErr.message);
      }
    }

    // If both parties approved, mark escrow as fully released
    if (txn.payerApproved && txn.payeeApproved) {
      txn.escrowStatus = "released";
      txn.executed = true;
    } else {
      txn.escrowStatus = "locked";
    }

    if (blockchainTxHash) {
      txn.blockchainTxHash = blockchainTxHash;
    }

    await txn.save();

    // Audit log
    await AuditLog.create({
      organization: txn.organization,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: txn.escrowStatus === "released" ? "transaction.escrow_released" : (isOrgAdmin ? "transaction.escrow_payer_approved" : "transaction.escrow_payee_approved"),
      targetType: "Transaction",
      targetId: txn._id,
      details: {
        payerApproved: txn.payerApproved,
        payeeApproved: txn.payeeApproved,
        escrowStatus: txn.escrowStatus,
        actorRole: isOrgAdmin ? "payer_admin" : "payee_supplier",
      },
      blockchainTxHash: blockchainTxHash || txn.blockchainTxHash,
      onChainTxId: txn.onChainTxId,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`org:${txn.organization}`).emit("transaction_updated", { orgId: txn.organization });
    }

    res.json({
      success: true,
      message: txn.escrowStatus === "released" ? "Escrow funds successfully released to supplier" : "Approval recorded. Awaiting final counterparty approval.",
      transaction: txn
    });
  } catch (err) {
    console.error("Release escrow error:", err);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || "Failed to process escrow release") });
  }
});

/// PATCH /api/transactions/:id/receipt — Attach a receipt to an existing transaction
router.patch("/:id/receipt", authenticate, async (req, res) => {
  try {
    const { documentUrl, documentHash } = req.body;
    if (!documentUrl || typeof documentUrl !== "string") return res.status(400).json({ error: "documentUrl is required" });

    // Validate safe URL or data URI
    const isBase64 = documentUrl.startsWith("data:image/");
    const isLocalUpload = documentUrl.startsWith("/uploads/") || documentUrl.startsWith("http://localhost:") || documentUrl.startsWith("http://127.0.0.1:");
    
    if (!isBase64 && !isLocalUpload) {
      let parsedUrl;
      try {
        parsedUrl = new URL(documentUrl);
      } catch {
        return res.status(400).json({ error: "documentUrl must be a valid URL" });
      }
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        return res.status(400).json({ error: "documentUrl must use https:// or http:// scheme" });
      }
    }

    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // Allow the original requester or admins to attach a receipt
    const roleLevel = req.user.getRoleInOrg(txn.organization.toString());
    if (
      !req.user.isSuperAdmin &&
      txn.submittedBy.toString() !== req.user._id.toString() &&
      (!roleLevel || roleLevel > 2)
    ) {
      return res.status(403).json({ error: "Unauthorized to attach receipt" });
    }

    txn.documentUrl = documentUrl;
    if (documentHash) txn.documentHash = documentHash;
    
    await txn.save();

    await AuditLog.create({
      organization: txn.organization,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "transaction.receipt_attached",
      targetType: "Transaction",
      targetId: txn._id,
      details: { documentUrl, documentHash }
    });

    res.json(txn);
  } catch (err) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

/// POST /api/transactions/:id/retry-sync — Manually retry blockchain recording
router.post("/:id/retry-sync", authenticate, requireRole(2), async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    if (txn.isRecordedOnChain && txn.blockchainTxHash) {
      return res.status(400).json({ error: "Transaction is already recorded on chain" });
    }

    const orgId = txn.organization.toString();

    const payload = JSON.stringify({
      orgId,
      amount: txn.amount,
      type: txn.type,
      description: txn.description,
      submittedBy: txn.submittedBy.toString(),
      timestamp: new Date().toISOString(),
      documentHash: txn.documentHash || null,
    });

    // Retrieve requester wallet address
    const requester = await User.findById(txn.submittedBy);
    const toAddress = requester ? requester.walletAddress : "0x0000000000000000000000000000000000000000";

    const blockchainResult = await recordTransactionOnChain(
      payload,
      Math.floor(txn.amount),
      toAddress,
      txn.isHighValue,
      txn.isEscrow === true
    );

    if (blockchainResult && !blockchainResult.skipped) {
      txn.onChainTxId = blockchainResult.onChainTxId;
      txn.blockchainTxHash = blockchainResult.blockchainTxHash;
      txn.dataHash = blockchainResult.dataHash;
      txn.isRecordedOnChain = true;
      await txn.save();

      await AuditLog.create({
        organization: orgId,
        actor: req.user._id,
        actorWallet: req.user.walletAddress,
        action: "transaction.sync_retry",
        targetType: "Transaction",
        targetId: txn._id,
        details: { amount: txn.amount, type: txn.type },
        blockchainTxHash: blockchainResult.blockchainTxHash,
        onChainTxId: blockchainResult.onChainTxId,
      });

      return res.json({ success: true, transaction: txn, blockchain: blockchainResult });
    } else {
      return res.status(500).json({ error: "Blockchain sync failed. Is the RPC node running?" });
    }
  } catch (err) {
    console.error("Retry sync error:", err);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

/// GET /api/transactions/:id — Get single transaction
router.get("/:id", authenticate, async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate("submittedBy", "walletAddress displayName")
      .populate("organization", "name type highValueThreshold requiredApprovals");
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // CRIT-2 FIX: Verify the requesting user is a member of this transaction's org.
    // Without this check, any authenticated user from any org could read any transaction by ID.
    const orgId = txn.organization?._id?.toString() || txn.organization?.toString();
    const roleLevel = req.user.getRoleInOrg(orgId);
    if (!req.user.isSuperAdmin && roleLevel === null) {
      return res.status(403).json({ error: "Access denied. You are not a member of this organization." });
    }

    // LOW-4 & LOW-7 FIX: Apply role-based visibility rules consistent with GET /api/transactions list
    if (!req.user.isSuperAdmin) {
      if (roleLevel === 4 && txn.status !== "approved") {
        return res.status(403).json({ error: "Access denied. Public viewers can only access approved transactions." });
      }
      if (roleLevel === 3 && !["approved", "requested"].includes(txn.status)) {
        return res.status(403).json({ error: "Access denied. You do not have permission to view this transaction." });
      }
    }

    res.json(txn);
  } catch (err) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }
});

// ── POST /api/transactions/sync-onchain ── Trigger on-chain reconciliation
router.post("/sync-onchain", authenticate, async (req, res) => {
  try {
    // B-13 FIX: Restrict sync trigger to SuperAdmin or Level <= 2 Finance/Executive officers
    const isAuthorized = req.user.isSuperAdmin || (req.user.memberships && req.user.memberships.some(m => m.isActive && m.roleLevel <= 2));
    if (!isAuthorized) {
      return res.status(403).json({ error: "Access denied. Requires Finance Officer (Level 2) or Executive (Level 1) permissions." });
    }

    const io = req.app.get("io");
    const { syncPendingTransactions } = require("../services/blockchainSyncWorker");
    const result = await syncPendingTransactions(io);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
