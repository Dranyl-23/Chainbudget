const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

// Candidate Gemini models in order of preference
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
].filter(Boolean);

// Groq candidate models
const GROQ_TEXT_MODELS = [
  process.env.GROQ_MODEL,
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter(Boolean);
const GROQ_VISION_MODELS = ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"];

// OpenRouter candidate models
const OPENROUTER_TEXT_MODELS = [
  process.env.OPENROUTER_MODEL,
  "liquid/lfm-2.5-2.6b:free",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
  "meta-llama/llama-3.1-8b-instruct",
].filter(Boolean);
const OPENROUTER_VISION_MODELS = ["meta-llama/llama-3.2-11b-vision-instruct", "google/gemini-2.0-flash-001"];

// Gemini singleton client
const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!global._geminiAiClient) {
    global._geminiAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return global._geminiAiClient;
};

/**
 * Call Google Gemini with automatic model fallback
 */
async function callGemini({ prompt, image, isJson = true }) {
  const ai = getGeminiClient();
  if (!ai) throw new Error("GEMINI_API_KEY not configured");

  let contents;
  if (image && image.buffer) {
    contents = [
      prompt,
      {
        inlineData: {
          data: image.buffer.toString("base64"),
          mimeType: image.mimetype || "image/jpeg",
        },
      },
    ];
  } else {
    contents = prompt;
  }

  let lastError = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        ...(isJson ? { config: { responseMimeType: "application/json" } } : {}),
      });
      if (response && response.text) {
        return {
          text: response.text,
          provider: "gemini",
          model: modelName,
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI:Gemini] Model ${modelName} failed:`, err.message || err);
    }
  }
  throw lastError || new Error("All Gemini models failed");
}

/**
 * Call Groq Cloud (Ultra-fast LPU inference)
 */
async function callGroq({ prompt, image, isJson = true }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const candidateModels = image ? GROQ_VISION_MODELS : GROQ_TEXT_MODELS;

  let messages;
  if (image && image.buffer) {
    messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${image.mimetype || "image/jpeg"};base64,${image.buffer.toString("base64")}`,
            },
          },
        ],
      },
    ];
  } else {
    messages = [{ role: "user", content: prompt }];
  }

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const payload = {
        model,
        messages,
        temperature: 0.2,
        ...(isJson ? { response_format: { type: "json_object" } } : {}),
      };

      const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return {
          text: content,
          provider: "groq",
          model,
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI:Groq] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
    }
  }

  throw lastError || new Error("All Groq models failed");
}

/**
 * Call OpenRouter (Multi-model aggregator)
 */
async function callOpenRouter({ prompt, image, isJson = true }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const candidateModels = image ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS;

  let messages;
  if (image && image.buffer) {
    messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${image.mimetype || "image/jpeg"};base64,${image.buffer.toString("base64")}`,
            },
          },
        ],
      },
    ];
  } else {
    messages = [{ role: "user", content: prompt }];
  }

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const payload = {
        model,
        messages,
        temperature: 0.2,
        ...(isJson ? { response_format: { type: "json_object" } } : {}),
      };

      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://chainbudget-api.fly.dev",
          "X-Title": "ChainBudgets AI Engine",
        },
        timeout: 20000,
      });

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return {
          text: content,
          provider: "openrouter",
          model,
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI:OpenRouter] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
    }
  }

  throw lastError || new Error("All OpenRouter models failed");
}

/**
 * Multi-Provider AI Fallback Engine
 * Sequentially tries: Gemini -> Groq -> OpenRouter
 */
async function generateWithFallback({ prompt, image = null, isJson = true }) {
  const errors = [];

  // 1. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await callGemini({ prompt, image, isJson });
      return res;
    } catch (err) {
      console.warn("[AI Orchestrator] Gemini failed, attempting next provider:", err.message);
      errors.push({ provider: "gemini", error: err.message });
    }
  }

  // 2. Try Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await callGroq({ prompt, image, isJson });
      return res;
    } catch (err) {
      console.warn("[AI Orchestrator] Groq failed, attempting next provider:", err.message);
      errors.push({ provider: "groq", error: err.message });
    }
  }

  // 3. Try OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const res = await callOpenRouter({ prompt, image, isJson });
      return res;
    } catch (err) {
      console.warn("[AI Orchestrator] OpenRouter failed:", err.message);
      errors.push({ provider: "openrouter", error: err.message });
    }
  }

  const err = new Error(
    errors.length > 0
      ? `All AI providers failed: ${errors.map(e => `${e.provider} (${e.error})`).join(", ")}`
      : "No AI provider keys configured (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY)"
  );
  err.providerErrors = errors;
  throw err;
}

/**
 * Inspect configured AI providers status
 */
function getAiProvidersStatus() {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    models: {
      gemini: GEMINI_MODELS,
      groq: GROQ_TEXT_MODELS,
      openrouter: OPENROUTER_TEXT_MODELS,
    },
    activeChain: [
      process.env.GEMINI_API_KEY ? "gemini" : null,
      process.env.GROQ_API_KEY ? "groq" : null,
      process.env.OPENROUTER_API_KEY ? "openrouter" : null,
      "deterministic",
    ].filter(Boolean),
  };
}

module.exports = {
  GEMINI_MODEL,
  GEMINI_MODELS,
  callGemini,
  callGroq,
  callOpenRouter,
  generateWithFallback,
  getAiProvidersStatus,
};
