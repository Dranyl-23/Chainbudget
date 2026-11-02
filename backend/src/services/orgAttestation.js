"use strict";

/**
 * orgAttestation.js — Phase 4 On-Chain Organization Verification Attestation Service
 *
 * Bridges approved OrgApplication / Organization records to the OrgRegistry smart contract
 * on Polygon Amoy. Only the deterministic orgKey (keccak256(bytes(orgId))), salted
 * dossierHash, and numeric tier (1 = standard, 2 = light) are stored on-chain.
 */

const { ethers } = require("ethers");
const OrgRegistryABI = require("../lib/OrgRegistry.json");
const OrgApplication = require("../models/OrgApplication");
const Organization = require("../models/Organization");

const RPC_ENDPOINTS = [
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy.drpc.org",
];

let currentRpcIndex = 0;
let registryContract = null;

function getActiveRpcUrl() {
  const envUrl = process.env.AMOY_RPC_URL;
  if (envUrl && !envUrl.includes("tenderly")) return envUrl;
  return RPC_ENDPOINTS[currentRpcIndex % RPC_ENDPOINTS.length];
}

function initOrgRegistry(forceRotate = false) {
  if (registryContract && !forceRotate) return registryContract;

  if (forceRotate) {
    currentRpcIndex++;
    registryContract = null;
  }

  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  const registryAddress = process.env.ORG_REGISTRY_CONTRACT_ADDRESS;

  if (!privateKey || !registryAddress) {
    return null;
  }

  try {
    const rpcUrl = getActiveRpcUrl();
    const provider = new ethers.JsonRpcProvider(rpcUrl, 80002, { staticNetwork: true });
    const signer = new ethers.Wallet(privateKey, provider);
    registryContract = new ethers.Contract(registryAddress, OrgRegistryABI.abi, signer);
    return registryContract;
  } catch (err) {
    console.warn("[orgAttestation] Failed to init OrgRegistry:", err.message);
    return null;
  }
}

/**
 * Deterministic 32-byte key for an organization ID string: keccak256(utf8Bytes(orgId))
 */
function computeOrgKey(orgId) {
  const clean = String(orgId || "").trim();
  if (!clean) throw new Error("orgId is required to compute orgKey");
  return ethers.keccak256(ethers.toUtf8Bytes(clean));
}

/**
 * Maps string tier ("standard" | "light") to uint8 contract constant (1 | 2)
 */
function tierToUint8(tier) {
  return tier === "light" ? 2 : 1;
}

/**
 * Calls OrgRegistry.attestOrganization(orgKey, dossierHash, tier) on-chain.
 */
async function attestOrgOnChain({ orgId, dossierHash, tier }, contractOverride = null) {
  const orgKey = computeOrgKey(orgId);
  const tierNum = tierToUint8(tier);

  if (!dossierHash || !/^0x[0-9a-fA-F]{64}$/.test(String(dossierHash))) {
    throw new Error("Invalid dossierHash: expected 0x-prefixed 32-byte hex digest");
  }

  const contract = contractOverride || initOrgRegistry();
  if (!contract) {
    return {
      skipped: true,
      reason: "OrgRegistry not configured (ORG_REGISTRY_CONTRACT_ADDRESS missing)",
      orgKey,
      dossierHash,
      tier: tierNum,
    };
  }

  try {
    const tx = await contract.attestOrganization(orgKey, dossierHash, tierNum);
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OrgRegistry transaction timeout (60s)")), 60000)
      ),
    ]);

    if (!receipt || !receipt.hash) {
      throw new Error("OrgRegistry receipt missing transaction hash");
    }

    return {
      skipped: false,
      txHash: receipt.hash,
      orgKey,
      dossierHash,
      tier: tierNum,
    };
  } catch (err) {
    if (!contractOverride) initOrgRegistry(true);
    throw err;
  }
}

/**
 * Calls OrgRegistry.revokeAttestation(orgKey, reasonCode) on-chain.
 */
async function revokeOrgOnChain({ orgId, reasonCode }, contractOverride = null) {
  const orgKey = computeOrgKey(orgId);
  const cleanReason = String(reasonCode || "REVOKED").slice(0, 64);

  const contract = contractOverride || initOrgRegistry();
  if (!contract) {
    return {
      skipped: true,
      reason: "OrgRegistry not configured",
      orgKey,
    };
  }

  try {
    const tx = await contract.revokeAttestation(orgKey, cleanReason);
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OrgRegistry revoke timeout (60s)")), 60000)
      ),
    ]);

    return {
      skipped: false,
      txHash: receipt && receipt.hash ? receipt.hash : null,
      orgKey,
    };
  } catch (err) {
    if (!contractOverride) initOrgRegistry(true);
    throw err;
  }
}

/**
 * Anchors a single approved application + organization pair and updates MongoDB state.
 */
async function anchorApplicationAttestation(appDoc, orgDoc, options = {}) {
  const { contractOverride = null, io = null } = options;

  const app =
    typeof appDoc === "string" ? await OrgApplication.findById(appDoc) : appDoc;
  if (!app) return { status: "not_found" };

  const org =
    orgDoc ||
    (app.organization ? await Organization.findById(app.organization) : null);
  if (!org) return { status: "org_not_found" };

  const tier =
    (org.verification && org.verification.tier) ||
    (app.basics && app.basics.type === "family") ||
    (app.basics && app.basics.type === "fundraising")
      ? "light"
      : "standard";

  try {
    const res = await attestOrgOnChain(
      {
        orgId: String(org._id),
        dossierHash: app.dossierHash,
        tier: (org.verification && org.verification.tier) || tier,
      },
      contractOverride
    );

    if (res.skipped) {
      return { status: "skipped", reason: res.reason };
    }

    const now = new Date();
    app.anchor = {
      status: "anchored",
      txHash: res.txHash,
      anchoredAt: now,
      attempts: ((app.anchor && app.anchor.attempts) || 0) + 1,
      lastError: undefined,
    };
    await app.save();

    org.verification = {
      ...(org.verification ? org.verification.toObject?.() || org.verification : {}),
      attestationTxHash: res.txHash,
    };
    await org.save();

    if (io && app.applicant) {
      const applicantId = String(app.applicant._id || app.applicant);
      io.to(`user:${applicantId}`).emit("org_verification_updated", {
        applicationId: String(app._id),
        organizationId: String(org._id),
        status: app.status,
        attestationTxHash: res.txHash,
      });
    }

    return {
      status: "anchored",
      txHash: res.txHash,
      orgKey: res.orgKey,
    };
  } catch (err) {
    const attempts = ((app.anchor && app.anchor.attempts) || 0) + 1;
    app.anchor = {
      status: attempts >= 5 ? "failed" : "pending",
      txHash: app.anchor && app.anchor.txHash,
      anchoredAt: app.anchor && app.anchor.anchoredAt,
      attempts,
      lastError: String(err.message || err).slice(0, 500),
    };
    await app.save();

    return {
      status: app.anchor.status,
      error: err.message,
      attempts,
    };
  }
}

/**
 * Fire-and-forget helper triggered right after admin approval.
 */
function triggerAsyncOrgAttestation(app, org, io = null, contractOverride = null) {
  setImmediate(async () => {
    try {
      await anchorApplicationAttestation(app, org, { io, contractOverride });
    } catch (err) {
      console.warn("[orgAttestation] Async attestation error:", err.message);
    }
  });
}

/**
 * Reconciles approved applications whose on-chain anchor is still pending.
 * Called periodically by blockchainSyncWorker.
 */
async function reconcilePendingOrgAttestations(options = {}) {
  const { io = null, contractOverride = null, limit = 10 } = options;

  const pendingApps = await OrgApplication.find({
    status: "approved",
    "anchor.status": "pending",
    "anchor.attempts": { $lt: 5 },
  })
    .sort({ updatedAt: 1 })
    .limit(limit);

  let anchored = 0;
  let skipped = 0;
  let failed = 0;

  for (const app of pendingApps) {
    if (!app.organization || !app.dossierHash) {
      skipped++;
      continue;
    }
    const org = await Organization.findById(app.organization);
    if (!org) {
      skipped++;
      continue;
    }
    const res = await anchorApplicationAttestation(app, org, { io, contractOverride });
    if (res.status === "anchored") anchored++;
    else if (res.status === "skipped") skipped++;
    else failed++;
  }

  return {
    processed: pendingApps.length,
    anchored,
    skipped,
    failed,
  };
}

module.exports = {
  computeOrgKey,
  tierToUint8,
  attestOrgOnChain,
  revokeOrgOnChain,
  anchorApplicationAttestation,
  triggerAsyncOrgAttestation,
  reconcilePendingOrgAttestations,
};
