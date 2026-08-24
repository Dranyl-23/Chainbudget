const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEmail, escapeHtml } = require("./email");
const notificationQueue = require("./notificationQueue");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;

/**
 * NotificationService
 *
 * Centralized notification engine managing:
 * - Multi-channel delivery (Push via Expo, In-App via DB & WebSocket, Email via Nodemailer)
 * - User notification preference enforcement
 * - Push token batching and automatic dead token cleanup (DeviceNotRegistered)
 * - Structured event-based notification dispatchers with queue worker buffering
 */
class NotificationService {
  /**
   * Cleans up invalid or expired push tokens from a user's record.
   * @param {string} token
   */
  static async removeInvalidPushToken(token) {
    try {
      await User.updateMany(
        { "pushTokens.token": token },
        { $pull: { pushTokens: { token } } }
      );
      console.log(`[NotificationService] Pruned dead push token: ${token.slice(0, 20)}...`);
    } catch (err) {
      console.error("[NotificationService] Error pruning dead push token:", err.message);
    }
  }

  /**
   * Sends push notifications to a list of user IDs while respecting their preferences.
   *
   * @param {string[]} userIds - Array of MongoDB User IDs
   * @param {object} options
   * @param {string} options.title - Notification title
   * @param {string} options.body - Notification message body
   * @param {string} [options.category] - Preference key ('daoProposals', 'approvals', 'transactions', 'chatMentions', 'securityAlerts')
   * @param {string} [options.channelId] - Android notification channel ID
   * @param {object} [options.data] - Extra payload data for deep linking (e.g. { txId, screen })
   */
  static async sendPush(userIds, { title, body, category, channelId, data = {} }) {
    if (!userIds || userIds.length === 0) return;

    try {
      const users = await User.find({
        _id: { $in: userIds },
        "pushTokens.0": { $exists: true },
      })
        .select("pushTokens notificationPreferences")
        .lean();

      // Filter tokens by user preferences
      const tokens = [];
      for (const u of users) {
        const prefs = u.notificationPreferences || {};
        if (prefs.push === false) continue;
        if (category && prefs[category] === false) continue;

        if (u.pushTokens && u.pushTokens.length > 0) {
          for (const pt of u.pushTokens) {
            tokens.push(pt.token);
          }
        }
      }

      if (tokens.length === 0) {
        return;
      }

      const messages = tokens.map((to) => ({
        to,
        sound: "default",
        title,
        body,
        data,
        priority: "high",
        channelId: channelId || "chainbudget-default",
        _displayInForeground: true,
      }));

      // Send in chunks of 100
      for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
        const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
        try {
          const response = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          });

          const result = await response.json();

          // Handle dead tokens / tickets
          if (result.data && Array.isArray(result.data)) {
            result.data.forEach((ticket, idx) => {
              if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
                const deadToken = chunk[idx]?.to;
                if (deadToken) {
                  NotificationService.removeInvalidPushToken(deadToken);
                }
              }
            });
          }
        } catch (chunkErr) {
          console.error(`[NotificationService] Chunk dispatch error:`, chunkErr.message);
        }
      }
    } catch (err) {
      console.error("[NotificationService] Push delivery error:", err.message);
    }
  }

  /**
   * Creates an in-app notification record and broadcasts via Socket.IO.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} [params.recipientUserId=null] - Specific user recipient or null for org broadcast
   * @param {string} params.title
   * @param {string} params.message
   * @param {string} [params.type='info'] - 'urgent' | 'blockchain' | 'system' | 'info'
   * @param {object} [params.io] - Socket.io server instance
   * @returns {Promise<object>}
   */
  static async createInAppNotification({ organizationId, recipientUserId = null, title, message, type = "info", io = null }) {
    try {
      const notif = await Notification.create({
        organization: organizationId,
        recipientUser: recipientUserId || null,
        title,
        message,
        type,
        readBy: [],
      });

      if (io) {
        const payload = {
          _id: notif._id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          organization: organizationId,
          createdAt: notif.createdAt,
        };

        if (recipientUserId) {
          io.to(`user:${recipientUserId.toString()}`).emit("new_notification", payload);
          io.to(`user:${recipientUserId.toString()}`).emit("notification", payload);
        } else if (organizationId) {
          io.to(`org:${organizationId}`).emit("new_notification", payload);
          io.to(`org:${organizationId}`).emit("notification", payload);
        }
      }

      return notif;
    } catch (err) {
      console.error("[NotificationService] Failed to create in-app notification:", err.message);
      return null;
    }
  }

  // ── High-Level Event Handlers (Queue-Backed) ────────────────────────────────

  /**
   * Event: Transaction Created / Approval Needed
   */
  static notifyTransactionCreated({ transaction, creator, organization, approverUserIds = [], io = null }) {
    return notificationQueue.enqueue("transaction_created", async () => {
      const isUrgent = transaction.urgency === "urgent";
      const title = isUrgent
        ? `🚨 Urgent Approval Needed: ₱${transaction.amount.toLocaleString()}`
        : `New Transaction: ₱${transaction.amount.toLocaleString()}`;
      const body = `${creator.displayName || "A member"} recorded "${transaction.description}" in ${organization.name}.`;

      // 1. In-App Notification
      await NotificationService.createInAppNotification({
        organizationId: organization._id,
        title,
        message: body,
        type: isUrgent ? "urgent" : "info",
        io,
      });

      // 2. Push Notification to Approvers
      if (approverUserIds.length > 0) {
        await NotificationService.sendPush(approverUserIds, {
          title,
          body,
          category: "approvals",
          channelId: "chainbudget-approvals",
          data: {
            txId: transaction._id.toString(),
            screen: "Approvals",
            urgency: transaction.urgency,
          },
        });
      }
    });
  }

  /**
   * Event: Approval Action (Approved / Completed)
   */
  static notifyApprovalAction({ transaction, approver, organization, isFinalApproval, io = null }) {
    return notificationQueue.enqueue("approval_action", async () => {
      const title = isFinalApproval
        ? `✅ Transaction Fully Approved: ₱${transaction.amount.toLocaleString()}`
        : `Approval Recorded: ₱${transaction.amount.toLocaleString()}`;
      const body = `${approver.displayName || "An officer"} approved "${transaction.description}".`;

      // 1. In-App Notification (Targeted specifically to the submitter)
      await NotificationService.createInAppNotification({
        organizationId: organization._id,
        recipientUserId: transaction.submittedBy ? transaction.submittedBy.toString() : null,
        title,
        message: body,
        type: isFinalApproval ? "blockchain" : "info",
        io,
      });

      // 2. Push Notification to Submitter
      if (transaction.submittedBy) {
        await NotificationService.sendPush([transaction.submittedBy.toString()], {
          title,
          body,
          category: "transactions",
          channelId: "chainbudget-approvals",
          data: {
            txId: transaction._id.toString(),
            screen: "TransactionDetail",
          },
        });
      }
    });
  }

  /**
   * Event: DAO Proposal Created
   */
  static notifyDaoProposalCreated({ proposal, creator, organization, memberUserIds = [], io = null }) {
    return notificationQueue.enqueue("dao_proposal_created", async () => {
      const title = `🗳️ New DAO Proposal: ${proposal.title}`;
      const body = `${creator.displayName || "A member"} submitted a new budget proposal in ${organization.name}.`;

      // 1. In-App Notification
      await NotificationService.createInAppNotification({
        organizationId: organization._id,
        title,
        message: body,
        type: "system",
        io,
      });

      // 2. Push Notification to Org Members
      if (memberUserIds.length > 0) {
        await NotificationService.sendPush(memberUserIds, {
          title,
          body,
          category: "daoProposals",
          channelId: "chainbudget-dao",
          data: {
            proposalId: proposal._id.toString(),
            screen: "DAO",
          },
        });
      }
    });
  }

  /**
   * Event: Chat Message Sent (Real-time Status Bar & Lock Screen Notification)
   */
  static notifyChatMessage({ orgId, orgName, sender, content, recipientUserIds = [] }) {
    if (!recipientUserIds || recipientUserIds.length === 0) return;

    return notificationQueue.enqueue("chat_message", async () => {
      const senderName = sender?.displayName || "A member";
      const preview = content.length > 80 ? `${content.substring(0, 77)}...` : content;

      await NotificationService.sendPush(recipientUserIds, {
        title: orgName || "Organization Chat",
        body: `${senderName}: ${preview}`,
        category: "chatMentions",
        channelId: "chainbudget-chat",
        data: {
          orgId: orgId.toString(),
          screen: "OrgChat",
        },
      });
    });
  }
}

module.exports = NotificationService;
