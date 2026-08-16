import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("ChainBudget System Suite", function () {
  let chainBudget, dao, sbt;
  let owner, approver1, approver2, approver3, nonApprover, supplier;

  beforeEach(async function () {
    [owner, approver1, approver2, approver3, nonApprover, supplier] = await ethers.getSigners();

    // 1. Deploy ChainBudget Vault
    const ChainBudget = await ethers.getContractFactory("ChainBudget");
    chainBudget = await ChainBudget.deploy(
      [approver1.address, approver2.address, approver3.address],
      2 // 2-of-3 threshold
    );
    await chainBudget.waitForDeployment();

    // 2. Deploy DAO
    const ChainBudgetDAO = await ethers.getContractFactory("ChainBudgetDAO");
    dao = await ChainBudgetDAO.deploy(2); // Min quorum = 2
    await dao.waitForDeployment();

    // 3. Deploy MembershipSBT
    const MembershipSBT = await ethers.getContractFactory("MembershipSBT");
    sbt = await MembershipSBT.deploy(owner.address);
    await sbt.waitForDeployment();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Ownership & Two-Step Transfer
  // ──────────────────────────────────────────────────────────────────────────
  describe("Two-Step Ownership Transfer (Ownable2Step)", function () {
    it("Should set the deployer as initial owner", async function () {
      expect(await chainBudget.owner()).to.equal(owner.address);
    });

    it("Should require pending owner to accept ownership", async function () {
      await chainBudget.transferOwnership(approver1.address);
      expect(await chainBudget.pendingOwner()).to.equal(approver1.address);
      expect(await chainBudget.owner()).to.equal(owner.address); // Still owner until accepted

      // Non-pending owner cannot accept
      await expect(
        chainBudget.connect(nonApprover).acceptOwnership()
      ).to.be.revertedWithCustomError(chainBudget, "OwnableUnauthorizedAccount");

      // Approver1 accepts ownership
      await chainBudget.connect(approver1).acceptOwnership();
      expect(await chainBudget.owner()).to.equal(approver1.address);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Emergency Pause & Controls (Pausable)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Emergency Pause (Pausable)", function () {
    it("Should allow owner to pause and unpause", async function () {
      expect(await chainBudget.paused()).to.be.false;

      await chainBudget.pause();
      expect(await chainBudget.paused()).to.be.true;

      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-payload-paused"));
      await expect(
        chainBudget.recordTransaction(dataHash, 1000, supplier.address, false, false)
      ).to.be.revertedWithCustomError(chainBudget, "EnforcedPause");

      await chainBudget.unpause();
      expect(await chainBudget.paused()).to.be.false;
    });

    it("Should reject non-owner pause attempts", async function () {
      await expect(
        chainBudget.connect(nonApprover).pause()
      ).to.be.revertedWithCustomError(chainBudget, "OwnableUnauthorizedAccount");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Transactions & 2-of-N Approval
  // ──────────────────────────────────────────────────────────────────────────
  describe("Multi-Sig & Transaction Recording", function () {
    it("Should record low-value transaction as auto-approved", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("low-val"));
      await chainBudget.recordTransaction(dataHash, 1000, supplier.address, false, false);

      const txn = await chainBudget.getTransaction(1);
      expect(txn.isApproved).to.be.true;
      expect(txn.isHighValue).to.be.false;
      expect(txn.to).to.equal(supplier.address);
    });

    it("Should require 2 approvals for high-value transaction", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("high-val"));
      await chainBudget.recordTransaction(dataHash, 50000, supplier.address, true, false);

      let txn = await chainBudget.getTransaction(1);
      expect(txn.isApproved).to.be.false;

      await chainBudget.connect(approver1).submitApproval(1);
      txn = await chainBudget.getTransaction(1);
      expect(txn.isApproved).to.be.false;

      await chainBudget.connect(approver2).submitApproval(1);
      txn = await chainBudget.getTransaction(1);
      expect(txn.isApproved).to.be.true;
    });

    it("Should prevent duplicate voting by the same approver", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("double-vote"));
      await chainBudget.recordTransaction(dataHash, 50000, supplier.address, true, false);

      await chainBudget.connect(approver1).submitApproval(1);
      await expect(
        chainBudget.connect(approver1).submitApproval(1)
      ).to.be.revertedWith("ChainBudget: already approved");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Soulbound Token (Multi-Organization Support)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Multi-Organization Soulbound Tokens (MembershipSBT)", function () {
    it("Should allow a user to hold SBTs for multiple different organizations", async function () {
      // Mint Org A membership
      await sbt.mintMembership(approver1.address, "org-alpha");
      expect(await sbt.isMemberOf(approver1.address, "org-alpha")).to.be.true;

      // Mint Org B membership for the same user
      await sbt.mintMembership(approver1.address, "org-beta");
      expect(await sbt.isMemberOf(approver1.address, "org-beta")).to.be.true;

      // Balance of user is now 2
      expect(await sbt.balanceOf(approver1.address)).to.equal(2);
    });

    it("Should prevent duplicate SBT minting for the same organization", async function () {
      await sbt.mintMembership(approver1.address, "org-alpha");
      await expect(
        sbt.mintMembership(approver1.address, "org-alpha")
      ).to.be.revertedWith("MembershipSBT: user already holds SBT for this organization");
    });

    it("Should block transfers between users (Soulbound)", async function () {
      await sbt.mintMembership(approver1.address, "org-alpha");
      await expect(
        sbt.connect(approver1).transferFrom(approver1.address, approver2.address, 0)
      ).to.be.revertedWith("MembershipSBT: This token is soulbound and cannot be transferred.");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DAO Proposal Lifecycle & Quorum
  // ──────────────────────────────────────────────────────────────────────────
  describe("DAO Proposal Governance & Quorum", function () {
    beforeEach(async function () {
      await dao.addMember(approver1.address);
      await dao.addMember(approver2.address);
      await dao.addMember(approver3.address);
    });

    it("Should create a proposal and enforce voting period and quorum", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("dao-proposal-1"));
      await dao.connect(approver1).createProposal("Buy Equipment", dataHash, 3600);

      // Cast 2 Yes votes
      await dao.connect(approver1).castVote(1, true);
      await dao.connect(approver2).castVote(1, true);

      // Attempt to execute before voting period ends should revert
      await expect(
        dao.executeProposal(1)
      ).to.be.revertedWith("DAO: voting still active");

      // Advance time by 3601 seconds
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      // Execute proposal
      await dao.executeProposal(1);
      const prop = await dao.getProposal(1);
      expect(prop.executed).to.be.true;
      expect(prop.passed).to.be.true;
    });

    it("Should reject execution if quorum is not reached", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("dao-proposal-quorum-fail"));
      await dao.connect(approver1).createProposal("Failed Quorum", dataHash, 3600);

      // Only 1 vote cast (minQuorum = 2)
      await dao.connect(approver1).castVote(1, true);

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      await expect(
        dao.executeProposal(1)
      ).to.be.revertedWith("DAO: minimum quorum not reached");
    });
  });
});
