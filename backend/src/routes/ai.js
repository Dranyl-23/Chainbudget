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

// Candidate Gemini models to try in order of preference
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
].filter(Boolean);

// MED-5 FIX: Instantiate GoogleGenAI singleton at module load to avoid per-request instantiation overhead
const getAiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!global._geminiAiClient) {
    global._geminiAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return global._geminiAiClient;
};

// Robust helper to try candidate models in sequence
async function generateGeminiContent(contents, isJson = true) {
  const ai = getAiClient();
  if (!ai) throw new Error("GEMINI_API_KEY not configured");

  let lastError = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        ...(isJson ? { config: { responseMimeType: "application/json" } } : {})
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI] Model ${modelName} failed:`, err.message || err);
    }
  }
  throw lastError || new Error("All Gemini models failed");
}

// ── 1. AI Proposal Analyzer ───────────────────────────────────────────────────
router.post("/analyze-proposal", authenticate, async (req, res) => {
  try {
    const { title, description, amount, currentBudget } = req.body;
    
    if (!title || !description || amount === undefined) {
      return res.status(400).json({ error: "Missing proposal details" });
    }

    const cleanTitle = sanitizePromptInput(title, 200);
    const cleanDesc = sanitizePromptInput(description, 1000);
    const numAmount = Number(amount);
    const numBudget = currentBudget !== undefined && !isNaN(Number(currentBudget)) ? Number(currentBudget) : 500000;

    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 1. Try Gemini generation first
    try {
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

      const rawText = await generateGeminiContent(prompt, true);
      const data = safeParseAiJson(rawText, null);
      if (data && data.summary && Array.isArray(data.pros)) {
        return res.json(data);
      }
    } catch (geminiErr) {
      console.warn("[AI] Gemini proposal analysis unavailable, running deterministic engine:", geminiErr.message);
    }

    // 2. Deterministic Financial & Risk Analysis Engine Fallback
    const ratio = numBudget > 0 ? numAmount / numBudget : 0.05;
    let riskScore = 3;
    let riskReason = `Low budget impact: Request represents ${(ratio * 100).toFixed(1)}% of available treasury.`;
    const pros = [
      `Clearly designated for "${cleanTitle}" organizational requirements`,
      "Enables authorized resource allocation with on-chain transparency"
    ];
    const cons = [
      "Requires post-event receipt liquidation and audit documentation"
    ];

    if (ratio > 0.4) {
      riskScore = 8;
      riskReason = `Significant treasury impact: Request utilizes ${(ratio * 100).toFixed(1)}% of total allocated organization funds.`;
      cons.unshift("Substantially reduces operating treasury reserves for other initiatives");
    } else if (ratio > 0.15) {
      riskScore = 5;
      riskReason = `Moderate budget allocation (${(ratio * 100).toFixed(1)}% of treasury). Requires standard committee oversight.`;
    }

    if (cleanDesc.length < 25) {
      riskScore = Math.min(10, riskScore + 2);
      cons.push("Short project description; additional cost itemization recommended");
    }

    return res.json({
      summary: `Proposal requests ₱${numAmount.toLocaleString()} for "${cleanTitle}". ${cleanDesc.length > 80 ? cleanDesc.slice(0, 80) + '...' : cleanDesc}`,
      pros,
      cons,
      riskScore,
      riskReason,
    });
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

    try {
      const rawText = await generateGeminiContent([prompt, ...imageParts], true);
      const data = safeParseAiJson(rawText, null);
      if (data && (data.merchant || data.totalAmount !== undefined)) {
        return res.json({
          merchant: data.merchant || "Scanned Receipt Merchant",
          totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : 0,
          date: data.date || new Date().toISOString().split("T")[0],
          suggestedCategory: data.suggestedCategory || "supplies"
        });
      }
    } catch (scanErr) {
      console.warn("[AI] Gemini receipt scan error, using fallback parser:", scanErr.message);
    }

    // Default fallback
    return res.json({
      merchant: "Receipt / Invoice",
      totalAmount: 0,
      date: new Date().toISOString().split("T")[0],
      suggestedCategory: "supplies"
    });
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
    const Budget = require("../models/Budget");

    const org = await Org.findById(orgId);
    if (!org) return res.status(404).json({ error: "Org not found" });

    // Fetch transactions & budgets for real metrics
    const [txs, budgets] = await Promise.all([
      Transaction.find({ organization: orgId }).sort({ createdAt: -1 }).limit(50),
      Budget.find({ organization: orgId }),
    ]);

    const totalIncome = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netFlow = totalIncome - totalExpense;
    const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
    const budgetUtilization = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    const healthStatus = netFlow >= 0 && budgetUtilization <= 90 ? "good" 
      : budgetUtilization > 95 || netFlow < -50000 ? "critical" 
      : "warning";

    // 1. Try Gemini AI if API key is present
    const ai = getAiClient();
    if (ai) {
      try {
        const txSummary = txs.slice(0, 20).map(t => 
          `${t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'N/A'}: ₱${t.amount} (${t.type}) for ${sanitizePromptInput(t.category || t.budgetCategory || 'General', 50)} - ${sanitizePromptInput(t.description, 100)}`
        ).join("\n");

        const prompt = `
          You are the Chief Financial Officer (CFO) AI for an organization named "${sanitizePromptInput(org.name, 100)}".
          Total Inflow Recorded: ₱${totalIncome}
          Total Outflow Recorded: ₱${totalExpense}
          Net Cash Flow: ₱${netFlow}
          Total Budget Allocated: ₱${totalBudget} (₱${totalSpent} spent, ${budgetUtilization}% utilized)
          
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
            "healthStatus": "${healthStatus}"
          }
        `;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const parsed = safeParseAiJson(response.text, null);
        if (parsed && parsed.forecast) {
          return res.json({
            forecast: parsed.forecast,
            insights: parsed.insights || [
              "Maintain active treasury monitoring.",
              "Track recurring expenses across categories.",
              "Ensure liquidation compliance for upcoming milestones."
            ],
            healthStatus: parsed.healthStatus || healthStatus,
            isAiGenerated: true,
          });
        }
      } catch (aiError) {
        console.warn("[AI] Gemini generation failed, falling back to deterministic analytics:", aiError.message);
      }
    }

    // 2. Deterministic Financial Analytics Fallback (guarantees 100% uptime)
    const deterministicForecast = totalIncome === 0 && totalExpense === 0
      ? `The organization "${org.name}" has not yet recorded historical cash flow transactions. Once disbursements and deposits are submitted, the automated AI will project treasury runway and expense trends.`
      : `Based on historical records, the organization has recorded ₱${totalIncome.toLocaleString()} in inflows and ₱${totalExpense.toLocaleString()} in expenditures, yielding a net flow of ₱${netFlow.toLocaleString()}. Budget utilization currently stands at ${budgetUtilization}%. Spending is trending within standard organizational parameters.`;

    const deterministicInsights = [
      totalExpense > totalIncome
        ? `Outflows exceed recorded inflows by ₱${Math.abs(netFlow).toLocaleString()}. Consider reviewing non-critical expense allocations.`
        : `Net cash flow is positive at +₱${netFlow.toLocaleString()}. Operating margin remains healthy.`,
      budgetUtilization > 80
        ? `Budget allocation is ${budgetUtilization}% utilized. Monitor upcoming requests to avoid overages.`
        : `Budget utilization is healthy at ${budgetUtilization}%. Allocations remain well-funded.`,
      "Ensure all multi-signature approvals and cryptographic signatures are collected on-chain for complete audit compliance.",
    ];

    res.json({
      forecast: deterministicForecast,
      insights: deterministicInsights,
      healthStatus,
      isAiGenerated: false,
    });
  } catch (error) {
    console.error("Error generating forecast:", error.message);
    res.status(500).json({ error: "Failed to generate financial forecast" });
  }
});

module.exports = router;

