const { test, describe } = require("node:test");
const assert = require("node:assert");

const User = require("../src/models/User");

describe("RBAC Role Evaluation Suite", () => {
  test("returns correct roleLevel for member in target organization", () => {
    const orgId1 = "66c000000000000000000001";
    const orgId2 = "66c000000000000000000002";

    const user = new User({
      walletAddress: "0x1111111111111111111111111111111111111111",
      displayName: "Alice",
      memberships: [
        { organization: orgId1, roleLevel: 1, roleLabel: "President", isActive: true },
        { organization: orgId2, roleLevel: 3, roleLabel: "Member", isActive: true },
      ],
    });

    assert.strictEqual(user.getRoleInOrg(orgId1), 1, "Role level in org1 must be 1 (President)");
    assert.strictEqual(user.getRoleInOrg(orgId2), 3, "Role level in org2 must be 3 (Member)");
    assert.strictEqual(user.getRoleInOrg("66c000000000000000000003"), null, "Role level in non-joined org must be null");
  });

  test("ignores inactive memberships when checking organization role", () => {
    const orgId = "66c000000000000000000001";
    const user = new User({
      walletAddress: "0x2222222222222222222222222222222222222222",
      displayName: "Bob",
      memberships: [
        { organization: orgId, roleLevel: 2, roleLabel: "Treasurer", isActive: false },
      ],
    });

    assert.strictEqual(user.getRoleInOrg(orgId), null, "Inactive membership must return null role level");
  });
});
