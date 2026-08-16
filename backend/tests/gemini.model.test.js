/**
 * Tests: Gemini Model Configuration (Fix 4 — LOW)
 *
 * Verifies:
 *  - No active configuration references gemini-3.5-flash.
 *  - All three AI routes use gemini-2.0-flash.
 *
 * Run: node --test tests/gemini.model.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const AI_ROUTE_PATH = path.resolve(__dirname, "../src/routes/ai.js");

describe("Gemini Model Configuration — Fix 4", () => {

  it("source file does not contain any reference to gemini-3.5-flash", () => {
    const source = fs.readFileSync(AI_ROUTE_PATH, "utf8");
    const occurrences = (source.match(/gemini-3\.5-flash/g) || []).length;
    assert.equal(
      occurrences,
      0,
      `Found ${occurrences} reference(s) to the invalid model name 'gemini-3.5-flash' in ai.js`
    );
  });

  it("source file contains exactly 3 references to gemini-2.0-flash (one per endpoint)", () => {
    const source = fs.readFileSync(AI_ROUTE_PATH, "utf8");
    const occurrences = (source.match(/gemini-2\.0-flash/g) || []).length;
    assert.equal(
      occurrences,
      3,
      `Expected 3 references to 'gemini-2.0-flash' (one per AI endpoint), found ${occurrences}`
    );
  });

  it("no other file in the repo (outside tests/) references gemini-3.5-flash", () => {
    const backendRoot = path.resolve(__dirname, "..");
    const badRefs = [];

    function scanDir(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "tests") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".ts") || entry.name.endsWith(".json"))) {
          const content = fs.readFileSync(full, "utf8");
          if (content.includes("gemini-3.5-flash")) {
            badRefs.push(full);
          }
        }
      }
    }

    // Scan from the project root (two levels up from tests/), excluding test files
    const projectRoot = path.resolve(__dirname, "../..");
    scanDir(projectRoot);

    assert.deepEqual(
      badRefs,
      [],
      `Found invalid model name 'gemini-3.5-flash' in: ${badRefs.join(", ")}`
    );
  });

  it("AI endpoint error handling wrapper is present for all endpoints", () => {
    // Verify that all three AI endpoints have try/catch error handling
    const source = fs.readFileSync(AI_ROUTE_PATH, "utf8");
    const routeMatches = source.match(/router\.(post|get)\s*\(/g) || [];
    const catchMatches = source.match(/\}\s*catch\s*\(error\)/g) || [];
    // There are 3 routes; each must have a catch block
    assert.ok(
      catchMatches.length >= 3,
      `Expected at least 3 catch blocks in AI routes for proper error handling, found ${catchMatches.length}`
    );
  });
});
