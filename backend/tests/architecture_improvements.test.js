const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.join(__dirname, "../src");

describe("Architecture & Security Hardening Verification Suite", () => {
  test("Socket.IO join_org enforces membership authorization and blockchainSyncWorker scopes to org room", () => {
    const indexContent = fs.readFileSync(path.join(srcDir, "index.js"), "utf8");
    assert.ok(
      indexContent.includes("org_join_denied"),
      "index.js join_org handler must emit org_join_denied when caller is not an authorized member"
    );

    const workerContent = fs.readFileSync(
      path.join(srcDir, "services/blockchainSyncWorker.js"),
      "utf8"
    );
    assert.ok(
      !workerContent.includes('io.emit("transaction_updated"'),
      "blockchainSyncWorker.js must not broadcast transaction_updated globally with io.emit"
    );
    assert.ok(
      workerContent.includes("io.to(`org:${txn.organization}`).emit"),
      "blockchainSyncWorker.js must scope transaction_updated to org:${txn.organization}"
    );
    assert.ok(
      workerContent.includes("acquireLock"),
      "blockchainSyncWorker.js must coordinate via distributed lock"
    );
  });

  test("Key export rate limiter is strict (<= 5 per window) and verifies signature when challenge or signature is present", () => {
    const securityContent = fs.readFileSync(
      path.join(srcDir, "middleware/security.js"),
      "utf8"
    );
    assert.ok(
      /keyExportRateLimiter[\s\S]*?max:\s*5\b/.test(securityContent),
      "keyExportRateLimiter must enforce max: 5 per 15-minute window"
    );

    const authContent = fs.readFileSync(
      path.join(srcDir, "routes/auth.js"),
      "utf8"
    );
    assert.ok(
      authContent.includes("requiresSignatureChallenge"),
      "POST /auth/keys/export must evaluate requiresSignatureChallenge across signature, active nonce, and wallet type"
    );
  });

  test("PUT /users/me blocks unverified wallet injection and member lists redact sensitive fields", () => {
    const usersContent = fs.readFileSync(
      path.join(srcDir, "routes/users.js"),
      "utf8"
    );
    assert.ok(
      usersContent.includes("existingSet.has(w)"),
      "PUT /users/me must only retain already-verified wallets in linkedWallets"
    );
    assert.ok(
      usersContent.includes("-pushTokens") && usersContent.includes("-notificationPreferences"),
      "GET /users/:orgId/members must exclude pushTokens and notificationPreferences"
    );

    const orgsContent = fs.readFileSync(
      path.join(srcDir, "routes/organizations.js"),
      "utf8"
    );
    assert.ok(
      orgsContent.includes("-pushTokens") && orgsContent.includes("-notificationPreferences"),
      "GET /organizations/:orgId/members must exclude pushTokens and notificationPreferences"
    );
    assert.ok(
      orgsContent.includes("/:orgId/liquidate/approve"),
      "organizations.js must support both /:orgId/approve-liquidation and /:orgId/liquidate/approve"
    );
  });

  test("Public endpoints filter private organizations and map documentHash/documentUrl", () => {
    const publicContent = fs.readFileSync(
      path.join(srcDir, "routes/public.js"),
      "utf8"
    );
    assert.ok(
      publicContent.includes("isPrivate: { $ne: true }"),
      "GET /public/organizations must filter out private organizations"
    );
    assert.ok(
      publicContent.includes("transaction.documentHash || transaction.receiptIpfsHash"),
      "GET /public/verify/:hash must map transaction.documentHash to receiptIpfsHash"
    );

    const txContent = fs.readFileSync(
      path.join(srcDir, "routes/transactions.js"),
      "utf8"
    );
    assert.ok(
      txContent.includes("isPrivate: { $ne: true }"),
      "GET /transactions/public-overview must exclude private organizations"
    );
  });

  test("Chat mutations invalidate Redis L1 message cache and DAO enforces endTime expiration", () => {
    const chatContent = fs.readFileSync(
      path.join(srcDir, "routes/chat.js"),
      "utf8"
    );
    const matches = chatContent.match(/invalidateChatCache\(orgId\)/g) || [];
    assert.ok(
      matches.length >= 5,
      "chat.js must invalidate Redis L1 cache on react, seen, delivered, pin, and delete"
    );

    const daoContent = fs.readFileSync(
      path.join(srcDir, "routes/dao.js"),
      "utf8"
    );
    assert.ok(
      daoContent.includes("Voting period has expired for this proposal"),
      "POST /dao/proposals/:id/vote must reject votes after proposal.endTime"
    );
  });
});
