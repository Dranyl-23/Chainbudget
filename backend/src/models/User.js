const mongoose = require("mongoose");

// Role levels per the capstone design doc
// 0 = Platform Super Admin
// 1 = Executive Approver (Level 1)
// 2 = Finance / Transaction Officer (Level 2)
// 3 = Member / Contributor (Level 3)
// 4 = Public Viewer (Level 4)

const UserSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    asgardeoId: {
      type: String,
      unique: true,
      sparse: true,
    },
    displayName: { type: String, trim: true },
    avatarUrl: { type: String },
    linkedWallets: [{ type: String, lowercase: true, trim: true }],
    email: { type: String, trim: true, lowercase: true },
    // Platform-level role (super admin or not)
    isSuperAdmin: { type: Boolean, default: false },
    // Organization memberships
    memberships: [
      {
        organization: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organization",
        },
        roleLevel: {
          type: Number,
          required: true,
          min: 1,
          max: 4,
          default: 3,
        },
        roleLabel: { type: String, trim: true }, // e.g. "Treasurer", "President"
        isActive: { type: Boolean, default: true },
        joinedAt: { type: Date, default: Date.now },
        hasSBT: { type: Boolean, default: false },
        sbtTokenId: { type: String },
      },
    ],
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    // Nonce for wallet signature challenge-response auth
    nonce: { type: String },
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
