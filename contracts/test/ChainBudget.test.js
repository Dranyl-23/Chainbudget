const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainBudget", function () {
  let chainBudget;
  let owner, approver1, approver2, approver3, nonApprover;

  beforeEach(async function () {
    [owner, approver1, approver2, approver3, nonApprover] =
      await ethers.getSigners();

    const ChainBudget = await ethers.getContractFactory("ChainBudget");
    chainBudget = await ChainBudget.deploy(
      [approver1.address, approver2.address, approver3.address],
      2 // 2-of-3 threshold
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Deployment
  // ──────────────────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the owner to the deployer", async function () {
      expect(await chainBudget.owner()).to.equal(owner.address);
    });

    it("Should register initial approvers", async function () {
      expect(await chainBudget.isApprover(approver1.address)).to.be.true;
      expect(await chainBudget.isApprover(approver2.address)).to.be.true;
      expect(await chainBudget.isApprover(approver3.address)).to.be.true;
    });

    it("Should set required approvals to 2", async function () {
      expect(await chainBudget.requiredApprovals()).to.equal(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Record Transaction
  // ──────────────────────────────────────────────────────────────────────────

  describe("recordTransaction", function () {
    it("Should record a low-value transaction and auto-approve it", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-payload-1"));
      await chainBudget.recordTransaction(dataHash, 1000, false);

      const txn = await chainBudget.getTransaction(1);
      expect(txn.isApproved).to.be.true;
      expect(txn.isHighValue).to.be.false;
      expect(txn.dataHash).to.equal(dataHash);
    });

    it("Should record a high-value transaction as pending (not approved)", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("high-value-1"));
      await chainBudget.recordTransaction(dataHash, 50000, true);

      const txn = await chainBudget.getTransaction(1);
      expect(txn.isApproved).to.be.false;
      expect(txn.isHighValue).to.be.true;
    });

    it("Should revert if called by non-owner", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("unauthorized"));
      await expect(
        chainBudget
          .connect(nonApprover)
          .recordTransaction(dataHash, 1000, false)
      ).to.be.revertedWith("ChainBudget: caller is not owner");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Multi-Signature Approval
  // ──────────────────────────────────────────────────────────────────────────

  describe("submitApproval (2-of-N)", function () {
    beforeEach(async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("high-value-2"));
      await chainBudget.recordTransaction(dataHash, 99999, true);
    });

    it("Should allow an approver to vote", async function () {
      await chainBudget.connect(approver1).submitApproval(1);
      expect(await chainBudget.getApprovalCount(1)).to.equal(1);
    });

    it("Should approve transaction after 2 votes", async function () {
      await chainBudget.connect(approver1).submitApproval(1);
      await chainBudget.connect(approver2).submitApproval(1);
      expect(await chainBudget.isTransactionApproved(1)).to.be.true;
    });

    it("Should prevent double voting", async function () {
      await chainBudget.connect(approver1).submitApproval(1);
      await expect(
        chainBudget.connect(approver1).submitApproval(1)
      ).to.be.revertedWith("ChainBudget: already approved");
    });

    it("Should prevent non-approver from voting", async function () {
      await expect(
        chainBudget.connect(nonApprover).submitApproval(1)
      ).to.be.revertedWith("ChainBudget: caller is not an approver");
    });

    it("Should prevent voting on an already approved transaction", async function () {
      await chainBudget.connect(approver1).submitApproval(1);
      await chainBudget.connect(approver2).submitApproval(1);
      await expect(
        chainBudget.connect(approver3).submitApproval(1)
      ).to.be.revertedWith("ChainBudget: transaction already approved");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Approver Management
  // ──────────────────────────────────────────────────────────────────────────

  describe("Approver management", function () {
    it("Should add a new approver", async function () {
      await chainBudget.addApprover(nonApprover.address);
      expect(await chainBudget.isApprover(nonApprover.address)).to.be.true;
    });

    it("Should remove an approver", async function () {
      await chainBudget.removeApprover(approver3.address);
      expect(await chainBudget.isApprover(approver3.address)).to.be.false;
    });

    it("Should revert if non-owner tries to add approver", async function () {
      await expect(
        chainBudget.connect(nonApprover).addApprover(nonApprover.address)
      ).to.be.revertedWith("ChainBudget: caller is not owner");
    });
  });
});
