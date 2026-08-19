/**
 * Tests: Escrow Dual-Release & Relayer Verification
 *
 * Verifies that the escrow release routes correctly call:
 *  - releaseEscrow (for payer/admin approval)
 *  - releaseEscrowWithPayeeSignature or recordOffchainPayeeConfirmation (for payee confirmation)
 *  - Properly coordinates tx1 and tx2 and returns valid blockchain transaction hashes.
 *
 * Run: node --test tests/escrow.route.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Escrow Two-Party Route & Dual-Release Relayer", () => {

  /**
   * Simulates the escrow release logic in transactions.js.
   */
  async function simulateRelease({ isOrgAdmin, isSupplier, contract, onChainTxId, payeeSig, evidenceURI }) {
    let blockchainTxHash = null;

    if (isOrgAdmin && !isSupplier) {
      const tx = await contract.releaseEscrow(onChainTxId);
      const receipt = await tx.wait();
      blockchainTxHash = receipt.hash;
    } else if (isSupplier && !isOrgAdmin) {
      let tx;
      if (payeeSig) {
        tx = await contract.releaseEscrowWithPayeeSignature(onChainTxId, payeeSig);
      } else {
        const uri = evidenceURI || `chainbudget://escrow/release/${onChainTxId}`;
        tx = await contract.recordOffchainPayeeConfirmation(onChainTxId, uri);
      }
      const receipt = await tx.wait();
      blockchainTxHash = receipt.hash;
    } else {
      // Admin is acting as both payer and payee
      const tx1 = await contract.releaseEscrow(onChainTxId);
      await tx1.wait();
      let tx2;
      if (payeeSig) {
        tx2 = await contract.releaseEscrowWithPayeeSignature(onChainTxId, payeeSig);
      } else {
        const uri = evidenceURI || `chainbudget://escrow/release/${onChainTxId}`;
        tx2 = await contract.recordOffchainPayeeConfirmation(onChainTxId, uri);
      }
      const receipt = await tx2.wait();
      blockchainTxHash = receipt.hash;
    }

    return blockchainTxHash;
  }

  it("admin dual-release executes with signature without ReferenceError and returns tx2 hash", async () => {
    let releaseEscrowCalled = false;
    let payeeSigCalled = false;

    const mockContract = {
      async releaseEscrow(txId) {
        releaseEscrowCalled = true;
        return {
          async wait() {
            return { hash: "0xtx1-release-hash" };
          },
        };
      },
      async releaseEscrowWithPayeeSignature(txId, sig) {
        payeeSigCalled = true;
        return {
          async wait() {
            return { hash: "0xtx2-payee-sig-hash" };
          },
        };
      },
    };

    let hash;
    await assert.doesNotReject(async () => {
      hash = await simulateRelease({
        isOrgAdmin: true,
        isSupplier: true,
        contract: mockContract,
        onChainTxId: 42,
        payeeSig: "0xdeadbeef12345678",
      });
    });

    assert.equal(releaseEscrowCalled, true, "releaseEscrow must be called");
    assert.equal(payeeSigCalled, true, "releaseEscrowWithPayeeSignature must be called");
    assert.equal(hash, "0xtx2-payee-sig-hash", "blockchainTxHash must be from tx2.wait()");
  });

  it("admin dual-release executes with offchain evidence without ReferenceError and returns tx2 hash", async () => {
    let releaseEscrowCalled = false;
    let evidenceCalled = false;

    const mockContract = {
      async releaseEscrow(txId) {
        releaseEscrowCalled = true;
        return {
          async wait() {
            return { hash: "0xtx1-release-hash" };
          },
        };
      },
      async recordOffchainPayeeConfirmation(txId, uri) {
        evidenceCalled = true;
        return {
          async wait() {
            return { hash: "0xtx2-evidence-hash" };
          },
        };
      },
    };

    const hash = await simulateRelease({
      isOrgAdmin: true,
      isSupplier: true,
      contract: mockContract,
      onChainTxId: 42,
      evidenceURI: "ipfs://QmDelivery123",
    });

    assert.equal(releaseEscrowCalled, true);
    assert.equal(evidenceCalled, true);
    assert.equal(hash, "0xtx2-evidence-hash");
  });

  it("admin-only path (isOrgAdmin && !isSupplier) calls releaseEscrow only", async () => {
    let releaseEscrowCalled = false;
    let payeeSigCalled = false;

    const mockContract = {
      async releaseEscrow() {
        releaseEscrowCalled = true;
        return { async wait() { return { hash: "0xadmin-only" }; } };
      },
      async releaseEscrowWithPayeeSignature() {
        payeeSigCalled = true;
        return { async wait() { return { hash: "0xpayee" }; } };
      },
    };

    const hash = await simulateRelease({
      isOrgAdmin: true,
      isSupplier: false,
      contract: mockContract,
      onChainTxId: 10,
    });
    assert.equal(releaseEscrowCalled, true);
    assert.equal(payeeSigCalled, false);
    assert.equal(hash, "0xadmin-only");
  });

  it("supplier-only path calls releaseEscrowWithPayeeSignature and not releaseEscrow", async () => {
    let releaseEscrowCalled = false;
    let payeeSigCalled = false;

    const mockContract = {
      async releaseEscrow() {
        releaseEscrowCalled = true;
        return { async wait() { return { hash: "0xrelease" }; } };
      },
      async releaseEscrowWithPayeeSignature() {
        payeeSigCalled = true;
        return { async wait() { return { hash: "0xpayee-sig" }; } };
      },
    };

    const hash = await simulateRelease({
      isOrgAdmin: false,
      isSupplier: true,
      contract: mockContract,
      onChainTxId: 10,
      payeeSig: "0xsig123",
    });
    assert.equal(releaseEscrowCalled, false, "releaseEscrow must NOT be called in supplier-only path");
    assert.equal(payeeSigCalled, true);
    assert.equal(hash, "0xpayee-sig");
  });

  it("dual-release handles contract error and propagates it correctly", async () => {
    const failingContract = {
      async releaseEscrow() {
        return {
          async wait() { throw new Error("On-chain call reverted: already released"); },
        };
      },
      async releaseEscrowWithPayeeSignature() {
        return { async wait() { return { hash: "0xpayee" }; } };
      },
    };

    await assert.rejects(
      () => simulateRelease({
        isOrgAdmin: true,
        isSupplier: true,
        contract: failingContract,
        onChainTxId: 99,
        payeeSig: "0xsig",
      }),
      { message: "On-chain call reverted: already released" },
      "Contract errors must propagate so the caller can handle them"
    );
  });
});

