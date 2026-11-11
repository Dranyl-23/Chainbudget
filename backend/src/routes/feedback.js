const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");
const { authenticate } = require("../middleware/auth");
const { sendEmail, escapeHtml } = require("../services/email");

/**
 * @route   POST /api/feedback
 * @desc    Submit user or tester feedback / bug report
 * @access  Private
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const {
      organizationId,
      type = "general",
      title = "",
      message,
      rating = 5,
      screenshotUrl = null,
      deviceInfo = {}
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Feedback message is required." });
    }

    const newFeedback = new Feedback({
      user: req.user._id,
      organization: organizationId || null,
      type,
      title: title.trim(),
      message: message.trim(),
      rating: Math.max(1, Math.min(5, Number(rating) || 5)),
      screenshotUrl,
      deviceInfo: {
        platform: deviceInfo.platform || "Android",
        osVersion: deviceInfo.osVersion || "",
        appVersion: deviceInfo.appVersion || "1.1.7",
        deviceModel: deviceInfo.deviceModel || "",
        brand: deviceInfo.brand || "",
      },
      status: "open",
    });

    await newFeedback.save();
    await newFeedback.populate("user", "displayName email walletAddress");

    // Send instant admin email alert (non-blocking)
    try {
      const recipientEmail =
        process.env.ADMIN_NOTIFICATION_EMAIL ||
        process.env.FEEDBACK_RECIPIENT_EMAIL ||
        process.env.SMTP_EMAIL;

      if (recipientEmail) {
        const typeLabels = {
          bug: "BUG REPORT",
          suggestion: "FEATURE IDEA",
          usability: "UI/UX FEEDBACK",
          general: "GENERAL FEEDBACK",
        };
        const badgeColor = type === "bug" ? "#EF4444" : type === "suggestion" ? "#10B981" : "#6366F1";
        const stars = "★".repeat(newFeedback.rating) + "☆".repeat(5 - newFeedback.rating);

        const safeTypeLabel = escapeHtml(typeLabels[type] || "FEEDBACK");
        const safeTitle = title ? escapeHtml(String(title)) : "";
        const safeMessage = escapeHtml(message.trim());
        const safeDisplayName = escapeHtml(req.user.displayName || "Anonymous");
        const safeEmail = escapeHtml(req.user.email || "No email");
        const safeWalletPrefix = escapeHtml(
          req.user.walletAddress ? `${req.user.walletAddress.slice(0, 10)}...` : "N/A"
        );
        const safeBrand = escapeHtml(deviceInfo?.brand || "");
        const safeDeviceModel = escapeHtml(
          deviceInfo?.deviceModel || deviceInfo?.platform || "Android"
        );
        const safeOsVersion = escapeHtml(deviceInfo?.osVersion || "N/A");
        const safeAppVersion = escapeHtml(deviceInfo?.appVersion || "1.1.7");

        const rawScreenshot = typeof screenshotUrl === "string" ? screenshotUrl.trim() : "";
        const isSafeScreenshotUrl =
          /^https?:\/\/[^\s"'<>]+$/i.test(rawScreenshot) ||
          /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(rawScreenshot);
        const safeScreenshotUrl = isSafeScreenshotUrl ? escapeHtml(rawScreenshot) : "";

        const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor};">
              ${safeTypeLabel}
            </span>
            <h2 style="color: #111827; margin: 12px 0 4px 0; font-size: 20px;">New Tester Feedback Received</h2>
            <p style="color: #6B7280; font-size: 14px; margin: 0;">Rating: <strong style="color: #F59E0B; font-size: 16px;">${stars}</strong> (${Number(newFeedback.rating)}/5)</p>
          </div>

          <div style="background-color: #F9FAFB; border-radius: 12px; padding: 16px; margin-bottom: 20px; border-left: 4px solid ${badgeColor};">
            ${safeTitle ? `<h4 style="margin: 0 0 8px 0; color: #111827; font-size: 15px;">${safeTitle}</h4>` : ""}
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
          </div>

          ${safeScreenshotUrl ? `
            <div style="margin-bottom: 20px;">
              <p style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">Attached Screenshot:</p>
              <a href="${safeScreenshotUrl}" target="_blank" rel="noopener noreferrer">
                <img src="${safeScreenshotUrl}" alt="Feedback Attachment" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #E5E7EB; object-fit: contain;" />
              </a>
            </div>
          ` : ""}

          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 12px; color: #6B7280;">
            <p style="margin: 4px 0;"><strong>Tester:</strong> ${safeDisplayName} (${safeEmail} | ${safeWalletPrefix})</p>
            <p style="margin: 4px 0;"><strong>Device:</strong> ${safeBrand} ${safeDeviceModel} (OS: ${safeOsVersion})</p>
            <p style="margin: 4px 0;"><strong>App Version:</strong> v${safeAppVersion}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })} PHT</p>
          </div>
        </div>
      `;

        const subjectTester = String(req.user.displayName || "Tester").replace(/[\r\n]+/g, " ");
        sendEmail(
          recipientEmail,
          `[ChainBudget Feedback] ${typeLabels[type] || "New Feedback"} from ${subjectTester} (${stars})`,
          htmlContent
        ).catch((err) => console.error("[feedback] Email notification error:", err.message));
      }
    } catch (mailErr) {
      console.error("[feedback] Mail build error:", mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Thank you for your feedback! It has been recorded.",
      feedback: newFeedback,
    });
  } catch (err) {
    console.error("[feedback] Submission error:", err);
    res.status(500).json({ error: "Failed to submit feedback. Please try again." });
  }
});

/**
 * @route   GET /api/feedback
 * @desc    Get user's past feedback or all feedback (for admin)
 * @access  Private
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const feedbackList = await Feedback.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ feedback: feedbackList });
  } catch (err) {
    console.error("[feedback] Fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
