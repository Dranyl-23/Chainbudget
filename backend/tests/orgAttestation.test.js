"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");
const {
  computeOrgKey,
  tierToUint8,
  attestOrgOnChain,
  revokeOrgOnChain,
  anchorApplicationAttestation,
  reconcilePendingOrgAttestations,
} = require("../src/services/orgAttestation");

test("Phase 4: computeOrgKey and tier mapping", () => {
  const orgId = "6650a1b2c3d4e5f601234567";
  const expectedKey = ethers.keccak256(ethers.toUtf8Bytes(orgId));
  assert.equal(computeOrgKey(orgId), expectedKey);

  assert.throws(() => computeOrgKey(""), /orgId is required/);
  assert.throws(() => computeOrgKey("   "), /orgId is required/);

  assert.equal(tierToUint8("standard"), 1);
  assert.equal(tierToUint8("light"), 2);
  assert.equal(tierToUint8("anything_else"), 1);
});

test("Phase 4: attestOrgOnChain skips when contract is unconfigured", async () => {
  // Clear any env contract address for this test
  const prevContract = process.env.ORG_REGISTRY_CONTRACT_ADDRESS;
  delete process.env.ORG_REGISTRY_CONTRACT_ADDRESS;

  const res = await attestOrgOnChain({
    orgId: "org-123",
    dossierHash: ethers.keccak256(ethers.toUtf8Bytes("dossier-sample")),
    tier: "standard",
  });

  assert.equal(res.skipped, true);
  assert.match(res.reason, /OrgRegistry not configured/);

  if (prevContract) process.env.ORG_REGISTRY_CONTRACT_ADDRESS = prevContract;
});

test("Phase 4: attestOrgOnChain validates dossierHash format", async () => {
  await assert.rejects(
    async () =>
      attestOrgOnChain({
        orgId: "org-123",
        dossierHash: "not-a-hash",
        tier: "standard",
      }),
    /Invalid dossierHash/
  );
});

test("Phase 4: attestOrgOnChain executes successfully with mock contract", async () => {
  const orgId = "org-valid-1";
  const dossierHash = ethers.keccak256(ethers.toUtf8Bytes("canonical-dossier-bytes"));
  let calledWith = null;

  const mockContract = {
    attestOrganization: async (orgKey, hash, tier) => {
      calledWith = { orgKey, hash, tier };
      return {
        wait: async () => ({ hash: "0x" + "a".repeat(64) }),
      };
    },
  };

  const res = await attestOrgOnChain(
    { orgId, dossierHash, tier: "standard" },
    mockContract
  );

  assert.equal(res.skipped, false);
  assert.equal(res.txHash, "0x" + "a".repeat(64));
  assert.equal(res.tier, 1);
  assert.equal(calledWith.hash, dossierHash);
  assert.equal(calledWith.tier, 1);
});

test("Phase 4: revokeOrgOnChain executes successfully with mock contract", async () => {
  const orgId = "org-revoke-1";
  let calledWith = null;

  const mockContract = {
    revokeAttestation: async (orgKey, reasonCode) => {
      calledWith = { orgKey, reasonCode };
      return {
        wait: async () => ({ hash: "0x" + "b".repeat(64) }),
      };
    },
  };

  const res = await revokeOrgOnChain(
    { orgId, reasonCode: "SUSPENDED" },
    mockContract
  );

  assert.equal(res.skipped, false);
  assert.equal(res.txHash, "0x" + "b".repeat(64));
  assert.equal(calledWith.reasonCode, "SUSPENDED");
});

test("Phase 4: anchorApplicationAttestation anchors and updates MongoDB documents", async () => {
  const appDoc = {
    _id: "app-test-1",
    status: "approved",
    applicant: "user-test-1",
    dossierHash: ethers.keccak256(ethers.toUtf8Bytes("dossier-test-1")),
    anchor: { status: "pending", attempts: 0 },
    saved: false,
    save: async function () {
      this.saved = true;
    },
  };

  const orgDoc = {
    _id: "org-test-1",
    verification: { status: "verified", tier: "standard" },
    saved: false,
    save: async function () {
      this.saved = true;
    },
  };

  const mockContract = {
    attestOrganization: async () => ({
      wait: async () => ({ hash: "0x" + "c".repeat(64) }),
    }),
  };

  let emitted = null;
  const mockIo = {
    to: (room) => ({
      emit: (evt, payload) => {
        emitted = { room, evt, payload };
      },
    }),
  };

  const res = await anchorApplicationAttestation(appDoc, orgDoc, {
    contractOverride: mockContract,
    io: mockIo,
  });

  assert.equal(res.status, "anchored");
  assert.equal(res.txHash, "0x" + "c".repeat(64));
  assert.equal(appDoc.anchor.status, "anchored");
  assert.equal(appDoc.anchor.txHash, "0x" + "c".repeat(64));
  assert.equal(orgDoc.verification.attestationTxHash, "0x" + "c".repeat(64));
  assert.equal(appDoc.saved, true);
  assert.equal(orgDoc.saved, true);
  assert.equal(emitted.room, "user:user-test-1");
  assert.equal(emitted.evt, "org_verification_updated");
});

test("Phase 4: anchorApplicationAttestation handles revert by incrementing attempts", async () => {
  const appDoc = {
    _id: "app-test-revert",
    status: "approved",
    dossierHash: ethers.keccak256(ethers.toUtf8Bytes("dossier-revert")),
    anchor: { status: "pending", attempts: 1 },
    save: async function () {},
  };

  const orgDoc = {
    _id: "org-test-revert",
    verification: { status: "verified", tier: "standard" },
    save: async function () {},
  };

  const failingContract = {
    attestOrganization: async () => {
      throw new Error("RPC error: execution reverted");
    },
  };

  const res = await anchorApplicationAttestation(appDoc, orgDoc, {
    contractOverride: failingContract,
  });

  assert.equal(res.status, "pending");
  assert.equal(appDoc.anchor.attempts, 2);
  assert.match(appDoc.anchor.lastError, /execution reverted/);
});
