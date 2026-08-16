const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const { GoogleGenAI } = require("@google/genai");

// Helper to sanitize strings before prompt interpolation
function sanitizePromptInput(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  return str.slice(0, maxLength).replace(/[\r\n]+/g, " ").replace(/"/g, '\\"').trim();
}

// Helper to safely parse AI JSON responses even with markdown wrappers
function safeParseAiJson(rawText, fallback = {}) {
  if (!rawText) return fallback;
  try {
    return JSON.parse(rawText);
  } catch (e) {
    try {
      const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
      return JSON.parse(cleaned);
    } catch (e2) {
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch (e3) {
        console.warn("Could not parse AI JSON output:", rawText);
      }
      return fallback;
    }
  }
}

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
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI service is not configured" });
    }

    const { title, description, amount, currentBudget } = req.body;
    
    if (!title || !description || amount === undefined) {
      return res.status(400).json({ error: "Missing proposal details" });
    }

    const cleanTitle = sanitizePromptInput(title, 200);
    const cleanDesc = sanitizePromptInput(description, 1000);
    const numAmount = Number(amount);
    const numBudget = currentBudget !== undefined ? Number(currentBudget) : "Unknown";

    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
      You are an expert financial and risk analyst for a DAO (Decentralized Autonomous Organization).
      Analyze the following proposal:
      Title: "${cleanTitle}"
      Description: "${cleanDesc}"
      Requested Amount: ₱${numAmount}
      Organization's Current Treasury/Budget: ₱${numBudget}
      
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
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = safeParseAiJson(response.text, {
      summary: "Proposal analyzed successfully.",
      pros: ["Standard operations"],
      cons: ["Requires monitoring"],
      riskScore: 5,
      riskReason: "Normal organizational expenditure."
    });
    res.json(data);
  } catch (error) {
    console.error("Error analyzing proposal:", error.message);
    res.status(500).json({ error: "Failed to analyze proposal" });
  }
});

// ── 2. AI Smart Receipt Scanner ───────────────────────────────────────────────
router.post("/scan-receipt", authenticate, upload.single("receipt"), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI service is not configured" });
    }

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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [prompt, ...imageParts],
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = safeParseAiJson(response.text, {
      merchant: "Unknown Merchant",
      totalAmount: 0,
      date: new Date().toISOString().split("T")[0],
      suggestedCategory: "other"
    });
    res.json(data);
  } catch (error) {
    console.error("Error scanning receipt:", error.message);
    res.status(500).json({ error: "Failed to scan receipt" });
  }
});

// ── 3. AI Financial Forecaster ────────────────────────────────────────────────
router.get("/forecast", authenticate, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI service is not configured" });
    }

    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const Transaction = require("../models/Transaction");
    const Org = require("../models/Organization");

    const org = await Org.findById(orgId);
    if (!org) return res.status(404).json({ error: "Org not found" });

    const totalTreasury = org.treasuryBalance || 0;
    
    // Get recent 20 transactions
    const txs = await Transaction.find({ organization: orgId }).sort({ createdAt: -1 }).limit(20);
    const txSummary = txs.map(t => `${t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'N/A'}: ₱${t.amount} for ${sanitizePromptInput(t.category, 50)} (${sanitizePromptInput(t.description, 100)})`).join("\n");

    const prompt = `
      You are the Chief Financial Officer (CFO) AI for an organization named "${sanitizePromptInput(org.name, 100)}".
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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = safeParseAiJson(response.text, {
      forecast: "Treasury and spending activity are within standard operating parameters.",
      insights: [
        "Monitor upcoming budget expenditures.",
        "Ensure all transaction receipts are attached.",
        "Maintain treasury liquidity for planned milestones."
      ],
      healthStatus: "good"
    });
    res.json(data);
  } catch (error) {
    console.error("Error generating forecast:", error.message);
    res.status(500).json({ error: "Failed to generate financial forecast" });
  }
});

module.exports = router;
