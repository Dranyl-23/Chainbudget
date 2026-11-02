/**
 * Tests: Organization verification — Phase 3 (Admin review queue & org provisioning)
 *
 * Mounts the real admin router (routes/admin.js) over an in-memory Duplex transport
 * and tests super-admin authorization, queue listing, encrypted document streaming,
 * needs_info / reject / approve transitions, Organization + Founder + Budget + Officer
 * provisioning, and verification revocation.
 *
 * Run: node --test tests/orgApplication.admin.test.js
 */

"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const { Duplex } = require("node:stream");
const express = require("express");
const mongoose = require("mongoose");

const vault = require("../src/utils/documentVault");

const oid = () => new mongoose.Types.ObjectId().toString();

// ── In-memory stores ─────────────────────────────────────────────────────────
const store = {
  apps: [],
  docs: [],
  orgs: [],
  budgets: [],
  users: [],
  audits: [],
  notifications: [],
  emails: [],
};

const founderId = oid();
const officerId = oid();
const superAdminId = oid();
const normalUserId = oid();

const userRecords = {
  admin: {
    _id: superAdminId,
    walletAddress: "0xadmin00000000000000000000000000000000001",
    displayName: "Super Verifier",
    email: "admin@chainbudget.io",
    isSuperAdmin: true,
    memberships: [],
    async save() {
      return this;
    },
  },
  normal: {
    _id: normalUserId,
    walletAddress: "0xnorm000000000000000000000000000000000002",
    displayName: "Regular User",
    email: "user@example.com",
    isSuperAdmin: false,
    memberships: [],
    async save() {
      return this;
    },
  },
  founder: {
    _id: founderId,
    walletAddress: "0xfound00000000000000000000000000000000003",
    displayName: "Juan Dela Cruz",
    email: "juan@ngo.org",
    isSuperAdmin: false,
    memberships: [],
    async save() {
      return this;
    },
  },
  officer: {
    _id: officerId,
    walletAddress: "0xoffic00000000000000000000000000000000004",
    displayName: "Maria Santos",
    email: "maria@ngo.org",
    isSuperAdmin: false,
    memberships: [],
    async save() {
      return this;
    },
  },
};
store.users.push(
  userRecords.admin,
  userRecords.normal,
  userRecords.founder,
  userRecords.officer
);

function chainableQuery(val) {
  const q = Promise.resolve(val);
  q.sort = () => q;
  q.skip = () => q;
  q.limit = () => q;
  q.populate = () => q;
  q.select = () => q;
  q.lean = () => q;
  return q;
}

class FakeOrganization {
  constructor(data) {
    this._id = oid();
    Object.assign(this, data);
  }
  async save() {
    if (!store.orgs.includes(this)) store.orgs.push(this);
    return this;
  }
  static async countDocuments() {
    return store.orgs.length;
  }
  static findById(id) {
    const hit = store.orgs.find((o) => String(o._id) === String(id)) || null;
    return chainableQuery(hit);
  }
}

class FakeBudget {
  constructor(data) {
    this._id = oid();
    Object.assign(this, data);
  }
  async save() {
    store.budgets.push(this);
    return this;
  }
}

const FakeUser = {
  findById(id) {
    const hit = store.users.find((u) => String(u._id) === String(id)) || null;
    return chainableQuery(hit);
  },
  async findOne(filter) {
    if (filter.email) {
      return (
        store.users.find(
          (u) => u.email && u.email.toLowerCase() === filter.email.toLowerCase()
        ) || null
      );
    }
    return null;
  },
  async updateOne() {
    return { modifiedCount: 1 };
  },
  async countDocuments() {
    return store.users.length;
  },
};

const FakeOrgApplication = {
  find(filter = {}) {
    const hits = store.apps.filter((a) => {
      if (filter.status) {
        if (filter.status.$in) return filter.status.$in.includes(a.status);
        if (filter.status.$ne) return a.status !== filter.status.$ne;
        return a.status === filter.status;
      }
      return true;
    });
    return chainableQuery(hits);
  },
  async countDocuments(filter = {}) {
    const hits = await FakeOrgApplication.find(filter);
    return hits.length;
  },
  findById(id) {
    const hit = store.apps.find((a) => String(a._id) === String(id)) || null;
    return chainableQuery(hit);
  },
};

const FakeOrgDocument = {
  findOne({ _id, application }) {
    const hit =
      store.docs.find(
        (d) =>
          String(d._id) === String(_id) &&
          String(d.application) === String(application)
      ) || null;
    return chainableQuery(hit);
  },
};

function stub(relPath, exports) {
  const file = require.resolve(path.join(__dirname, "..", "src", relPath));
  require.cache[file] = {
    id: file,
    filename: file,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

stub("middleware/auth.js", {
  authenticate: (req, res, next) => {
    const u = userRecords[req.get("x-test-user")];
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    req.user = u;
    next();
  },
  requireSuperAdmin: (req, res, next) => {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({ error: "Super Admin access required" });
    }
    next();
  },
});
stub("models/User.js", FakeUser);
stub("models/Organization.js", FakeOrganization);
stub("models/Budget.js", FakeBudget);
stub("models/Transaction.js", { countDocuments: async () => 0 });
stub("models/AuditLog.js", {
  create: async (entry) => store.audits.push(entry),
  countDocuments: async () => store.audits.length,
});
stub("models/OrgApplication.js", FakeOrgApplication);
stub("models/OrgDocument.js", FakeOrgDocument);
stub("utils/sbtMinter.js", { mintSBT: async () => "#1 (0xmocktx)" });
stub("services/email.js", {
  sendEmail: async (to, subject, html) => {
    store.emails.push({ to, subject, html });
    return true;
  },
  escapeHtml: (s) => String(s),
});
stub("services/notificationService.js", {
  notifyOrgApplicationDecision: (payload) => {
    store.notifications.push(payload);
  },
});

const adminRouter = require("../src/routes/admin");

// ── Seed a submitted application & a draft application ───────────────────────
const submittedAppId = oid();
const docRefId = oid();
const docBlobId = oid();
const rawEvidenceBytes = Buffer.from("%PDF-1.7\nSEC Certificate of Incorporation\n%%EOF");
const encryptedBlob = vault.encryptBuffer(rawEvidenceBytes, submittedAppId);

store.docs.push({
  _id: docBlobId,
  application: submittedAppId,
  owner: founderId,
  kind: "sec_registration",
  mime: "application/pdf",
  size: rawEvidenceBytes.length,
  sha256: vault.sha256Hex(rawEvidenceBytes),
  iv: encryptedBlob.iv,
  authTag: encryptedBlob.authTag,
  data: encryptedBlob.data,
});

const submittedApp = {
  _id: submittedAppId,
  applicant: userRecords.founder,
  status: "submitted",
  revision: 1,
  requirementsVersion: "2026-11-v1",
  currentStep: "review",
  completedSteps: ["details", "representative", "documents", "governance", "review"],
  basics: {
    type: "ngo",
    displayName: "Bayanihan Relief Foundation",
    legalName: "Bayanihan Relief Foundation Inc.",
    registrationNumber: "SEC-2024-9988",
    yearEstablished: 2021,
    mission: "Delivering transparent disaster relief across the Visayas region.",
    intendedUse: "Emergency relief procurement and shelter kits",
    logoUrl: "",
  },
  address: {
    region: "Region VII",
    province: "Cebu",
    city: "Cebu City",
    barangay: "Lahug",
    street: "88 Gorordo Ave",
    postalCode: "6000",
  },
  contact: {
    email: "juan@ngo.org",
    phone: "09171234567",
    emailVerifiedAt: new Date(),
  },
  representative: {
    fullName: "Juan Dela Cruz",
    position: "Executive Director",
    idType: "philsys",
    idLast4: "4321",
  },
  governance: {
    requiredApprovals: 2,
    highValueThreshold: 25000,
    isPrivate: false,
    officers: [
      {
        name: "Maria Santos",
        email: "maria@ngo.org",
        roleLabel: "Treasurer",
        roleLevel: 2,
      },
    ],
  },
  documents: [
    {
      _id: docRefId,
      document: docBlobId,
      kind: "sec_registration",
      originalName: "sec_cert.pdf",
      mime: "application/pdf",
      size: rawEvidenceBytes.length,
      sha256: vault.sha256Hex(rawEvidenceBytes),
      uploadedAt: new Date(),
      status: "pending",
    },
  ],
  consents: {
    termsAt: new Date(),
    privacyAt: new Date(),
    accuracyAt: new Date(),
  },
  flags: [
    {
      code: "SIMILAR_ORG_NAME",
      detail: "Example duplicate check flag for reviewer inspection",
    },
  ],
  dossierHash: "0x" + "a".repeat(64),
  anchor: { status: "none", attempts: 0 },
  review: {},
  history: [{ at: new Date(), actor: founderId, action: "submitted" }],
  submittedAt: new Date(),
  async save() {
    return this;
  },
};

const draftApp = {
  _id: oid(),
  applicant: userRecords.normal,
  status: "draft",
  revision: 1,
  basics: { type: "family", displayName: "Private Draft" },
  documents: [],
  history: [],
};

store.apps.push(submittedApp, draftApp);

// ── In-memory HTTP harness ───────────────────────────────────────────────────
function duplexPair() {
  let a;
  let b;
  const make = (peer) =>
    new Duplex({
      read() {},
      write(chunk, _enc, cb) {
        peer().push(chunk);
        cb();
      },
      final(cb) {
        peer().push(null);
        cb();
      },
    });
  a = make(() => b);
  b = make(() => a);
  for (const s of [a, b]) {
    s.setTimeout = () => s;
    s.setNoDelay = () => s;
    s.setKeepAlive = () => s;
    s.ref = () => s;
    s.unref = () => s;
    s.remoteAddress = "127.0.0.1";
    s.remotePort = 0;
  }
  return [a, b];
}

let server;

before(() => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  server = http.createServer(app);
});

after(() => server.close());

function call(method, url, { as = "admin", body } = {}) {
  return new Promise((resolve, reject) => {
    const [clientSock, serverSock] = duplexPair();
    server.emit("connection", serverSock);
    const agent = new http.Agent({ keepAlive: false });
    agent.createConnection = () => clientSock;

    const headers = { "x-test-user": as, connection: "close" };
    let payload;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = Buffer.from(JSON.stringify(body));
      headers["content-length"] = String(payload.length);
    }

    const req = http.request(
      { method, path: "/api/admin" + url, headers, agent },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buffer.toString("utf8"));
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            buffer,
          });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Admin verification queue & review (Phase 3)", () => {
  it("blocks non-super-admins with 403", async () => {
    const res = await call("GET", "/org-applications", { as: "normal" });
    assert.equal(res.status, 403);
  });

  it("includes pendingOrgApplications in /api/admin/stats", async () => {
    const res = await call("GET", "/stats");
    assert.equal(res.status, 200);
    assert.equal(res.body.pendingOrgApplications, 1);
  });

  it("lists queued applications and excludes unsubmitted drafts", async () => {
    const res = await call("GET", "/org-applications?status=queue");
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.applications[0].id, submittedAppId);
    assert.equal(res.body.applications[0].flags.length, 1);
  });

  it("opening a submitted application transitions it to under_review and logs an audit entry", async () => {
    const res = await call("GET", `/org-applications/${submittedAppId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "under_review");
    assert.equal(submittedApp.status, "under_review");
    assert.ok(
      store.audits.some(
        (a) =>
          a.action === "admin.org_application_viewed" &&
          String(a.targetId) === submittedAppId
      )
    );
  });

  it("decrypts and streams an attached evidence document with private no-store headers and audit logging", async () => {
    const res = await call(
      "GET",
      `/org-applications/${submittedAppId}/documents/${docRefId}/file`
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.match(res.headers["cache-control"], /no-store/);
    assert.deepEqual(res.buffer, rawEvidenceBytes);
    assert.ok(
      store.audits.some(
        (a) =>
          a.action === "admin.org_document_viewed" &&
          a.details.documentRefId === docRefId
      )
    );
  });

  it("requires a 10+ char applicantMessage when requesting info or rejecting", async () => {
    const shortMsg = await call(
      "POST",
      `/org-applications/${submittedAppId}/review`,
      {
        body: { decision: "needs_info", applicantMessage: "too short" },
      }
    );
    assert.equal(shortMsg.status, 422);
  });

  it("transitions to needs_info, records per-document verdict, and notifies the applicant", async () => {
    const res = await call(
      "POST",
      `/org-applications/${submittedAppId}/review`,
      {
        body: {
          decision: "needs_info",
          applicantMessage: "Please upload a clearer scan of page 2 of your SEC certificate.",
          internalNotes: "Page 1 verified against SEC database.",
          documentVerdicts: {
            [docRefId]: {
              status: "rejected",
              reviewerNote: "Page 2 is blurry",
            },
          },
        },
      }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "needs_info");
    assert.equal(res.body.documents[0].status, "rejected");
    assert.equal(res.body.documents[0].reviewerNote, "Page 2 is blurry");
    assert.equal(store.notifications.at(-1).decision, "needs_info");
  });

  it("approves a resubmitted application, provisions the Organization, Founder, Budgets, and Co-Officers", async () => {
    // Simulate applicant resubmitting
    submittedApp.status = "under_review";
    submittedApp.revision = 2;

    const res = await call(
      "POST",
      `/org-applications/${submittedAppId}/review`,
      {
        body: {
          decision: "approve",
          applicantMessage: "All SEC and BIR certificates verified.",
          internalNotes: "Approved Tier 1 standard NGO.",
        },
      }
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, "approved");
    assert.ok(res.body.organization, "Organization ID linked on application");
    assert.equal(res.body.anchor.status, "pending");

    // Verify Organization was created with verified status & dossierHash
    assert.equal(store.orgs.length, 1);
    const createdOrg = store.orgs[0];
    assert.equal(createdOrg.name, "Bayanihan Relief Foundation");
    assert.equal(createdOrg.legalName, "Bayanihan Relief Foundation Inc.");
    assert.equal(createdOrg.verification.status, "verified");
    assert.equal(createdOrg.verification.tier, "standard");
    assert.equal(createdOrg.verification.dossierHash, submittedApp.dossierHash);

    // Verify Founder membership (Level 1)
    assert.equal(userRecords.founder.memberships.length, 1);
    assert.equal(userRecords.founder.memberships[0].roleLevel, 1);
    assert.equal(userRecords.founder.memberships[0].roleLabel, "Executive Director");

    // Verify Co-Officer membership (Level 2) + invitation email
    assert.equal(userRecords.officer.memberships.length, 1);
    assert.equal(userRecords.officer.memberships[0].roleLevel, 2);
    assert.ok(store.emails.some((e) => e.to === "maria@ngo.org"));

    // Verify 4 default template budgets were seeded
    assert.equal(store.budgets.length, 4);
  });

  it("revokes a verified organization and updates the linked application", async () => {
    const createdOrg = store.orgs[0];
    const noReason = await call(
      "POST",
      `/organizations/${createdOrg._id}/revoke-verification`,
      { body: { reason: "no" } }
    );
    assert.equal(noReason.status, 422);

    const ok = await call(
      "POST",
      `/organizations/${createdOrg._id}/revoke-verification`,
      { body: { reason: "Fraudulent board resolution reported by SEC" } }
    );
    assert.equal(ok.status, 200);
    assert.equal(createdOrg.verification.status, "revoked");
    assert.equal(
      createdOrg.verification.revocationReason,
      "Fraudulent board resolution reported by SEC"
    );
    assert.equal(submittedApp.status, "revoked");
  });
});
