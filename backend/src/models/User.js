const mongoose = require("mongoose");

// Role levels per the capstone design doc
// 0 = Platform Super Admin
// 1 = Executive Approver (Level 1)
// 2 = Finance / Transaction Officer (Level 2)
// 3 = Member / Contributor (Level 3)
// 4 = Public Viewer (Level 4)

const UserSchema = new mongoose.Schema(
  {
    // ── Wallet Identity ───────────────────────────────────────────────────────
    walletAddress: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    // secp256k1 uncompressed public key — used for signature verification.
    // The private key is NEVER stored here in plaintext.
    publicKey: { type: String, sparse: true, trim: true },
    encryptedPrivateKey: { type: String, select: false },
    encryptedMnemonic: { type: String, select: false },
    // How the wallet was created
    walletType: {
      type: String,
      enum: ["embedded_bip44", "external_metamask", "external_walletconnect", "asgardeo_generated"],
      default: "asgardeo_generated",
    },
    walletVersion: { type: Number, default: 1 },

    // ── Asgardeo (browser-only) ───────────────────────────────────────────────
    asgardeoId: { type: String, unique: true, sparse: true },

    // ── Profile ───────────────────────────────────────────────────────────────
    displayName: { type: String, trim: true },
    avatarUrl: { type: String },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    linkedWallets: [{ type: String, lowercase: true, trim: true }],

    // ── Platform role ─────────────────────────────────────────────────────────
    isSuperAdmin: { type: Boolean, default: false },

    // ── Organization memberships ──────────────────────────────────────────────
    memberships: [
      {
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
        roleLevel: { type: Number, required: true, min: 1, max: 4, default: 3 },
        roleLabel: { type: String, trim: true }, // e.g. "Treasurer", "President"
        isActive: { type: Boolean, default: true },
        joinedAt: { type: Date, default: Date.now },
        hasSBT: { type: Boolean, default: false },
        sbtTokenId: { type: String },
      },
    ],

    // ── Session ───────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },

    // ── Web3 Auth challenge-response ──────────────────────────────────────────
    // One-time nonce issued by GET /api/auth/nonce/:wallet
    nonce: { type: String },
    // 5-minute TTL — expired nonces are rejected
    nonceExpiresAt: { type: Date },
    // Timestamp of last successful wallet signature authentication
    lastAuthenticatedAt: { type: Date },

    // ── Mobile security ───────────────────────────────────────────────────────
    // Whether the user has viewed and acknowledged their recovery phrase.
    // Used to show the backup reminder banner on mobile until confirmed.
    hasBackedUpPhrase: { type: Boolean, default: false },
    // ── Push Notifications ────────────────────────────────────────────────────
    // Stores Expo push tokens per device. Each entry represents one physical
    // device. Tokens are deduplicated on write (POST /api/users/push-token).
    pushTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, enum: ['ios', 'android'], required: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Helper: get role level for a specific organization
UserSchema.methods.getRoleInOrg = function (orgId) {
  const membership = this.memberships.find(
    (m) => m.organization.toString() === orgId.toString() && m.isActive
  );
  return membership ? membership.roleLevel : null;
};

module.exports = mongoose.model("User", UserSchema);
