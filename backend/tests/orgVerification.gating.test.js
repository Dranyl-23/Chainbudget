"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { requireVerifiedOrg } = require("../src/middleware/orgVerification");
const { migrateLegacyOrganizations } = require("../scripts/migrateLegacyOrganizations");
const { purgeExpiredOrgDocuments } = require("../scripts/purgeExpiredOrgDocuments");

test("Phase 6 Gating: requireVerifiedOrg allows verified organizations", async () => {
  const req = {
    organization: {
      _id: "org-verified",
      verification: { status: "verified", tier: "standard" },
    },
    headers: {},
  };

  let nextCalled = false;
  const res = {
    setHeader: () => {},
    status: () => res,
    json: () => res,
  };

  await requireVerifiedOrg(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("Phase 6 Gating: requireVerifiedOrg allows legacy_unverified during grace period", async () => {
  const prevFlag = process.env.ORG_VERIFICATION_ENFORCE_LEGACY;
  delete process.env.ORG_VERIFICATION_ENFORCE_LEGACY;

  const req = {
    organization: {
      _id: "org-legacy",
      verification: { status: "legacy_unverified" },
    },
  };

  let headerSet = null;
  let nextCalled = false;
  const res = {
    setHeader: (name, val) => {
      headerSet = { name, val };
    },
    status: () => res,
    json: () => res,
  };

  await requireVerifiedOrg(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headerSet?.name, "X-Org-Verification");
  assert.equal(headerSet?.val, "legacy_unverified");

  if (prevFlag !== undefined) process.env.ORG_VERIFICATION_ENFORCE_LEGACY = prevFlag;
});

test("Phase 6 Gating: requireVerifiedOrg blocks legacy_unverified when enforced", async () => {
  const prevFlag = process.env.ORG_VERIFICATION_ENFORCE_LEGACY;
  process.env.ORG_VERIFICATION_ENFORCE_LEGACY = "true";

  const req = {
    organization: {
      _id: "org-legacy-blocked",
      verification: { status: "legacy_unverified" },
    },
  };

  let statusCode = null;
  let responseBody = null;
  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (body) => {
      responseBody = body;
      return res;
    },
  };

  let nextCalled = false;
  await requireVerifiedOrg(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
  assert.equal(responseBody.error, "ORGANIZATION_VERIFICATION_REQUIRED");
  assert.equal(responseBody.legacy, true);

  if (prevFlag !== undefined) process.env.ORG_VERIFICATION_ENFORCE_LEGACY = prevFlag;
  else delete process.env.ORG_VERIFICATION_ENFORCE_LEGACY;
});

test("Phase 6 Gating: requireVerifiedOrg strictly blocks revoked organizations", async () => {
  const req = {
    organization: {
      _id: "org-revoked",
      verification: {
        status: "revoked",
        revocationReason: "Falsified incorporation papers",
      },
    },
  };

  let statusCode = null;
  let responseBody = null;
  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (body) => {
      responseBody = body;
      return res;
    },
  };

  let nextCalled = false;
  await requireVerifiedOrg(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
  assert.equal(responseBody.error, "ORGANIZATION_VERIFICATION_REVOKED");
  assert.equal(responseBody.reason, "Falsified incorporation papers");
});

test("Phase 6 Migration: migrateLegacyOrganizations backfills legacy_unverified status", async () => {
  const mockOrgs = [
    {
      _id: "org-old-1",
      name: "Old Org 1",
      verification: undefined,
      saved: false,
      save: async function () {
        this.saved = true;
      },
    },
    {
      _id: "org-old-2",
      name: "Old Org 2",
      verification: { status: null },
      saved: false,
      save: async function () {
        this.saved = true;
      },
    },
  ];

  const MockOrganizationModel = {
    find: async () => mockOrgs,
  };

  const res = await migrateLegacyOrganizations(MockOrganizationModel);

  assert.equal(res.scanned, 2);
  assert.equal(res.updated, 2);
  assert.equal(mockOrgs[0].verification.status, "legacy_unverified");
  assert.equal(mockOrgs[0].saved, true);
  assert.equal(mockOrgs[1].verification.status, "legacy_unverified");
  assert.equal(mockOrgs[1].saved, true);
});

test("Phase 6 Retention: purgeExpiredOrgDocuments removes expired records", async () => {
  const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
  const expiredDocs = [
    {
      _id: "doc-expired-1",
      application: "app-123",
      purgeAfter: pastDate,
      deleted: false,
      deleteOne: async function () {
        this.deleted = true;
      },
    },
  ];

  let pullCalledWith = null;
  const MockOrgApplication = {
    updateOne: async (query, update) => {
      pullCalledWith = { query, update };
    },
  };

  const MockOrgDocument = {
    find: async () => expiredDocs,
    deleteOne: async () => {},
  };

  const res = await purgeExpiredOrgDocuments({
    OrgDocument: MockOrgDocument,
    OrgApplication: MockOrgApplication,
  });

  assert.equal(res.scanned, 1);
  assert.equal(res.purged, 1);
  assert.equal(expiredDocs[0].deleted, true);
  assert.equal(pullCalledWith.query._id, "app-123");
  assert.equal(pullCalledWith.update.$pull.documents._id, "doc-expired-1");
});
