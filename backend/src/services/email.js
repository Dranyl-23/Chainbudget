const nodemailer = require("nodemailer");

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_EMAIL, // Admin's gmail address
      pass: process.env.SMTP_PASSWORD, // Gmail App Password
    },
  });
};

/**
 * Send an email notification
 * @param {string} to - Recipient email(s)
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 */
const sendEmail = async (to, subject, html) => {
  try {
    // If no SMTP configured, just log to console to prevent crashes
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.warn("SMTP credentials not found in .env. Skipping actual email dispatch.");
      console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
      return false;
    }

    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: `"ChainBudget DAO" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log("Message sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email: ", error);
    return false;
  }
};

module.exports = {
  sendEmail,
};
