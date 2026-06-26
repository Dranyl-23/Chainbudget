require('dotenv').config();
const nodemailer = require("nodemailer");

console.log("Using SMTP_EMAIL:", process.env.SMTP_EMAIL);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function run() {
  try {
    const info = await transporter.sendMail({
      from: `"ChainBudget DAO Test" <${process.env.SMTP_EMAIL}>`,
      to: "barrabaandrie@g.cjc.edu.ph", // Sending to the Vice-President
      subject: "Test from Backend",
      text: "This is a test email.",
    });
    console.log("Message sent: %s", info.messageId);
    process.exit(0);
  } catch (err) {
    console.error("FAILED TO SEND:", err);
    process.exit(1);
  }
}

run();
