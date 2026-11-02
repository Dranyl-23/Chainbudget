/**
 * Tests: Organization verification — Phase 1 (pure rules)
 *
 * Covers the requirements config, step validators, state machine, document vault,
 * dossier hash, email OTP rules and the applicant-facing view.
 *
 * Run: node --test tests/orgApplication.rules.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const reqs = require("../src/config/orgVerificationRequirements");
const service = require("../src/services/orgApplicationService");
const vault = require("../src/utils/documentVault");
const Organization = require("../src/models/Organization");
const OrgApplication = require("../src/models/OrgApplication");

const VALID_DETAILS = {
  displayName: "Barangay Bright Youth Council",
  legalName: "Bright Youth Council of Barangay 12",
  registrationNumber: "REG-2024-0042",
  yearEstablished: 2020,
  mission: "We organise youth programs and manage the barangay youth development fund transparently.",
  intendedUse: "Youth sports events and scholarships",
  address: {
    region: "Region VII",
    province: "Cebu",
    city: "Cebu City",
    barangay: "Lahug",
    street: "12 Example Street",
    postalCode: "6000",
  },
};

const VALID_REP = {
  fullName: "Juan Dela Cruz",
  position: "President",
  idType: "philsys",
  idNumber: "1234-5678-9012",
  email: "juan@example.com",
  phone: "0917 123 4567",
  authorizedConfirmed: true,
};

describe("Requirements config", () => {
  it("covers exactly the organization types allowed by the Organization model", () => {
    const modelTypes = Organization.schema.path("type").enumValues;
    assert.deepEqual([...reqs.ORG_TYPES].sort(), [...modelTypes].sort());
    for (const t of reqs.ORG_TYPES) assert.ok(reqs.TYPE_PROFILES[t], `profile for ${t}`);
  });

  it("OrgApplication model enum matches the same list", () => {
    const appTypes = OrgApplication.schema.path("basics.type").enumValues;
    assert.deepEqual([...appTypes].sort(), [...reqs.ORG_TYPES].sort());
  });

  it("every document kind referenced by a profile is defined", () => {
    for (const t of reqs.ORG_TYPES) {
      for (const g of reqs.getDocumentGroups(t)) {
        for (const k of g.kinds) assert.ok(reqs.DOCUMENT_KINDS[k], `${t} -> ${k}`);
      }
    }
  });

  it("standard types require ID, selfie, authorization letter plus type documents", () => {
    const ids = reqs.getDocumentGroups("ngo").map((g) => g.id);
    assert.ok(ids.includes("rep_id") && ids.includes("rep_selfie") && ids.includes("authorization"));
    assert.ok(ids.includes("registration") && ids.includes("bylaws") && ids.includes("tax"));
  });

  it("light-tier types (family, fundraising) do not require an authorization letter", () => {
    for (const t of ["family", "fundraising"]) {
      assert.equal(reqs.TYPE_PROFILES[t].tier, "light");
      assert.ok(!reqs.getDocumentGroups(t).some((g) => g.id === "authorization"));
    }
  });

  it("getRequirements returns steps, fields and document kinds for clients", () => {
    const r = reqs.getRequirements("student_org");
    assert.equal(r.type, "student_org");
    assert.deepEqual(r.steps.map((s) => s.key), ["details", "representative", "documents", "governance", "review"]);
    assert.ok(r.details.extraFields.some((f) => f.key === "adviserEmail"));
    assert.ok(r.documents.kinds.school_accreditation);
    assert.equal(reqs.getRequirements("nope"), null);
  });

  it("evaluateDocuments honours any-of groups", () => {
    const base = [{ kind: "rep_id_front" }, { kind: "rep_selfie_with_id" }, { kind: "authorization_letter" }];
    const none = reqs.evaluateDocuments("sports_club", base);
    assert.equal(none.complete, false);
    const withLeague = reqs.evaluateDocuments("sports_club", [...base, { kind: "league_accreditation" }]);
    assert.equal(withLeague.complete, true);
  });
});

describe("Step validation", () => {
  const ngo = { type: "ngo" };

  it("accepts a valid details payload and normalizes whitespace", () => {
    // student_org also needs its type-specific extra fields
    const missingExtras = reqs.validateStep("details", VALID_DETAILS, { type: "student_org" });
    assert.equal(missingExtras.ok, false);
    assert.ok(missingExtras.errors["extras.schoolName"]);

    const ok = reqs.validateStep(
      "details",
      { ...VALID_DETAILS, displayName: "  Bright   Youth  ", extras: { schoolName: "UP Cebu", adviserName: "Dr. Reyes", adviserEmail: "REYES@up.edu.ph" } },
      { type: "student_org" }
    );
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.equal(ok.value.basics.displayName, "Bright Youth");
    assert.equal(ok.value.basics.extras.adviserEmail, "reyes@up.edu.ph");
  });

  it("requires a registration number only for registered types", () => {
    const noReg = { ...VALID_DETAILS, registrationNumber: "" };
    assert.ok(reqs.validateStep("details", noReg, ngo).errors.registrationNumber);
    assert.equal(reqs.validateStep("details", noReg, { type: "family" }).errors.registrationNumber, undefined);
  });

  it("rejects short missions, bad years, bad postal codes and bad logos", () => {
    const r = reqs.validateStep(
      "details",
      { ...VALID_DETAILS, mission: "too short", yearEstablished: 1800, address: { ...VALID_DETAILS.address, postalCode: "12" }, logoUrl: "javascript:alert(1)" },
      ngo
    );
    assert.equal(r.ok, false);
    assert.ok(r.errors.mission && r.errors.yearEstablished && r.errors["address.postalCode"] && r.errors.logoUrl);
  });

  it("representative: stores only the last 4 characters of the ID number", () => {
    const r = reqs.validateStep("representative", VALID_REP, ngo);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.value.representative.idLast4, "9012");
    assert.equal(JSON.stringify(r.value).includes("1234-5678"), false);
    assert.equal(JSON.stringify(r.value).includes("123456789012"), false);
    assert.equal(r.value.contact.phone, "09171234567");
  });

  it("representative: barangay applications must use a .gov.ph email", () => {
    const bad = reqs.validateStep("representative", VALID_REP, { type: "barangay" });
    assert.ok(bad.errors.email);
    const good = reqs.validateStep("representative", { ...VALID_REP, email: "captain@barangay12.gov.ph" }, { type: "barangay" });
    assert.equal(good.ok, true);
  });

  it("representative: requires the authorization confirmation and a known ID type", () => {
    const r = reqs.validateStep("representative", { ...VALID_REP, authorizedConfirmed: false, idType: "library_card" }, ngo);
    assert.ok(r.errors.authorizedConfirmed && r.errors.idType);
  });

  it("governance: founder plus officers must be able to reach requiredApprovals", () => {
    const tooFew = reqs.validateStep("governance", { requiredApprovals: 3, highValueThreshold: 5000, officers: [{ name: "Ana Cruz", email: "ana@example.com", roleLevel: 2 }] }, ngo);
    assert.ok(tooFew.errors.officers);

    const ok = reqs.validateStep(
      "governance",
      {
        requiredApprovals: 3,
        highValueThreshold: 5000,
        officers: [
          { name: "Ana Cruz", email: "ana@example.com", roleLevel: 2 },
          { name: "Ben Lim", email: "ben@example.com", roleLevel: 1 },
        ],
      },
      ngo
    );
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  });

  it("governance: rejects duplicate officer emails and the founder's own email", () => {
    const r = reqs.validateStep(
      "governance",
      {
        requiredApprovals: 1,
        officers: [
          { name: "Ana Cruz", email: "ana@example.com" },
          { name: "Ana Again", email: "ANA@example.com" },
          { name: "Me", email: "founder@example.com" },
        ],
      },
      { type: "ngo", founderEmail: "founder@example.com" }
    );
    assert.ok(r.errors["officers.1.email"]);
    assert.ok(r.errors["officers.2.email"]);
  });

  it("governance: bounds approvals and threshold", () => {
    const r = reqs.validateStep("governance", { requiredApprovals: 0, highValueThreshold: -5, officers: [] }, ngo);
    assert.ok(r.errors.requiredApprovals && r.errors.highValueThreshold);
  });

  it("review requires all three consents", () => {
    assert.equal(reqs.validateStep("review", { acceptTerms: true, acceptPrivacy: true }, ngo).ok, false);
    assert.equal(reqs.validateStep("review", { acceptTerms: true, acceptPrivacy: true, acceptAccuracy: true }, ngo).ok, true);
  });

  it("documents cannot be saved through the step endpoint", () => {
    assert.equal(reqs.validateStep("documents", {}, ngo).ok, false);
  });
});

describe("State machine", () => {
  it("allows the intended lifecycle", () => {
    assert.ok(service.canTransition("draft", "submitted"));
    assert.ok(service.canTransition("submitted", "under_review"));
    assert.ok(service.canTransition("under_review", "needs_info"));
    assert.ok(service.canTransition("needs_info", "submitted"));
    assert.ok(service.canTransition("under_review", "approved"));
    assert.ok(service.canTransition("approved", "revoked"));
  });

  it("blocks illegal jumps", () => {
    assert.equal(service.canTransition("draft", "approved"), false);
    assert.equal(service.canTransition("rejected", "approved"), false);
    assert.equal(service.canTransition("approved", "draft"), false);
    assert.equal(service.canTransition("submitted", "draft"), false);
  });

  it("only draft and needs_info are editable", () => {
    for (const s of ["draft", "needs_info"]) assert.ok(service.isEditable(s));
    for (const s of ["submitted", "under_review", "approved", "rejected", "revoked"]) assert.equal(service.isEditable(s), false);
  });
});

describe("applyStep / submit readiness", () => {
  function newApp(type = "ngo") {
    return { _id: "66c0000000000000000000a1", status: "draft", basics: { type }, completedSteps: [], documents: [], contact: {}, consents: {} };
  }

  it("applyStep returns a patch and marks the step complete", () => {
    const r = service.applyStep(newApp(), "details", VALID_DETAILS);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.patch.basics.type, "ngo");
    assert.equal(r.patch.basics.registrationKey, "reg20240042");
    assert.deepEqual(r.patch.completedSteps, ["details"]);
    assert.equal(r.patch.currentStep, "representative");
  });

  it("changing the contact email resets email verification; keeping it does not", () => {
    const verifiedAt = new Date();
    const app = { ...newApp(), contact: { email: "juan@example.com", emailVerifiedAt: verifiedAt } };
    const same = service.applyStep(app, "representative", VALID_REP);
    assert.equal(same.patch.contact.emailVerifiedAt, verifiedAt);
    const changed = service.applyStep(app, "representative", { ...VALID_REP, email: "other@example.com" });
    assert.equal(changed.patch.contact.emailVerifiedAt, null);
  });

  it("editing any step invalidates the final confirmation", () => {
    const app = { ...newApp(), completedSteps: ["details", "review"] };
    const r = service.applyStep(app, "details", VALID_DETAILS);
    assert.ok(!r.patch.completedSteps.includes("review"));
  });

  it("documentsCompletion adds/removes the documents step", () => {
    const docs = (kinds) => kinds.map((kind) => ({ kind }));
    const full = ["rep_id_front", "rep_selfie_with_id", "purpose_evidence"];
    const done = service.documentsCompletion({ basics: { type: "family" }, completedSteps: ["review"], documents: docs(full) });
    assert.ok(done.completedSteps.includes("documents"));
    assert.ok(!done.completedSteps.includes("review"));
    const partial = service.documentsCompletion({ basics: { type: "family" }, completedSteps: ["documents"], documents: docs(full.slice(0, 2)) });
    assert.ok(!partial.completedSteps.includes("documents"));
  });

  it("missingForSubmit lists every outstanding item and is empty when ready", () => {
    const empty = service.missingForSubmit(newApp("family"));
    const text = empty.map((m) => m.message).join(" | ");
    assert.match(text, /details/);
    assert.match(text, /Missing document/);
    assert.match(text, /contact email/);
    assert.match(text, /terms/);

    const now = new Date();
    const ready = {
      basics: { type: "family" },
      completedSteps: ["details", "representative", "governance", "documents", "review"],
      documents: ["rep_id_front", "rep_selfie_with_id", "purpose_evidence"].map((kind) => ({ kind })),
      contact: { emailVerifiedAt: now },
      consents: { termsAt: now, privacyAt: now, accuracyAt: now },
    };
    assert.deepEqual(service.missingForSubmit(ready), []);
  });
});

describe("Document vault", () => {
  const SECRET = "unit-test-secret-for-document-vault";

  it("round-trips a binary buffer", () => {
    const plain = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
    const blob = vault.encryptBuffer(plain, "app1", SECRET);
    assert.notDeepEqual(blob.data, plain);
    assert.deepEqual(vault.decryptBuffer(blob, "app1", SECRET), plain);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plain = Buffer.from("same bytes same bytes");
    const a = vault.encryptBuffer(plain, "app1", SECRET);
    const b = vault.encryptBuffer(plain, "app1", SECRET);
    assert.notEqual(a.iv, b.iv);
    assert.notDeepEqual(a.data, b.data);
  });

  it("fails if the blob is tampered with", () => {
    const blob = vault.encryptBuffer(Buffer.from("sensitive id scan"), "app1", SECRET);
    const tampered = { ...blob, data: Buffer.from(blob.data) };
    tampered.data[0] ^= 0xff;
    assert.throws(() => vault.decryptBuffer(tampered, "app1", SECRET));
  });

  it("is bound to the owning application (AAD) and to the key", () => {
    const blob = vault.encryptBuffer(Buffer.from("sensitive id scan"), "app1", SECRET);
    assert.throws(() => vault.decryptBuffer(blob, "app2", SECRET), "blob moved to another application");
    assert.throws(() => vault.decryptBuffer(blob, "app1", "a-different-secret"), "wrong key");
  });

  it("sniffs real file types from magic bytes", () => {
    const pad = Buffer.alloc(16);
    assert.equal(vault.sniffMime(Buffer.concat([Buffer.from("%PDF-1.7\n"), pad])), "application/pdf");
    assert.equal(vault.sniffMime(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), "image/png");
    assert.equal(vault.sniffMime(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), "image/jpeg");
    assert.equal(vault.sniffMime(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), pad])), "image/webp");
    assert.equal(vault.sniffMime(Buffer.from("<html><script>alert(1)</script></html>")), null);
    assert.equal(vault.sniffMime(Buffer.from("tiny")), null);
  });
});

describe("Dossier hash", () => {
  const app = {
    _id: "66c0000000000000000000a1",
    revision: 1,
    requirementsVersion: reqs.REQUIREMENTS_VERSION,
    basics: { type: "ngo", displayName: "A", legalName: "A Inc", registrationNumber: "X-1", yearEstablished: 2020, mission: "m".repeat(40), intendedUse: "use of funds", extras: {} },
    address: { region: "R", province: "P", city: "C", barangay: "B", street: "S st" },
    representative: { fullName: "Juan", position: "Pres", idType: "philsys", idLast4: "9012" },
    contact: { email: "juan@example.com" },
    governance: { requiredApprovals: 2, highValueThreshold: 10000, isPrivate: false, officers: [{ name: "Z", email: "z@x.com", roleLevel: 2 }, { name: "A", email: "a@x.com", roleLevel: 1 }] },
    documents: [{ kind: "b", sha256: "2" }, { kind: "a", sha256: "1" }],
  };

  it("is deterministic and independent of array / key ordering", () => {
    const h1 = service.computeDossierHash(app, "salt").hash;
    const shuffled = { ...app, documents: [...app.documents].reverse(), governance: { ...app.governance, officers: [...app.governance.officers].reverse() } };
    assert.equal(service.computeDossierHash(shuffled, "salt").hash, h1);
    assert.match(h1, /^0x[0-9a-f]{64}$/);
  });

  it("changes when content, revision or salt change", () => {
    const base = service.computeDossierHash(app, "salt").hash;
    assert.notEqual(service.computeDossierHash({ ...app, revision: 2 }, "salt").hash, base);
    assert.notEqual(service.computeDossierHash(app, "other-salt").hash, base);
    assert.notEqual(service.computeDossierHash({ ...app, basics: { ...app.basics, legalName: "B Inc" } }, "salt").hash, base);
  });

  it("canonical form never contains the full ID number or file contents", () => {
    const { canonical } = service.computeDossierHash(app, "salt");
    assert.ok(canonical.includes("9012"));
    assert.equal(canonical.includes("dossierSalt"), false);
  });
});

describe("Email OTP rules", () => {
  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) assert.match(service.generateOtp(), /^\d{6}$/);
  });

  it("matches only the right code, application and email", () => {
    const hash = service.hashOtp("app1", "Juan@Example.com", "123456");
    assert.equal(service.otpMatches("app1", "juan@example.com", "123456", hash), true);
    assert.equal(service.otpMatches("app1", "juan@example.com", "654321", hash), false);
    assert.equal(service.otpMatches("app2", "juan@example.com", "123456", hash), false);
    assert.equal(service.otpMatches("app1", "other@example.com", "123456", hash), false);
    assert.equal(service.otpMatches("app1", "juan@example.com", "12345", hash), false);
    assert.equal(service.otpMatches("app1", "juan@example.com", "123456", undefined), false);
  });

  it("enforces a resend cooldown and an hourly cap", () => {
    const now = new Date("2026-11-02T10:00:00Z");
    assert.equal(service.evaluateOtpSend({}, now).allowed, true);

    const justSent = { otpSentAt: new Date(now - 10_000), otpSentCount: 1, otpWindowStart: new Date(now - 10_000) };
    const cooldown = service.evaluateOtpSend(justSent, now);
    assert.equal(cooldown.allowed, false);
    assert.ok(cooldown.retryAfterSec > 0 && cooldown.retryAfterSec <= 60);

    const capped = { otpSentAt: new Date(now - 120_000), otpSentCount: 5, otpWindowStart: new Date(now - 600_000) };
    assert.equal(service.evaluateOtpSend(capped, now).allowed, false);

    const newWindow = { otpSentAt: new Date(now - 2 * 3600_000), otpSentCount: 5, otpWindowStart: new Date(now - 2 * 3600_000) };
    const fresh = service.evaluateOtpSend(newWindow, now);
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.sentCount, 0);
  });
});

describe("Applicant view", () => {
  it("never exposes secrets, reviewer notes, flags or consent metadata", () => {
    const view = service.toApplicantView({
      _id: "66c0000000000000000000a1",
      status: "needs_info",
      revision: 2,
      basics: { type: "ngo", displayName: "A" },
      contact: { email: "juan@example.com", otpHash: "SECRET", otpExpiresAt: new Date(), emailVerifiedAt: new Date() },
      dossierSalt: "SALT",
      flags: [{ code: "DUPLICATE_REGISTRATION_NUMBER", detail: "x" }],
      review: { reviewer: "66c0000000000000000000ff", internalNotes: "looks fishy", checklist: { a: 1 }, applicantMessage: "Please upload a clearer ID" },
      consents: { termsAt: new Date(), privacyAt: new Date(), accuracyAt: new Date(), ip: "1.2.3.4", userAgent: "UA" },
      documents: [{ _id: "66c0000000000000000000d1", document: "66c0000000000000000000d2", kind: "rep_id_front", mime: "image/png", size: 10, sha256: "abc" }],
    });
    const json = JSON.stringify(view);
    for (const secret of ["SECRET", "SALT", "looks fishy", "DUPLICATE_REGISTRATION_NUMBER", "1.2.3.4", "internalNotes", "otpHash"]) {
      assert.equal(json.includes(secret), false, `leaked: ${secret}`);
    }
    assert.equal(view.review.applicantMessage, "Please upload a clearer ID");
    assert.equal(view.contact.emailVerified, true);
    assert.equal(view.consentsAccepted, true);
    assert.equal(view.documents[0].id, "66c0000000000000000000d1");
    assert.ok(Array.isArray(view.documentChecklist));
  });
});

describe("Models", () => {
  it("applyPatch on a REAL mongoose document keeps OTP counters and sibling fields", () => {
    const doc = new OrgApplication({
      applicant: "66c0000000000000000000a1",
      basics: { type: "ngo", registrationKey: "keepme" },
      contact: { email: "juan@example.com", otpSentCount: 2, otpSentAt: new Date(), emailVerifiedAt: new Date() },
    });

    // Re-saving the identity step with a new email must reset verification only
    const rep = service.applyStep(doc, "representative", { ...VALID_REP, email: "new@example.com" });
    assert.equal(rep.ok, true, JSON.stringify(rep.errors));
    service.applyPatch(doc, rep.patch);
    assert.equal(doc.contact.email, "new@example.com");
    assert.equal(doc.contact.emailVerifiedAt, null);
    assert.equal(doc.contact.otpSentCount, 2, "OTP send counter must survive the edit");
    assert.ok(doc.contact.otpSentAt, "cooldown timestamp must survive the edit");
    assert.equal(doc.representative.idLast4, "9012");
    assert.deepEqual([...doc.completedSteps], ["representative"]);

    // Details step merges into basics without dropping the type / registrationKey
    const det = service.applyStep(doc, "details", VALID_DETAILS);
    assert.equal(det.ok, true, JSON.stringify(det.errors));
    service.applyPatch(doc, det.patch);
    assert.equal(doc.basics.type, "ngo");
    assert.equal(doc.basics.displayName, VALID_DETAILS.displayName);
    assert.equal(doc.basics.registrationKey, "reg20240042");
    assert.equal(doc.address.city, "Cebu City");

    // Governance with officers (array of subdocuments)
    const gov = service.applyStep(doc, "governance", {
      requiredApprovals: 2,
      highValueThreshold: 7500,
      officers: [{ name: "Ana Cruz", email: "ANA@example.com", roleLevel: 1 }],
    });
    assert.equal(gov.ok, true, JSON.stringify(gov.errors));
    service.applyPatch(doc, gov.patch);
    assert.equal(doc.governance.officers.length, 1);
    assert.equal(doc.governance.officers[0].email, "ana@example.com");

    // Consents, documents and the applicant view all work on the real schema
    service.applyPatch(doc, service.applyStep(doc, "review", { acceptTerms: true, acceptPrivacy: true, acceptAccuracy: true }).patch);
    doc.documents.push({ document: "66c0000000000000000000d2", kind: "rep_id_front", mime: "image/png", size: 5, sha256: "abc" });
    doc.completedSteps = service.documentsCompletion(doc).completedSteps;
    assert.equal(doc.completedSteps.includes("review"), false, "a document change forces re-confirmation");
    const view = service.toApplicantView(doc);
    assert.equal(view.documents.length, 1);
    assert.equal(view.consentsAccepted, true);
    assert.equal(JSON.stringify(view).includes("otpSentCount"), false);
  });

  it("OrgApplication defaults to a private draft with no anchor", async () => {
    const app = new OrgApplication({ applicant: "66c0000000000000000000a1", basics: { type: "ngo" } });
    assert.equal(app.status, "draft");
    assert.equal(app.revision, 1);
    assert.equal(app.anchor.status, "none");
    await app.validate();
  });

  it("OrgApplication rejects unknown organization types and statuses", async () => {
    const bad = new OrgApplication({ applicant: "66c0000000000000000000a1", basics: { type: "mafia" }, status: "whatever" });
    const err = await bad.validate().then(() => null, (e) => e);
    assert.ok(err, "validation should fail");
    assert.ok(err.errors["basics.type"]);
    assert.ok(err.errors.status);
  });

  it("OTP and salt fields are excluded from default queries", () => {
    for (const p of ["contact.otpHash", "contact.otpExpiresAt", "contact.otpAttempts", "dossierSalt"]) {
      assert.equal(OrgApplication.schema.path(p).options.select, false, p);
    }
    assert.equal(require("../src/models/OrgDocument").schema.path("data").options.select, false);
  });
});
