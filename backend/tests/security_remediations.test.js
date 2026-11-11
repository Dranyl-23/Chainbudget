"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("Security remediations across backend & ops scripts", () => {
  test("API-02: /execute and /retry-sync do not use body-less requireRole(2) middleware", () => {
    const src = read("src/routes/transactions.js");
    assert.doesNotMatch(src, /router\.patch\(\s*["']\/:id\/execute["']\s*,\s*authenticate\s*,\s*requireRole\(/);
    assert.doesNotMatch(src, /router\.post\(\s*["']\/:id\/retry-sync["']\s*,\s*authenticate\s*,\s*requireRole\(/);
    assert.match(src, /retry-sync[\s\S]*roleLevel > 2/);
  });

  test("API-03: transactions & feedback routes HTML-escape interpolated user fields", () => {
    const txSrc = read("src/routes/transactions.js");
    assert.match(txSrc, /escapeHtml/);
    assert.match(txSrc, /escapeHtml\(description\)/);
    assert.match(txSrc, /escapeHtml\(req\.user\.displayName/);

    const fbSrc = read("src/routes/feedback.js");
    assert.match(fbSrc, /escapeHtml/);
    assert.doesNotMatch(fbSrc, /alfielynard23@gmail\.com/);
    assert.match(fbSrc, /isSafeScreenshotUrl/);
  });

  test("API-04: blockchainSyncWorker validates submitter wallet and skips ZeroAddress", () => {
    const workerSrc = read("src/services/blockchainSyncWorker.js");
    assert.doesNotMatch(workerSrc, /"0x0000000000000000000000000000000000000000"/);
    assert.match(workerSrc, /ethers\.isAddress\(recipientWallet\)/);
    assert.match(workerSrc, /ethers\.ZeroAddress/);
  });

  test("SC-04: escrow release accepts payeeSig/signature and never fabricates chainbudget:// evidence", () => {
    const txSrc = read("src/routes/transactions.js");
    assert.doesNotMatch(txSrc, /chainbudget:\/\/escrow-release/);
    assert.match(txSrc, /payeeSig\s*=\s*req\.body\?\.payeeSig\s*\|\|\s*req\.body\?\.signature/);
  });

  test("SC-05: Transaction schema and approvals enforce EIP-712 approvalDeadline", () => {
    const modelSrc = read("src/models/Transaction.js");
    assert.match(modelSrc, /approvalDeadline:\s*\{\s*type:\s*Number\s*\}/);

    const approvalsSrc = read("src/routes/approvals.js");
    assert.match(approvalsSrc, /txn\.approvalDeadline/);
    assert.match(approvalsSrc, /\{\s*name:\s*["']deadline["']\s*,\s*type:\s*["']uint256["']\s*\}/);
  });

  test("OPS-01: resetDatabase script refuses execution in production and without --confirm-wipe", () => {
    const prodRun = spawnSync(process.execPath, [path.join(ROOT, "scripts", "resetDatabase.js")], {
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
    });
    assert.notStrictEqual(prodRun.status, 0);
    assert.match(prodRun.stderr, /production/i);

    const noFlagRun = spawnSync(process.execPath, [path.join(ROOT, "scripts", "resetDatabase.js")], {
      env: { ...process.env, NODE_ENV: "development" },
      encoding: "utf8",
    });
    assert.notStrictEqual(noFlagRun.status, 0);
    assert.match(noFlagRun.stderr, /--confirm-wipe/);
  });
});
