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

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Escrow Two-Party Authorization & Signatures
  // ──────────────────────────────────────────────────────────────────────────
  describe("Escrow Two-Party Authorization & Signatures", function () {
    let escrowTxId;
    const escrowAmount = ethers.parseEther("1.0");

    beforeEach(async function () {
      // 1. Fund the vault with MATIC
      await owner.sendTransaction({
        to: await chainBudget.getAddress(),
        value: ethers.parseEther("5.0"),
      });

      // 2. Record an escrow transaction (isEscrow = true, isHighValue = false for auto-approved recording)
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("escrow-service-contract-1"));
      await chainBudget.recordTransaction(dataHash, escrowAmount, supplier.address, false, true);
      escrowTxId = 1;

      // 3. Execute transaction to fund the escrow
      await chainBudget.executeTransaction(escrowTxId);
      const esc = await chainBudget.escrows(escrowTxId);
      expect(esc.isFunded).to.be.true;
      expect(esc.isReleased).to.be.false;
    });

    it("Direct 2-party release: requires both payee (supplier) and payer (approver/owner)", async function () {
      const initialSupplierBalance = await ethers.provider.getBalance(supplier.address);

      // Payer approves
      await chainBudget.connect(owner).releaseEscrow(escrowTxId);
      let esc = await chainBudget.escrows(escrowTxId);
      expect(esc.payerApproved).to.be.true;
      expect(esc.payeeApproved).to.be.false;
      expect(esc.isReleased).to.be.false;

      // Payee (supplier) approves
      const tx = await chainBudget.connect(supplier).releaseEscrow(escrowTxId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      esc = await chainBudget.escrows(escrowTxId);
      expect(esc.payeeApproved).to.be.true;
      expect(esc.isReleased).to.be.true;

      const finalSupplierBalance = await ethers.provider.getBalance(supplier.address);
      expect(finalSupplierBalance).to.equal(initialSupplierBalance + escrowAmount - gasUsed);
    });

    it("Relayed release with cryptographic payee signature (releaseEscrowWithPayeeSignature)", async function () {
      const initialSupplierBalance = await ethers.provider.getBalance(supplier.address);
      const contractAddress = await chainBudget.getAddress();
      const network = await ethers.provider.getNetwork();
      const chainId = network.chainId;

      // Payer approves
      await chainBudget.connect(approver1).releaseEscrow(escrowTxId);

      // Payee signs authorization message
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address", "string"],
        [contractAddress, chainId, escrowTxId, escrowAmount, supplier.address, "ESCROW_RELEASE"]
      );
      const payeeSig = await supplier.signMessage(ethers.getBytes(messageHash));

      // Relayer (owner or backend) submits the transaction with payee's signature
      await chainBudget.connect(owner).releaseEscrowWithPayeeSignature(escrowTxId, payeeSig);

      const esc = await chainBudget.escrows(escrowTxId);
      expect(esc.payeeApproved).to.be.true;
      expect(esc.isReleased).to.be.true;

      const finalSupplierBalance = await ethers.provider.getBalance(supplier.address);
      expect(finalSupplierBalance).to.equal(initialSupplierBalance + escrowAmount);
    });

    it("Rejects forged or invalid signature on releaseEscrowWithPayeeSignature", async function () {
      const contractAddress = await chainBudget.getAddress();
      const network = await ethers.provider.getNetwork();
      const chainId = network.chainId;

      // Non-payee (nonApprover) signs instead of supplier
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address", "string"],
        [contractAddress, chainId, escrowTxId, escrowAmount, supplier.address, "ESCROW_RELEASE"]
      );
      const forgedSig = await nonApprover.signMessage(ethers.getBytes(messageHash));

      await expect(
        chainBudget.connect(owner).releaseEscrowWithPayeeSignature(escrowTxId, forgedSig)
      ).to.be.revertedWith("ChainBudget: invalid payee signature");
    });

    it("Prevents single-party unilateral release by owner without payee consent", async function () {
      // Owner calls releaseEscrow — only sets payerApproved, does NOT set payeeApproved
      await chainBudget.connect(owner).releaseEscrow(escrowTxId);

      const esc = await chainBudget.escrows(escrowTxId);
      expect(esc.payerApproved).to.be.true;
      expect(esc.payeeApproved).to.be.false;
      expect(esc.isReleased).to.be.false;

      // Non-authorized user cannot release
      await expect(
        chainBudget.connect(nonApprover).releaseEscrow(escrowTxId)
      ).to.be.revertedWith("ChainBudget: not authorized to release this escrow");
    });

    it("Auditable override: recordOffchainPayeeConfirmation requires evidence URI and records audit event", async function () {
      // Payer approves
      await chainBudget.connect(owner).releaseEscrow(escrowTxId);

      // Attempt with empty evidence URI must revert
      await expect(
        chainBudget.connect(owner).recordOffchainPayeeConfirmation(escrowTxId, "")
      ).to.be.revertedWith("ChainBudget: evidence URI required");

      // Non-owner cannot use operational override
      await expect(
        chainBudget.connect(nonApprover).recordOffchainPayeeConfirmation(escrowTxId, "ipfs://QmProof123")
      ).to.be.revertedWithCustomError(chainBudget, "OwnableUnauthorizedAccount");

      // Owner calls with valid IPFS evidence URI
      const evidenceURI = "ipfs://QmDeliveryConfirmationHash123456789";
      await expect(
        chainBudget.connect(owner).recordOffchainPayeeConfirmation(escrowTxId, evidenceURI)
      )
        .to.emit(chainBudget, "PayeeConfirmationRecordedOffchain")
        .withArgs(escrowTxId, owner.address, evidenceURI);

      const esc = await chainBudget.escrows(escrowTxId);
      expect(esc.payeeApproved).to.be.true;
      expect(esc.isReleased).to.be.true;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Escrow Balance Segregation (SC-2)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Escrow Balance Segregation", function () {
    it("Should track totalLockedEscrow when escrow is funded", async function () {
      const escrowAmount = ethers.parseEther("2.0");
      await owner.sendTransaction({
        to: await chainBudget.getAddress(),
        value: ethers.parseEther("5.0"),
      });

      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("escrow-segregation-test"));
      await chainBudget.recordTransaction(dataHash, escrowAmount, supplier.address, false, true);
      await chainBudget.executeTransaction(1);

      expect(await chainBudget.totalLockedEscrow()).to.equal(escrowAmount);
      expect(await chainBudget.getAvailableBalance()).to.equal(ethers.parseEther("3.0"));
    });

    it("Should prevent non-escrow transaction from spending reserved escrow funds", async function () {
      await owner.sendTransaction({
        to: await chainBudget.getAddress(),
        value: ethers.parseEther("3.0"),
      });

      // Lock 2 ETH in escrow
      const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes("escrow-lock"));
      await chainBudget.recordTransaction(dataHash1, ethers.parseEther("2.0"), supplier.address, false, true);
      await chainBudget.executeTransaction(1);

      // Try to spend 2 ETH (only 1 ETH is available)
      const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("regular-spend"));
      await chainBudget.recordTransaction(dataHash2, ethers.parseEther("2.0"), nonApprover.address, false, false);
      await expect(
        chainBudget.executeTransaction(2)
      ).to.be.revertedWith("ChainBudget: insufficient available balance (escrow funds reserved)");
    });

    it("Should release totalLockedEscrow after escrow is finalized", async function () {
      const escrowAmount = ethers.parseEther("1.0");
      await owner.sendTransaction({
        to: await chainBudget.getAddress(),
        value: ethers.parseEther("5.0"),
      });

      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("escrow-release-lock"));
      await chainBudget.recordTransaction(dataHash, escrowAmount, supplier.address, false, true);
      await chainBudget.executeTransaction(1);

      expect(await chainBudget.totalLockedEscrow()).to.equal(escrowAmount);

      // Two-party release
      await chainBudget.connect(owner).releaseEscrow(1);
      await chainBudget.connect(supplier).releaseEscrow(1);

      expect(await chainBudget.totalLockedEscrow()).to.equal(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Approver Removal Threshold Guard (SC-3)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Approver Removal Threshold Guard", function () {
    it("Should prevent removing approver if it would drop below requiredApprovals", async function () {
      // We have 3 approvers, requiredApprovals = 2
      // Removing one leaves 2, which is still >= 2 → should succeed
      await chainBudget.removeApprover(approver3.address);
      const remaining = await chainBudget.getApprovers();
      expect(remaining.length).to.equal(2);

      // Removing another would leave 1 < 2 → should revert
      await expect(
        chainBudget.removeApprover(approver2.address)
      ).to.be.revertedWith("ChainBudget: cannot remove, would drop below required approvals");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GAP-12: Zero-address & zero-amount input validation
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Input Validation (GAP-12)", function () {
    it("should reject recordTransaction with zero address recipient", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("zero-addr-test"));
      await expect(
        chainBudget.recordTransaction(dataHash, 1000, ethers.ZeroAddress, false, false)
      ).to.be.revertedWith("ChainBudget: zero address recipient");
    });

    it("should reject recordTransaction with zero amount", async function () {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("zero-amount-test"));
      await expect(
        chainBudget.recordTransaction(dataHash, 0, supplier.address, false, false)
      ).to.be.revertedWith("ChainBudget: amount must be > 0");
    });
  });
});
