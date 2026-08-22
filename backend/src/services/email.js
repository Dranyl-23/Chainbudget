const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (!transporter && process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_EMAIL.trim(),
        pass: process.env.SMTP_PASSWORD.replace(/\s+/g, ''),
      },
    });
  }
  return transporter;
};

/**
 * Send an email notification
 * @param {string} to - Recipient email(s)
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 */
const sendEmail = async (to, subject, html) => {
  try {
    // If no SMTP configured, log to console to prevent crashes
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.warn("[EMAIL] SMTP credentials not configured. Skipping email dispatch.");
      return false;
    }

    const emailTransporter = getTransporter();
    if (!emailTransporter) {
      return false;
    }
    
    const info = await emailTransporter.sendMail({
      from: `"ChainBudget DAO" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log("[EMAIL] Notification dispatched: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending email: ", error.message);
    return false;
  }
};

module.exports = {
  sendEmail,
};
