/**
 * Tests: Multi-Provider AI Fallback Suite (Gemini -> Groq -> OpenRouter)
 *
 * Verifies:
 *  - Providers status inspection
 *  - Proper sequential fallback chain
 *  - Resilient error handling when providers are unconfigured or fail
 *
 * Run: node --test tests/aiProviders.test.js
 */

"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  getAiProvidersStatus,
  generateWithFallback,
} = require("../src/services/aiProviders");

describe("Multi-Provider AI Fallback Engine", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("getAiProvidersStatus accurately reflects environment configuration", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    let status = getAiProvidersStatus();
    assert.equal(status.gemini, false);
    assert.equal(status.groq, false);
    assert.equal(status.openrouter, false);
    assert.deepEqual(status.activeChain, ["deterministic"]);

    process.env.GEMINI_API_KEY = "test_gemini_key";
    process.env.GROQ_API_KEY = "test_groq_key";
    process.env.OPENROUTER_API_KEY = "test_openrouter_key";

    status = getAiProvidersStatus();
    assert.equal(status.gemini, true);
    assert.equal(status.groq, true);
    assert.equal(status.openrouter, true);
    assert.deepEqual(status.activeChain, ["gemini", "groq", "openrouter", "deterministic"]);
  });

  it("generateWithFallback throws when no providers are configured", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    await assert.rejects(
      async () => {
        await generateWithFallback({ prompt: "test prompt" });
      },
      /No AI provider keys configured/
    );
  });
});
