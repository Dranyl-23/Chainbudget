const express = require("express");
const router = express.Router();
const Proposal = require("../models/Proposal");
const Organization = require("../models/Organization");
const DaoVote = require("../models/DaoVote");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");
const { sendEmail } = require("../services/email");
const crypto = require("crypto");

/**
 * @route   GET /api/dao/proposals
 * @desc    Get all active/past proposals for an organization
 * @access  Private (must be a member of the org)
 */
router.get("/proposals", authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "Missing orgId" });

    // Validate membership
    if (!req.user.memberships.some(m => m.organization.toString() === orgId)) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    const proposals = await Proposal.find({ organization: orgId })
      .populate("creator", "displayName walletAddress memberships")
      .sort({ createdAt: -1 })
      .lean();

    const proposalIds = proposals.map(p => p._id);
    const votes = await DaoVote.find({ proposal: { $in: proposalIds } })
      .populate("voter", "displayName walletAddress memberships")
      .lean();

    const proposalsWithVotes = proposals.map(p => {
      const pVotes = votes.filter(v => v.proposal.toString() === p._id.toString());
      const hasVoted = pVotes.some(v => v.voter._id.toString() === req.user._id.toString());
      
      let yesVotes = 0;
      let noVotes = 0;
      pVotes.forEach(v => {
        if (v.support) yesVotes++;
        else noVotes++;
      });
      
      return {
        ...p,
        votesList: pVotes.map(v => ({ support: v.support, voter: v.voter })),
        yesVotes,
        noVotes,
        hasVoted
      };
    });

    res.json({ proposals: proposalsWithVotes });
  } catch (err) {
    console.error("Fetch proposals error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   POST /api/dao/proposals
 * @desc    Create a new DAO proposal
 * @access  Private (Level 1 or 2 can create, or anyone based on org settings)
 */
router.post("/proposals", authenticate, async (req, res) => {
  try {
    const { orgId, title, description, amount, durationSeconds } = req.body;
    
    if (!orgId || !title || !description || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Must be member
    const membership = req.user.memberships.find(m => m.organization.toString() === orgId);
    if (!membership) {
      return res.status(403).json({ error: "Not a member" });
    }

    // Optional: Only President (Level 1) or Treasurer (Level 2) can create proposals
    if (membership.roleLevel > 2) {
      return res.status(403).json({ error: "Only admins can create proposals" });
    }

    const dataString = JSON.stringify({ title, description, amount, orgId });
    const dataHash = "0x" + crypto.createHash("sha256").update(dataString).digest("hex");

    const duration = durationSeconds || 604800; // default 7 days
    const endTime = new Date(Date.now() + duration * 1000);

    const newProposal = new Proposal({
      title,
      description,
      amount,
      organization: orgId,
      creator: req.user._id,
      dataHash,
      durationSeconds: duration,
      endTime
    });

    await newProposal.save();
    await newProposal.populate("creator", "displayName walletAddress");
    
    // Emit real-time socket event and create notification
    const notifTitle = "New DAO Proposal";
    const notifMessage = `${req.user.displayName || 'A member'} proposed to allocate ₱${amount.toLocaleString()} for ${title}`;
    const newNotif = await Notification.create({
      organization: orgId,
      title: notifTitle,
      message: notifMessage,
      type: "info",
      readBy: []
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("dao_vote_updated", { orgId }); // Use same event to trigger refetch
      io.emit("new_notification", {
        orgId,
        id: newNotif._id,
        title: notifTitle,
        message: notifMessage,
        type: "info",
        timestamp: newNotif.createdAt
      });
    }
    
    // Send Email to all members of the organization
    try {
      const orgUsers = await User.find({
        "memberships": {
          $elemMatch: { organization: orgId, isActive: true }
        },
        email: { $exists: true, $ne: "" }
      });
      const emails = orgUsers.map(u => u.email);
      if (emails.length > 0) {
        sendEmail(
          emails.join(","),
          "New DAO Proposal for Voting",
          `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #4F46E5;">New DAO Proposal Created</h2>
            <p>A new proposal is open for voting in your organization.</p>
            <table style="width: 100%; max-width: 400px; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Title:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${title}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">₱${amount.toLocaleString()}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Proposed By:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${req.user.displayName}</td></tr>
            </table>
            <p>Please log in to the DAO Governance board to cast your vote.</p>
            <a href="http://localhost:3000/dashboard/dao" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Vote Now</a>
          </div>
          `
        ).catch(console.error);
      }
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
    }
    
    res.status(201).json({ proposal: newProposal });
  } catch (err) {
    console.error("Create proposal error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   PUT /api/dao/proposals/:id/sync
 * @desc    Sync the blockchain proposal ID after contract execution
 * @access  Private
 */
router.put("/proposals/:id/sync", authenticate, async (req, res) => {
  try {
    const { blockchainProposalId } = req.body;
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ error: "Not found" });

    proposal.blockchainProposalId = blockchainProposalId;
    await proposal.save();

    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   POST /api/dao/proposals/:id/vote
 * @desc    Cast a vote on a proposal
 * @access  Private
 */
router.post("/proposals/:id/vote", authenticate, async (req, res) => {
  try {
    const { support } = req.body;
    if (typeof support !== 'boolean') return res.status(400).json({ error: "support must be boolean" });

    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });

    if (proposal.status !== "active") {
      return res.status(400).json({ error: "Voting is closed for this proposal" });
    }

    // Check if user is a member
    if (!req.user.memberships.some(m => m.organization.toString() === proposal.organization.toString())) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    const newVote = new DaoVote({
      proposal: proposal._id,
      voter: req.user._id,
      support
    });

    await newVote.save();
    
    // Emit real-time socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("dao_vote_updated", { proposalId: proposal._id });
    }
    
    // Check if we should auto-pass it based on some threshold
    // TBD in future iterations
    
    res.json({ message: "Vote cast successfully", vote: newVote });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "You have already voted" });
    }
    console.error("Vote error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
