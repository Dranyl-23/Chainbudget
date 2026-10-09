const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("Maker-checker guard in approvals route", () => {
  const src = read("src/routes/approvals.js");

  test("blocks 'approved' votes from the transaction submitter with 403", () => {
    assert.match(src, /action === "approved" && txn\.submittedBy && txn\.submittedBy\.toString\(\) === req\.user\._id\.toString\(\)/);
    assert.match(src, /cannot approve a transaction you submitted/);
  });

  test("guard runs before the duplicate-vote check and signature handling", () => {
    const guard = src.indexOf("Maker-checker");
    assert.ok(guard > -1);
    assert.ok(guard < src.indexOf("Prevent duplicate votes"));
    assert.ok(guard < src.indexOf("Approval.create"));
  });

  test("has deadlock safety valve based on other eligible L1/L2 approvers", () => {
    assert.match(src, /otherApprovers >= \(txn\.organization\.requiredApprovals \|\| 1\)/);
    assert.match(src, /roleLevel: \{ \$lte: 2 \}/);
  });

  test("guard simulation: self-approval blocked, others/rejections allowed, small orgs waived", () => {
    const blocked = ({ action, submitter, voter, others, required }) =>
      action === "approved" && submitter === voter && others >= (required || 1);
    assert.strictEqual(blocked({ action: "approved", submitter: "a", voter: "a", others: 2, required: 2 }), true);
    assert.strictEqual(blocked({ action: "approved", submitter: "a", voter: "b", others: 2, required: 2 }), false);
    assert.strictEqual(blocked({ action: "rejected", submitter: "a", voter: "a", others: 2, required: 2 }), false);
    assert.strictEqual(blocked({ action: "approved", submitter: "a", voter: "a", others: 1, required: 2 }), false);
  });
});

describe("DAO proposal sync uses schema field 'creator'", () => {
  test("dao.js no longer references proposal.proposer", () => {
    assert.doesNotMatch(read("src/routes/dao.js"), /proposal\.proposer/);
  });

  test("dao.js /sync checks proposal.creator, which exists in the Proposal schema", () => {
    assert.match(read("src/routes/dao.js"), /proposal\.creator && proposal\.creator\.toString\(\) === req\.user\._id\.toString\(\)/);
    assert.match(read("src/models/Proposal.js"), /creator:\s*\{/);
  });
});
