/**
 * Tests: Organization verification — Phase 1 (HTTP routes)
 *
 * Mounts the REAL router (routes/orgApplications.js) on a throwaway Express app and
 * drives it over HTTP. Database models, auth, e-mail and audit logging are replaced
 * with in-memory fakes, so these tests need neither MongoDB nor the network.
 *
 * Run: node --test tests/orgApplication.routes.test.js
 */

"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");

// ── In-memory fakes ──────────────────────────────────────────────────────────
const store = { apps: [], docs: [] };
const sentEmails = [];
const auditEntries = [];
const oid = () => new mongoose.Types.ObjectId().toString();

function withIds(arr) {
  const a = Array.isArray(arr) ? arr : [];
  const push = a.push.bind(a);
  a.push = (...items) => push(...items.map((i) => ({ _id: oid(), ...i })));
  return a;
}

class FakeOrgApplication {
  constructor(data) {
    this._id = oid();
    this.applicant = String(data.applicant);
    this.status = "draft";
    this.revision = 1;
    this.requirementsVersion = "test";
    this.currentStep = "details";
    this.completedSteps = [];
    this.basics = { ...data.basics };
    this.address = {};
    this.contact = {};
    this.representative = {};
    this.governance = { officers: [] };
    this._documents = withIds([]);
    this.consents = {};
    this.review = {};
    this.flags = [];
    this.history = [];
    this.dossierSalt = data.dossierSalt;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    (data.history || []).forEach((h) => this.history.push(h));
  }
  get documents() {
    return this._documents;
  }
  set documents(v) {
    this._documents = withIds(v);
  }
  async save() {
    this.updatedAt = new Date();
    if (!store.apps.includes(this)) store.apps.push(this);
    return this;
  }
  toObject() {
    // Mirror mongoose: fields marked select:false are not part of a normal read
    const o = JSON.parse(JSON.stringify({ ...this, _documents: undefined, documents: this._documents }));
    delete o.dossierSalt;
    if (o.contact) for (const k of ["otpHash", "otpExpiresAt", "otpAttempts", "otpSentAt", "otpSentCount", "otpWindowStart"]) delete o.contact[k];
    return o;
  }
  static _query(result) {
    const q = Promise.resolve(result);
    q.select = () => q;
    q.sort = () => q;
    q.limit = () => q;
    return q;
  }
  static findOne(filter) {
    const hit = store.apps.find((a) => Object.entries(filter).every(([k, v]) => String(a[k]) === String(v)));
    return FakeOrgApplication._query(hit || null);
  }
  static find(filter) {
    const inStatus = filter.status && filter.status.$in;
    const hits = store.apps.filter(
      (a) => String(a.applicant) === String(filter.applicant) && (!inStatus || inStatus.includes(a.status))
    );
    return FakeOrgApplication._query(hits);
  }
  static async countDocuments() {
    return 0;
  }
  static async deleteOne({ _id }) {
    store.apps = store.apps.filter((a) => String(a._id) !== String(_id));
  }
}
FakeOrgApplication.OPEN_STATUSES = ["draft", "submitted", "under_review", "needs_info"];

const FakeOrgDocument = {
  async create(data) {
    const doc = { _id: oid(), ...data };
    store.docs.push(doc);
    return doc;
  },
  async deleteOne({ _id }) {
    store.docs = store.docs.filter((d) => String(d._id) !== String(_id));
  },
  async deleteMany({ application }) {
    store.docs = store.docs.filter((d) => String(d.application) !== String(application));
  },
};

const users = {
  alice: { _id: oid(), walletAddress: "0xaaaa000000000000000000000000000000000001", isSuperAdmin: false },
  bob: { _id: oid(), walletAddress: "0xbbbb000000000000000000000000000000000002", isSuperAdmin: false },
  walletless: { _id: oid(), walletAddress: undefined, isSuperAdmin: false },
};

function stub(relPath, exports) {
  const file = require.resolve(path.join(__dirname, "..", "src", relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] };
}

stub("middleware/auth.js", {
  authenticate: [
    (req, res, next) => {
      const user = users[req.get("x-test-user")];
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      req.user = user;
      next();
    },
  ],
});
stub("models/OrgApplication.js", FakeOrgApplication);
stub("models/OrgDocument.js", FakeOrgDocument);
stub("models/AuditLog.js", { create: async (entry) => auditEntries.push(entry) });
stub("models/Organization.js", { countDocuments: async () => 0 });
stub("services/email.js", {
  sendEmail: async (to, subject, html) => {
    sentEmails.push({ to, subject, html });
    return true;
  },
  escapeHtml: (s) => String(s),
});

const router = require("../src/routes/orgApplications");
const vault = require("../src/utils/documentVault");

// ── HTTP harness ─────────────────────────────────────────────────────────────
const { Duplex } = require("node:stream");

/**
 * Two connected in-memory sockets. node:http can talk over any Duplex, so requests
 * run through the real Express stack without opening (or connecting to) a TCP port.
 */
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
  // Minimal net.Socket surface that node:http touches
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
  app.use("/api/org-applications", router);
  // Same mapping the real app uses for multer errors
  app.use((err, _req, res, _next) => {
    const isMulter = err.code === "LIMIT_FILE_SIZE" || (err.message && err.message.startsWith("Only"));
    res.status(isMulter ? 400 : 500).json({ error: err.message });
  });
  server = http.createServer(app);
});

after(() => server.close());

function request({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const [clientSock, serverSock] = duplexPair();
    server.emit("connection", serverSock);
    // An agent whose "network" is the in-memory socket
    const agent = new http.Agent({ keepAlive: false });
    agent.createConnection = () => clientSock;
    const req = http.request(
      {
        method,
        path: "/api/org-applications" + url,
        headers: { ...headers, connection: "close" },
        agent,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function call(method, url, { as = "alice", body, form } = {}) {
  const headers = { "x-test-user": as };
  let payload;
  if (form) {
    const encoded = new Response(form); // serializes the multipart body + boundary
    headers["content-type"] = encoded.headers.get("content-type");
    payload = Buffer.from(await encoded.arrayBuffer());
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = Buffer.from(JSON.stringify(body));
  }
  if (payload) headers["content-length"] = String(payload.length);
  const res = await request({ method, url, headers, body: payload });
  let json = null;
  try {
    json = JSON.parse(res.text);
  } catch {}
  return { status: res.status, body: json };
}

const PNG = (extra = "") => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`fake-png-${extra}-${crypto.randomUUID()}`)]);
const PDF = (extra = "") => Buffer.from(`%PDF-1.4\n% ${extra} ${crypto.randomUUID()}\n%%EOF`);

function fileForm(buffer, kind, { name = "scan.png", type = "image/png" } = {}) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", new Blob([buffer], { type }), name);
  return form;
}

const DETAILS = {
  displayName: "Hope for Cebu Fund",
  legalName: "Hope for Cebu Fund Drive",
  yearEstablished: 2024,
  mission: "A transparent community fundraising drive supporting typhoon relief in Cebu.",
  intendedUse: "Relief goods and shelter repair",
  extras: { beneficiaryName: "Typhoon-affected families of Cebu" },
  address: { region: "Region VII", province: "Cebu", city: "Cebu City", barangay: "Lahug", street: "12 Example Street" },
};
const REP = { fullName: "Alice Santos", position: "Organizer", idType: "philsys", idNumber: "9999-8888-7777", email: "alice@example.com", authorizedConfirmed: true };
const GOV = { requiredApprovals: 1, highValueThreshold: 5000, isPrivate: false, officers: [] };
const CONSENTS = { acceptTerms: true, acceptPrivacy: true, acceptAccuracy: true };

function lastOtp() {
  const html = sentEmails[sentEmails.length - 1].html;
  return html.match(/>(\d{6})</)[1];
}

function freshUser(label) {
  users[label] = { _id: oid(), walletAddress: "0xdddd" + crypto.randomBytes(18).toString("hex"), isSuperAdmin: false };
  return label;
}

async function newDraft(as = "alice", type = "fundraising") {
  const r = await call("POST", "/", { as, body: { type } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Authentication & requirements", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await call("GET", "/requirements", { as: "nobody" });
    assert.equal(res.status, 401);
  });

  it("serves the type list and per-type requirements", async () => {
    const list = await call("GET", "/requirements");
    assert.equal(list.status, 200);
    assert.equal(list.body.types.length, 10);
    assert.equal(list.body.steps.length, 5);

    const ngo = await call("GET", "/requirements?type=ngo");
    assert.equal(ngo.status, 200);
    assert.ok(ngo.body.documents.groups.some((g) => g.kinds.includes("sec_registration")));

    const bad = await call("GET", "/requirements?type=mafia");
    assert.equal(bad.status, 400);
  });
});

describe("Creating drafts", () => {
  it("rejects invalid types and users without a wallet", async () => {
    assert.equal((await call("POST", "/", { body: { type: "mafia" } })).status, 400);
    const noWallet = await call("POST", "/", { as: "walletless", body: { type: "ngo" } });
    assert.equal(noWallet.status, 400);
    assert.match(noWallet.body.error, /wallet/i);
  });

  it("creates a draft that exposes no secrets, and blocks a second open draft of the same type", async () => {
    const first = await call("POST", "/", { body: { type: "ngo" } });
    assert.equal(first.status, 201);
    assert.equal(first.body.status, "draft");
    assert.equal(first.body.type, "ngo");
    const json = JSON.stringify(first.body);
    assert.equal(json.includes("dossierSalt"), false);
    assert.equal(json.includes("otpHash"), false);

    const dup = await call("POST", "/", { body: { type: "ngo" } });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.applicationId, first.body.id, "client can resume the existing draft");
  });

  it("caps the number of open applications per user", async () => {
    const as = "bob";
    for (const type of ["student_org", "church", "startup"]) {
      assert.equal((await call("POST", "/", { as, body: { type } })).status, 201);
    }
    const over = await call("POST", "/", { as, body: { type: "cooperative" } });
    assert.equal(over.status, 409);
    assert.match(over.body.error, /at most 3/);
  });
});

describe("Ownership (no IDOR)", () => {
  it("other users get 404 for read, step save, upload, discard and submit", async () => {
    const owner = freshUser("owner-1");
    const id = await newDraft(owner, "family");
    assert.equal((await call("GET", `/${id}`, { as: "bob" })).status, 404);
    assert.equal((await call("PATCH", `/${id}/steps/details`, { as: "bob", body: DETAILS })).status, 404);
    assert.equal((await call("POST", `/${id}/documents`, { as: "bob", form: fileForm(PNG(), "rep_id_front") })).status, 404);
    assert.equal((await call("POST", `/${id}/contact/email/send`, { as: "bob" })).status, 404);
    assert.equal((await call("DELETE", `/${id}`, { as: "bob" })).status, 404);
    assert.equal((await call("POST", `/${id}/submit`, { as: "bob" })).status, 404);
    assert.equal((await call("GET", `/${id}`, { as: owner })).status, 200);
  });

  it("malformed ids return 404, and /mine only lists the caller's applications", async () => {
    assert.equal((await call("GET", "/not-an-object-id")).status, 404);
    const mine = await call("GET", "/mine", { as: "alice" });
    assert.equal(mine.status, 200);
    assert.ok(mine.body.length >= 1);
    assert.ok(mine.body.every((a) => store.apps.find((x) => String(x._id) === a.id).applicant === String(users.alice._id)));
  });
});

describe("Step validation", () => {
  it("returns 422 with per-field errors", async () => {
    const u = freshUser("step-user-1");
    const id = await newDraft(u, "church");
    const r = await call("PATCH", `/${id}/steps/details`, { as: u, body: { displayName: "x" } });
    assert.equal(r.status, 422);
    assert.ok(r.body.fields.displayName);
    assert.ok(r.body.fields.mission);
    assert.ok(r.body.fields["address.street"]);
  });

  it("rejects unknown steps and the documents step", async () => {
    const u = freshUser("step-user-2");
    const id = await newDraft(u, "sports_club");
    assert.equal((await call("PATCH", `/${id}/steps/hack`, { as: u, body: {} })).status, 404);
    assert.equal((await call("PATCH", `/${id}/steps/documents`, { as: u, body: {} })).status, 400);
  });
});

describe("End-to-end: draft → submit (fundraising, light tier)", () => {
  let id;

  it("saves the details, identity and governance steps", async () => {
    id = await newDraft("alice", "fundraising");
    const d = await call("PATCH", `/${id}/steps/details`, { body: DETAILS });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    assert.equal(d.body.basics.displayName, "Hope for Cebu Fund");
    assert.ok(d.body.completedSteps.includes("details"));

    const r = await call("PATCH", `/${id}/steps/representative`, { body: REP });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.representative.idLast4, "7777");
    assert.equal(JSON.stringify(r.body).includes("9999-8888"), false, "full ID number is never returned");
    assert.equal(r.body.contact.emailVerified, false);

    const g = await call("PATCH", `/${id}/steps/governance`, { body: GOV });
    assert.equal(g.status, 200, JSON.stringify(g.body));
  });

  it("refuses to submit while things are missing and lists them", async () => {
    const r = await call("POST", `/${id}/submit`);
    assert.equal(r.status, 422);
    const text = r.body.missing.map((m) => m.message).join(" | ");
    assert.match(text, /Missing document/);
    assert.match(text, /contact email/);
    assert.match(text, /terms/i);
  });

  it("uploads documents privately and encrypted at rest", async () => {
    const png = PNG("id");
    const up = await call("POST", `/${id}/documents`, { form: fileForm(png, "rep_id_front") });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    const ref = up.body.documents.find((d) => d.kind === "rep_id_front");
    assert.equal(ref.mime, "image/png");
    assert.equal(ref.sha256, vault.sha256Hex(png));

    const stored = store.docs.find((d) => d.kind === "rep_id_front");
    assert.equal(stored.data.includes(png), false, "ciphertext must not contain the plaintext");
    assert.deepEqual(vault.decryptBuffer({ iv: stored.iv, authTag: stored.authTag, data: stored.data }, id), png);

    assert.equal((await call("POST", `/${id}/documents`, { form: fileForm(PNG("selfie"), "rep_selfie_with_id") })).status, 201);
    const last = await call("POST", `/${id}/documents`, { form: fileForm(PDF("proof"), "purpose_evidence", { name: "proof.pdf", type: "application/pdf" }) });
    assert.equal(last.status, 201, JSON.stringify(last.body));
    assert.ok(last.body.completedSteps.includes("documents"));
    assert.ok(last.body.documentChecklist.every((g) => g.satisfied));
  });

  it("verifies the contact email with a one-time code (wrong code, then right code)", async () => {
    const send = await call("POST", `/${id}/contact/email/send`);
    assert.equal(send.status, 200, JSON.stringify(send.body));
    assert.equal(send.body.to.includes("alice@example.com"), false, "address is masked in the response");
    assert.equal(sentEmails.at(-1).to, "alice@example.com");

    const code = lastOtp();
    const wrong = await call("POST", `/${id}/contact/email/confirm`, { body: { code: code === "000000" ? "111111" : "000000" } });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.attemptsLeft, 4);

    const ok = await call("POST", `/${id}/contact/email/confirm`, { body: { code } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.verified, true);

    const app = (await call("GET", `/${id}`)).body;
    assert.equal(app.contact.emailVerified, true);
    const raw = store.apps.find((a) => String(a._id) === id);
    assert.equal(raw.contact.otpHash, undefined, "code state cleared after success");
  });

  it("requires the final confirmations, then submits and computes the dossier hash", async () => {
    const early = await call("POST", `/${id}/submit`);
    assert.equal(early.status, 422);
    assert.match(early.body.missing.map((m) => m.message).join(" "), /terms/i);

    const review = await call("PATCH", `/${id}/steps/review`, { body: CONSENTS });
    assert.equal(review.status, 200);
    assert.equal(review.body.consentsAccepted, true);
    assert.equal(JSON.stringify(review.body).includes("userAgent"), false);

    const submit = await call("POST", `/${id}/submit`);
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
    assert.equal(submit.body.status, "submitted");
    assert.ok(submit.body.submittedAt);

    const raw = store.apps.find((a) => String(a._id) === id);
    assert.match(raw.dossierHash, /^0x[0-9a-f]{64}$/);
    assert.deepEqual(raw.history.map((h) => h.action), ["created", "contact_email_verified", "submitted"]);
    assert.ok(auditEntries.some((e) => e.action === "org_application.submitted" && String(e.targetId) === id));
  });

  it("locks the application after submission", async () => {
    const patch = await call("PATCH", `/${id}/steps/details`, { body: DETAILS });
    assert.equal(patch.status, 409);
    assert.equal(patch.body.status, "submitted");
    assert.equal((await call("POST", `/${id}/documents`, { form: fileForm(PNG(), "rep_id_front") })).status, 409);
    assert.equal((await call("POST", `/${id}/submit`)).status, 409);
    assert.equal((await call("DELETE", `/${id}`)).status, 409, "only drafts can be discarded");
  });

  it("allows edits and a revised resubmission when more info is requested", async () => {
    const raw = store.apps.find((a) => String(a._id) === id);
    raw.status = "needs_info"; // set by the reviewer in Phase 3

    const patch = await call("PATCH", `/${id}/steps/details`, { body: { ...DETAILS, mission: DETAILS.mission + " Updated after review." } });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.completedSteps.includes("review"), false, "an edit forces re-confirmation");

    const blocked = await call("POST", `/${id}/submit`);
    assert.equal(blocked.status, 422);

    assert.equal((await call("PATCH", `/${id}/steps/review`, { body: CONSENTS })).status, 200);
    const again = await call("POST", `/${id}/submit`);
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.revision, 2);
  });
});

const UP = "upload-user";

describe("Document upload hardening", () => {
  it("rejects files whose bytes do not match an allowed type (spoofed MIME)", async () => {
    const draft = await newDraftOrReuse(UP, "family");
    const html = Buffer.from("<html><script>alert(1)</script></html> padding padding");
    const r = await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(html, "rep_id_front", { name: "id.png", type: "image/png" }) });
    assert.equal(r.status, 400);
  });

  it("rejects disallowed declared types, unknown kinds and kinds not valid for the org type", async () => {
    const draft = await newDraftOrReuse(UP, "family");
    const exe = await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(Buffer.from("MZ....binary...."), "rep_id_front", { name: "x.exe", type: "application/x-msdownload" }) });
    assert.equal(exe.status, 400);

    const unknownKind = await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(PNG(), "passport_stamp") });
    assert.equal(unknownKind.status, 400);

    const wrongForType = await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(PDF(), "sec_registration", { name: "a.pdf", type: "application/pdf" }) });
    assert.equal(wrongForType.status, 400);
  });

  it("rejects a PDF for image-only kinds (ID photo)", async () => {
    const draft = await newDraftOrReuse(UP, "family");
    const r = await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(PDF(), "rep_id_front", { name: "id.pdf", type: "application/pdf" }) });
    assert.equal(r.status, 400);
  });

  it("rejects an identical file attached twice and replaces single-file kinds", async () => {
    const draft = await newDraftOrReuse(UP, "family");
    const png = PNG("same");
    assert.equal((await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(png, "rep_id_front") })).status, 201);
    assert.equal((await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(png, "rep_selfie_with_id") })).status, 409);

    const before = store.docs.filter((d) => String(d.application) === draft && d.kind === "rep_id_front").length;
    const replaced = await call("POST", `/${draft}/documents`, { as: UP, form: fileForm(PNG("new"), "rep_id_front") });
    assert.equal(replaced.status, 201);
    assert.equal(replaced.body.documents.filter((d) => d.kind === "rep_id_front").length, 1);
    assert.equal(store.docs.filter((d) => String(d.application) === draft && d.kind === "rep_id_front").length, before, "old encrypted blob was deleted");
  });

  it("deleting a document removes its ciphertext and un-completes the step", async () => {
    const draft = await newDraftOrReuse(UP, "family");
    const view = (await call("GET", `/${draft}`, { as: UP })).body;
    const target = view.documents[0];
    const del = await call("DELETE", `/${draft}/documents/${target.id}`, { as: UP });
    assert.equal(del.status, 200);
    assert.equal(del.body.documents.find((d) => d.id === target.id), undefined);
    assert.equal(del.body.completedSteps.includes("documents"), false);
    assert.equal((await call("DELETE", `/${draft}/documents/${oid()}`, { as: UP })).status, 404);
  });

  it("discarding a draft deletes the application and all of its files", async () => {
    const draft = await newDraftOrReuse(UP, "family");
    const del = await call("DELETE", `/${draft}`, { as: UP });
    assert.equal(del.status, 200);
    assert.equal(store.docs.filter((d) => String(d.application) === draft).length, 0);
    assert.equal((await call("GET", `/${draft}`, { as: UP })).status, 404);
  });
});

/** A dedicated user per scenario keeps the per-user draft limits out of the way. */
async function newDraftOrReuse(label, type) {
  if (!users[label]) users[label] = { _id: oid(), walletAddress: "0xcccc" + crypto.randomBytes(18).toString("hex"), isSuperAdmin: false };
  const existing = store.apps.find((a) => a.applicant === String(users[label]._id) && a.basics.type === type && a.status === "draft");
  if (existing) return String(existing._id);
  const r = await call("POST", "/", { as: label, body: { type } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}

describe("Email OTP abuse controls", () => {
  it("requires a saved contact email before sending", async () => {
    const draft = await newDraftOrReuse("otp-user-1", "startup");
    const r = await call("POST", `/${draft}/contact/email/send`, { as: "otp-user-1" });
    assert.equal(r.status, 400);
  });

  it("enforces a resend cooldown", async () => {
    const draft = await newDraftOrReuse("otp-user-2", "startup");
    assert.equal((await call("PATCH", `/${draft}/steps/representative`, { as: "otp-user-2", body: { ...REP, email: "otp2@example.com" } })).status, 200);
    assert.equal((await call("POST", `/${draft}/contact/email/send`, { as: "otp-user-2" })).status, 200);
    const again = await call("POST", `/${draft}/contact/email/send`, { as: "otp-user-2" });
    assert.equal(again.status, 429);
    assert.ok(again.body.retryAfterSec > 0);
  });

  it("re-saving the identity step does NOT reset OTP counters (no email-bombing via step edits)", async () => {
    const draft = await newDraftOrReuse("otp-user-2", "startup");
    const before = store.apps.find((a) => String(a._id) === draft).contact.otpSentCount;
    assert.equal(before, 1);
    assert.equal((await call("PATCH", `/${draft}/steps/representative`, { as: "otp-user-2", body: { ...REP, email: "otp2-new@example.com" } })).status, 200);
    const after = store.apps.find((a) => String(a._id) === draft).contact;
    assert.equal(after.otpSentCount, 1, "send counter must survive the edit");
    assert.ok(after.otpSentAt, "cooldown timestamp must survive the edit");
    assert.equal(after.emailVerifiedAt, null);
    const blocked = await call("POST", `/${draft}/contact/email/send`, { as: "otp-user-2" });
    assert.equal(blocked.status, 429, "cooldown still applies after changing the email");
  });

  it("locks out after too many wrong codes", async () => {
    const draft = await newDraftOrReuse("otp-user-3", "startup");
    await call("PATCH", `/${draft}/steps/representative`, { as: "otp-user-3", body: { ...REP, email: "otp3@example.com" } });
    await call("POST", `/${draft}/contact/email/send`, { as: "otp-user-3" });
    const code = lastOtp();
    const wrongCode = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) {
      assert.equal((await call("POST", `/${draft}/contact/email/confirm`, { as: "otp-user-3", body: { code: wrongCode } })).status, 400);
    }
    // Even the correct code is refused after the attempt limit
    const locked = await call("POST", `/${draft}/contact/email/confirm`, { as: "otp-user-3", body: { code } });
    assert.equal(locked.status, 429);
  });

  it("rejects an expired code", async () => {
    const draft = await newDraftOrReuse("otp-user-4", "startup");
    await call("PATCH", `/${draft}/steps/representative`, { as: "otp-user-4", body: { ...REP, email: "otp4@example.com" } });
    await call("POST", `/${draft}/contact/email/send`, { as: "otp-user-4" });
    const code = lastOtp();
    store.apps.find((a) => String(a._id) === draft).contact.otpExpiresAt = new Date(Date.now() - 1000);
    const r = await call("POST", `/${draft}/contact/email/confirm`, { as: "otp-user-4", body: { code } });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /expired/i);
  });
});
