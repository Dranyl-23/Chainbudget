import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("OrgRegistry Smart Contract", function () {
  let registry;
  let owner, newOwner, attacker;

  const sampleOrgId = "6650a1b2c3d4e5f601234567";
  const sampleOrgKey = ethers.keccak256(ethers.toUtf8Bytes(sampleOrgId));
  const sampleDossierHash = ethers.keccak256(
    ethers.toUtf8Bytes("salt123|{\"id\":\"app1\",\"type\":\"student_org\"}")
  );

  beforeEach(async function () {
    [owner, newOwner, attacker] = await ethers.getSigners();
    const OrgRegistry = await ethers.getContractFactory("OrgRegistry");
    registry = await OrgRegistry.deploy(owner.address);
    await registry.waitForDeployment();
  });

  describe("Ownership & Pause Controls", function () {
    it("sets the initial owner and enforces Ownable2Step transfer", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      await registry.transferOwnership(newOwner.address);
      expect(await registry.pendingOwner()).to.equal(newOwner.address);

      await expect(
        registry.connect(attacker).acceptOwnership()
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

      await registry.connect(newOwner).acceptOwnership();
      expect(await registry.owner()).to.equal(newOwner.address);
    });

    it("blocks attestOrganization and revokeAttestation while paused", async function () {
      await registry.pause();
      expect(await registry.paused()).to.equal(true);

      await expect(
        registry.attestOrganization(sampleOrgKey, sampleDossierHash, 1)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.unpause();
      expect(await registry.paused()).to.equal(false);
    });
  });

  describe("Attestation & Revocation Lifecycle", function () {
    it("computes the exact keccak256 orgKey from an orgId string", async function () {
      expect(await registry.computeOrgKey(sampleOrgId)).to.equal(sampleOrgKey);
    });

    it("attests a standard-tier organization and marks it verified", async function () {
      expect(await registry.isVerified(sampleOrgKey)).to.equal(false);

      await expect(registry.attestOrganization(sampleOrgKey, sampleDossierHash, 1))
        .to.emit(registry, "OrganizationVerified");

      expect(await registry.isVerified(sampleOrgKey)).to.equal(true);

      const [dossierHash, tier, verifiedAt, revokedAt, revoked] =
        await registry.getAttestation(sampleOrgKey);
      expect(dossierHash).to.equal(sampleDossierHash);
      expect(Number(tier)).to.equal(1);
      expect(Number(verifiedAt)).to.be.greaterThan(0);
      expect(Number(revokedAt)).to.equal(0);
      expect(revoked).to.equal(false);
    });

    it("rejects unauthorized callers and invalid inputs", async function () {
      await expect(
        registry.connect(attacker).attestOrganization(sampleOrgKey, sampleDossierHash, 1)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

      await expect(
        registry.attestOrganization(ethers.ZeroHash, sampleDossierHash, 1)
      ).to.be.revertedWithCustomError(registry, "InvalidOrgKey");

      await expect(
        registry.attestOrganization(sampleOrgKey, ethers.ZeroHash, 1)
      ).to.be.revertedWithCustomError(registry, "InvalidDossierHash");

      await expect(
        registry.attestOrganization(sampleOrgKey, sampleDossierHash, 3)
      ).to.be.revertedWithCustomError(registry, "InvalidTier");
    });

    it("revokes an active attestation and blocks double revocation", async function () {
      await expect(
        registry.revokeAttestation(sampleOrgKey, "POLICY_VIOLATION")
      ).to.be.revertedWithCustomError(registry, "OrganizationNotAttested");

      await registry.attestOrganization(sampleOrgKey, sampleDossierHash, 2);
      expect(await registry.isVerified(sampleOrgKey)).to.equal(true);

      await expect(registry.revokeAttestation(sampleOrgKey, "EXPIRED_CREDENTIALS"))
        .to.emit(registry, "OrganizationRevoked");

      expect(await registry.isVerified(sampleOrgKey)).to.equal(false);

      const [, , , revokedAt, revoked] = await registry.getAttestation(sampleOrgKey);
      expect(revoked).to.equal(true);
      expect(Number(revokedAt)).to.be.greaterThan(0);

      await expect(
        registry.revokeAttestation(sampleOrgKey, "DUPLICATE")
      ).to.be.revertedWithCustomError(registry, "AttestationAlreadyRevoked");
    });

    it("allows re-attestation with an updated dossierHash after renewal", async function () {
      await registry.attestOrganization(sampleOrgKey, sampleDossierHash, 1);
      await registry.revokeAttestation(sampleOrgKey, "RENEWAL_REQUIRED");
      expect(await registry.isVerified(sampleOrgKey)).to.equal(false);

      const newDossierHash = ethers.keccak256(ethers.toUtf8Bytes("renewed-dossier-v2"));
      await registry.attestOrganization(sampleOrgKey, newDossierHash, 1);

      expect(await registry.isVerified(sampleOrgKey)).to.equal(true);
      const [dossierHash, , , revokedAt, revoked] = await registry.getAttestation(sampleOrgKey);
      expect(dossierHash).to.equal(newDossierHash);
      expect(Number(revokedAt)).to.equal(0);
      expect(revoked).to.equal(false);
    });
  });
});
