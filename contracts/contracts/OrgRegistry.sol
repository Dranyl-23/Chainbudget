// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ChainBudget Organization Verification Registry
/// @notice Privacy-preserving on-chain registry of verified organization dossier hashes.
/// @dev Stores only salted keccak256 dossier hashes and verification metadata (zero PII on-chain).
contract OrgRegistry is Ownable2Step, Pausable {
    uint8 public constant TIER_STANDARD = 1;
    uint8 public constant TIER_LIGHT = 2;

    struct Attestation {
        bytes32 dossierHash;
        uint8 tier;
        uint64 verifiedAt;
        uint64 revokedAt;
        bool revoked;
    }

    /// @notice Mapping from orgKey (keccak256(bytes(orgId))) to its on-chain attestation record
    mapping(bytes32 => Attestation) public attestations;

    error InvalidOrgKey();
    error InvalidDossierHash();
    error InvalidTier(uint8 tier);
    error OrganizationNotAttested(bytes32 orgKey);
    error AttestationAlreadyRevoked(bytes32 orgKey);

    event OrganizationVerified(
        bytes32 indexed orgKey,
        bytes32 indexed dossierHash,
        uint8 tier,
        uint64 verifiedAt
    );

    event OrganizationRevoked(
        bytes32 indexed orgKey,
        string reasonCode,
        uint64 revokedAt
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Pause attestation mutations in an emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause attestation mutations
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Deterministic helper to compute orgKey from an off-chain MongoDB Organization ID string
    function computeOrgKey(string calldata orgId) external pure returns (bytes32) {
        return keccak256(bytes(orgId));
    }

    /// @notice Anchors or updates an organization's verification dossier hash on-chain
    /// @param orgKey keccak256(bytes(orgId))
    /// @param dossierHash Salted keccak256 digest of the canonical verification dossier
    /// @param tier Verification tier (1 = standard, 2 = light)
    function attestOrganization(
        bytes32 orgKey,
        bytes32 dossierHash,
        uint8 tier
    ) external onlyOwner whenNotPaused {
        if (orgKey == bytes32(0)) revert InvalidOrgKey();
        if (dossierHash == bytes32(0)) revert InvalidDossierHash();
        if (tier != TIER_STANDARD && tier != TIER_LIGHT) revert InvalidTier(tier);

        uint64 ts = uint64(block.timestamp);
        attestations[orgKey] = Attestation({
            dossierHash: dossierHash,
            tier: tier,
            verifiedAt: ts,
            revokedAt: 0,
            revoked: false
        });

        emit OrganizationVerified(orgKey, dossierHash, tier, ts);
    }

    /// @notice Revokes an organization's on-chain verification attestation
    /// @param orgKey keccak256(bytes(orgId))
    /// @param reasonCode Short non-PII reason code or audit reference
    function revokeAttestation(
        bytes32 orgKey,
        string calldata reasonCode
    ) external onlyOwner whenNotPaused {
        Attestation storage att = attestations[orgKey];
        if (att.verifiedAt == 0) revert OrganizationNotAttested(orgKey);
        if (att.revoked) revert AttestationAlreadyRevoked(orgKey);

        uint64 ts = uint64(block.timestamp);
        att.revoked = true;
        att.revokedAt = ts;

        emit OrganizationRevoked(orgKey, reasonCode, ts);
    }

    /// @notice Returns true if the organization has an active, non-revoked attestation
    function isVerified(bytes32 orgKey) external view returns (bool) {
        Attestation storage att = attestations[orgKey];
        return att.verifiedAt != 0 && !att.revoked;
    }

    /// @notice Returns the full attestation record for an organization key
    function getAttestation(
        bytes32 orgKey
    )
        external
        view
        returns (
            bytes32 dossierHash,
            uint8 tier,
            uint64 verifiedAt,
            uint64 revokedAt,
            bool revoked
        )
    {
        Attestation storage att = attestations[orgKey];
        return (att.dossierHash, att.tier, att.verifiedAt, att.revokedAt, att.revoked);
    }
}
