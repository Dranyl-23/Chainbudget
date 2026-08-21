const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Organization = require("../models/Organization");
const { authenticate, requireRole, requireSuperAdmin } = require("../middleware/auth");
const { ethers } = require("ethers");
const { sendEmail } = require("../services/email");

/// GET /api/users/me — Current user profile
router.get("/me", authenticate, async (req, res) => {
  try {
    await req.user.populate("memberships.organization", "name type logoUrl");
    const formatted = {
      id: req.user._id,
      _id: req.user._id,
      walletAddress: req.user.walletAddress,
      displayName: req.user.displayName,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl,
      linkedWallets: req.user.linkedWallets,
      isSuperAdmin: req.user.isSuperAdmin,
      memberships: req.user.memberships,
    };
    res.json({ user: formatted, ...formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/users/me/balance — Fetch user's MATIC balance from blockchain
router.get("/me/balance", authenticate, async (req, res) => {
  try {
    if (!req.user.walletAddress) {
      return res.json({ balance: "0.0" });
    }
    const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology/");
    const balanceWei = await provider.getBalance(req.user.walletAddress);
    const balanceMatic = ethers.formatEther(balanceWei);
    res.json({ balance: balanceMatic });
  } catch (err) {
    console.error("Failed to fetch balance:", err);
    res.status(500).json({ error: "Failed to fetch on-chain balance" });
  }
});

/// GET /api/users/by-wallet/:walletAddress — Look up user profile by wallet address
router.get("/by-wallet/:walletAddress", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ walletAddress: req.params.walletAddress.toLowerCase() }).select("displayName email walletAddress");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/users/by-email/:email — Look up user profile by email
router.get("/by-email/:email", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() }).select("displayName email walletAddress");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// PUT /api/users/me — Update current user profile
router.put("/me", authenticate, async (req, res) => {
  try {
    const { displayName, avatarUrl, linkedWallets } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (displayName !== undefined) user.displayName = displayName;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    
    // Add to linked wallets, avoiding duplicates and current wallet
    if (linkedWallets && Array.isArray(linkedWallets)) {
      const mainWallet = user.walletAddress ? user.walletAddress.toLowerCase() : "";
      linkedWallets.forEach((w) => {
        const lowerW = w.toLowerCase();
        if (lowerW && lowerW !== mainWallet && !user.linkedWallets.includes(lowerW)) {
          user.linkedWallets.push(lowerW);
        }
      });
    }

    await user.save();
    await user.populate("memberships.organization", "name type logoUrl");
    const formatted = {
      id: user._id,
      _id: user._id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      linkedWallets: user.linkedWallets,
      isSuperAdmin: user.isSuperAdmin,
      memberships: user.memberships,
    };
    res.json({ user: formatted, ...formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/users/:orgId/members — List members of an org (Level 1+)
router.get("/:orgId/members", authenticate, requireRole(4), async (req, res) => {
  try {
    const users = await User.find({
      "memberships.organization": req.params.orgId,
      "memberships.isActive": true,
    }).select("-nonce");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/users/:orgId/invite — Invite/add a member (Level 1 only)
router.post("/:orgId/invite", authenticate, requireRole(1), async (req, res) => {
  try {
    const { identifier, displayName, roleLevel, roleLabel } = req.body;
    if (!identifier || !roleLevel) {
      return res.status(400).json({ error: "identifier and roleLevel required" });
    }

    const idLower = identifier.toLowerCase().trim();
    let isWallet = idLower.startsWith("0x") && idLower.length === 42;
    
    let user = await User.findOne(isWallet ? { walletAddress: idLower } : { email: idLower });
    
    if (!user) {
      // Pre-create the user. The wallet will be auto-generated upon first login via Asgardeo if they registered with email.
      const newUserObj = { displayName: displayName || "New Member" };
      if (isWallet) newUserObj.walletAddress = idLower;
      else newUserObj.email = idLower;
      
      user = new User(newUserObj);
    } else {
      if (displayName && user.displayName === "New User") {
        user.displayName = displayName;
      }
    }

    // Check for existing membership
    const existing = user.memberships.find(
      (m) => m.organization.toString() === req.params.orgId
    );

    if (existing) {
      existing.roleLevel = roleLevel;
      existing.roleLabel = roleLabel;
      existing.isActive = true;
    } else {
      user.memberships.push({
        organization: req.params.orgId,
        roleLevel,
        roleLabel,
      });
    }

    await user.save();

    // Send invite email notification (non-fatal — invite succeeds even if email fails)
    const recipientEmail = isWallet ? null : idLower;
    if (recipientEmail) {
      try {
        const org = await Organization.findById(req.params.orgId).select("name").lean();
        const orgName = org ? org.name : "your organization";
        const roleName = roleLabel || `Level ${roleLevel} Member`;
        const inviterName = req.user.displayName || "An administrator";

        await sendEmail(
          recipientEmail,
          `You've been added to ${orgName} on ChainBudget`,
          `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a0a2e,#16082a);padding:32px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#e879f9;letter-spacing:-0.5px;">ChainBudget</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;">Transparent On-Chain Budgets</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">You've been invited! 🎉</p>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
            <strong style="color:rgba(255,255,255,0.8);">${inviterName}</strong> has added you to
            <strong style="color:#e879f9;">${orgName}</strong> as a
            <strong style="color:rgba(255,255,255,0.8);">${roleName}</strong>.
          </p>
          <!-- Divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;"></div>
          <!-- Steps -->
          <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Getting started</p>
          ${[
            ['1', 'Download the ChainBudget mobile app on your phone'],
            ['2', 'Tap <strong style="color:#e879f9;">Create Account</strong>'],
            ['3', `Enter your email: <strong style="color:#e879f9;">${recipientEmail}</strong>`],
            ['4', 'Your secure wallet will be created automatically'],
          ].map(([n, text]) => `
          <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;width:100%;">
            <tr>
              <td style="width:32px;height:32px;background:rgba(168,85,247,0.15);border-radius:50%;text-align:center;vertical-align:middle;">
                <span style="color:#a855f7;font-weight:700;font-size:13px;">${n}</span>
              </td>
              <td style="padding-left:12px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">${text}</td>
            </tr>
          </table>`).join('')}
          <!-- Important note -->
          <div style="margin-top:24px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:12px;padding:14px;">
            <p style="margin:0;font-size:13px;color:rgba(251,191,36,0.9);line-height:1.6;">
              ⚠️ <strong>Use this exact email address when registering:</strong><br/>
              <span style="font-family:monospace;font-size:14px;color:#fbbf24;">${recipientEmail}</span><br/>
              This links your wallet to your membership in ${orgName}.
            </p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">Your private key is generated on your device and never shared with anyone.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
        );
      } catch (emailErr) {
        console.warn("[invite] Email notification failed (non-fatal):", emailErr.message);
      }
    }

    res.status(201).json({ message: "Member added/updated", user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/// DELETE /api/users/:orgId/members/:userId — Remove member (Level 1 only)
router.delete(
  "/:orgId/members/:userId",
  authenticate,
  requireRole(1),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const membership = user.memberships.find(
        (m) => m.organization.toString() === req.params.orgId
      );
      if (membership) membership.isActive = false;
      await user.save();

      res.json({ message: "Member removed" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/// POST /api/users/push-token — Register or refresh an Expo push token for a device
/// Called by mobile app after login; safe to call on every login (deduplicates).
router.post("/push-token", authenticate, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ error: "token and platform are required" });
    }
    if (!["ios", "android"].includes(platform)) {
      return res.status(400).json({ error: "platform must be 'ios' or 'android'" });
    }
    if (!token.startsWith("ExponentPushToken[")) {
      return res.status(400).json({ error: "Invalid Expo push token format" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Deduplicate: update existing token or push a new one
    const existingIdx = user.pushTokens?.findIndex((t) => t.token === token);
    if (existingIdx !== undefined && existingIdx >= 0) {
      user.pushTokens[existingIdx].updatedAt = new Date();
    } else {
      user.pushTokens = user.pushTokens || [];
      user.pushTokens.push({ token, platform });
    }

    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error("[push-token]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * sendPushNotifications
 *
 * Sends push notifications to one or more users via the Expo Push API.
 * This is a fire-and-forget helper — failures are logged but do not throw.
 *
 * @param {string[]} userIds       - MongoDB User IDs to notify
 * @param {string}   title         - Notification title
 * @param {string}   body          - Notification body text
 * @param {object}   data          - Extra data payload (e.g. { txId, screen })
 */
async function sendPushNotifications(userIds, title, body, data = {}) {
  try {
    // Fetch push tokens for all target users
    const users = await User.find({ _id: { $in: userIds }, "pushTokens.0": { $exists: true } })
      .select("pushTokens")
      .lean();

    const tokens = users.flatMap((u) => u.pushTokens?.map((t) => t.token) || []);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data,
      channelId: data.channelId || "chainbudget-default",
    }));

    // Send via Expo Push API (https://exp.host/--/api/v2/push/send)
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    if (result.errors) {
      console.warn("[Push] Expo push API errors:", result.errors);
    }
  } catch (err) {
    console.error("[Push] Failed to send push notifications:", err.message || err);
  }
}

module.exports.sendPushNotifications = sendPushNotifications;
