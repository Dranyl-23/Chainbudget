require("dotenv").config();
const { sendEmail } = require("./src/services/email");

(async () => {
  console.log("Testing email with user:", process.env.SMTP_EMAIL);
  const success = await sendEmail(
    "alfielynard23@gmail.com",
    "Test Email from ChainBudget",
    "<h1>This is a test email</h1><p>If you see this, the SMTP is working!</p>"
  );
  console.log("Email success:", success);
})();
