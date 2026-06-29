const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const { GoogleGenAI } = require("@google/genai");

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Multer storage for image upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed for scanning"), false);
    }
  }
});

// ── 1. AI Proposal Analyzer ───────────────────────────────────────────────────
router.post("/analyze-proposal", authenticate, async (req, res) => {
  try {
    const { title, description, amount, currentBudget } = req.body;
    
    if (!title || !description || amount === undefined) {
      return res.status(400).json({ error: "Missing proposal details" });
    }

    const prompt = `
      You are an expert financial and risk analyst for a DAO (Decentralized Autonomous Organization).
      Analyze the following proposal:
      Title: "${title}"
      Description: "${description}"
      Requested Amount: ₱${amount}
      Organization's Current Treasury/Budget: ₱${currentBudget || "Unknown"}
      
      Provide your analysis in EXACTLY the following JSON format without any markdown wrappers or additional text:
      {
        "summary": "A 1-2 sentence concise summary of what this proposal is.",
        "pros": ["Pro 1", "Pro 2"],
        "cons": ["Con 1", "Con 2"],
        "riskScore": 5, // Integer from 1 (Very Low Risk) to 10 (Very High Risk)
        "riskReason": "1 sentence explaining the risk score."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text);
    res.json(data);
  } catch (error) {
    console.error("Error analyzing proposal:", error.message);
    res.status(500).json({ error: "Failed to analyze proposal" });
  }
});

// ── 2. AI Smart Receipt Scanner ───────────────────────────────────────────────
router.post("/scan-receipt", authenticate, upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No receipt image uploaded" });
    }

    const imageParts = [
      {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype,
        },
      },
    ];

    const prompt = `
      You are an OCR and expense data extraction AI. Read the attached receipt image and extract the key information.
      Map the items to one of these predefined categories: "logistics", "marketing", "operations", "meals", "software", "travel", "supplies", or "other".
      
      Respond in EXACTLY this JSON format without markdown:
      {
        "merchant": "Name of the store/merchant",
        "totalAmount": 1234.50, // Use number, not string. Remove currency symbols.
        "date": "YYYY-MM-DD", // Date of the receipt if visible, else null
        "suggestedCategory": "meals" // Must be one of the predefined categories above
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [prompt, ...imageParts],
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text);
    res.json(data);
  } catch (error) {
    console.error("Error scanning receipt:", error.message);
    res.status(500).json({ error: "Failed to scan receipt" });
  }
});

// ── 3. AI Financial Forecaster ────────────────────────────────────────────────
router.get("/forecast", authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const Transaction = require("../models/Transaction");
    const Org = require("../models/Organization");

    const org = await Org.findById(orgId);
    if (!org) return res.status(404).json({ error: "Org not found" });

    const totalTreasury = org.treasuryBalance || 0;
    
    // Get recent 20 transactions
    const txs = await Transaction.find({ organization: orgId }).sort({ createdAt: -1 }).limit(20);
    const txSummary = txs.map(t => `${t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'N/A'}: ₱${t.amount} for ${t.category} (${t.description})`).join("\n");

    const prompt = `
      You are the Chief Financial Officer (CFO) AI for an organization named "${org.name}".
      Current Treasury Balance: ₱${totalTreasury}
      
      Recent Transactions:
      ${txSummary || "No recent transactions found."}
      
      Analyze the spending patterns and current balance.
      Provide a concise 2-paragraph financial forecast and exactly 3 actionable insights/warnings.
      
      Respond in EXACTLY this JSON format without markdown:
      {
        "forecast": "Paragraph 1...\\n\\nParagraph 2...",
        "insights": [
          "Actionable insight 1",
          "Actionable insight 2",
          "Actionable insight 3"
        ],
        "healthStatus": "good" // Must be "good", "warning", or "critical"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text);
    res.json(data);
  } catch (error) {
    console.error("Error generating forecast:", error.message);
    res.status(500).json({ error: "Failed to generate financial forecast" });
  }
});

module.exports = router;
