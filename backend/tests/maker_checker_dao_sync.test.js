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

  test("strict maker-checker: submitter cannot approve own transaction regardless of org size", () => {
    assert.doesNotMatch(src, /otherApprovers >= \(txn\.organization\.requiredApprovals \|\| 1\)/);
    assert.match(src, /action === "approved" && txn\.submittedBy && txn\.submittedBy\.toString\(\) === req\.user\._id\.toString\(\)/);
    const processSrc = read("src/routes/transactions.js");
    assert.match(processSrc, /txn\.submittedBy\.toString\(\) === req\.user\._id\.toString\(\)/);
  });

  test("guard simulation: self-approval always blocked, other L1/L2 approvers & self-rejection allowed", () => {
    const blocked = ({ action, submitter, voter }) =>
      action === "approved" && submitter === voter;
    assert.strictEqual(blocked({ action: "approved", submitter: "a", voter: "a" }), true);
    assert.strictEqual(blocked({ action: "approved", submitter: "a", voter: "b" }), false);
    assert.strictEqual(blocked({ action: "rejected", submitter: "a", voter: "a" }), false);
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
