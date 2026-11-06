/**
 * orgVerificationRequirements.js
 *
 * Single source of truth for organization legitimacy requirements.
 *
 * - Served to web and mobile through GET /api/org-applications/requirements so both
 *   clients render the exact same steps, fields and document checklist.
 * - Used by the backend to validate every step and to decide whether an application
 *   is ready to submit.
 *
 * Everything in this file is pure (no DB, no I/O) so it is trivially unit-testable.
 *
 * NOTE: The per-type document lists reflect common Philippine registration bodies
 * (SEC, DTI, CDA, DHSUD, BIR). They are a proposal that must be confirmed with the
 * project adviser — change them here and both platforms follow.
 */

"use strict";

const REQUIREMENTS_VERSION = "2026-11-v1";

// Must stay identical to the enum in models/Organization.js
const ORG_TYPES = [
  "student_org",
  "barangay",
  "homeowners_association",
  "ngo",
  "cooperative",
  "church",
  "sports_club",
  "startup",
  "family",
  "fundraising",
];

// Categories defined by the Philippine mentor framework
const ORG_CATEGORIES = {
  institutional: {
    label: "Institutional",
    description: "Formally chartered, accredited, or statutory government & educational entities",
    types: ["student_org", "barangay", "cooperative", "homeowners_association", "ngo"],
  },
  community: {
    label: "Community",
    description: "Faith-based congregations, dioceses, and athletic / sports organizations",
    types: ["church", "sports_club"],
  },
  commercial_and_informal: {
    label: "Commercial & Informal",
    description: "Enterprises, startups, mutual aid, and household financial collectives",
    types: ["startup", "fundraising", "family"],
  },
};

// Steps after the application has been created. The organization type is chosen
// when the draft is created (POST /api/org-applications), i.e. "step 0".
const STEPS = [
  { key: "details", title: "Organization details", description: "Legal identity, location and purpose" },
  { key: "representative", title: "Your identity", description: "Who is registering this organization" },
  { key: "documents", title: "Documents", description: "Upload the evidence for your organization type" },
  { key: "governance", title: "Governance", description: "Approval rules and initial officers" },
  { key: "review", title: "Review & submit", description: "Confirm everything and send for verification" },
];
const STEP_KEYS = STEPS.map((s) => s.key);

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_OR_PDF_MIMES = [...IMAGE_MIMES, "application/pdf"];

// maxPerKind: how many files of this kind may be attached (1 = replace on re-upload)
const DOCUMENT_KINDS = {
  // ── Pillar 3: Signatory Identity (KYC) ──────────────────────────────────────
  rep_id_front: { label: "Valid Government or School ID (front)", mimes: IMAGE_MIMES, maxPerKind: 1, sensitive: true },
  rep_selfie_with_id: { label: "Selfie holding your ID", mimes: IMAGE_MIMES, maxPerKind: 1, sensitive: true },
  treasurer_id: { label: "Treasurer Government / Institutional ID", mimes: IMAGE_MIMES, maxPerKind: 1, sensitive: true },
  coach_id: { label: "Head Coach Valid ID", mimes: IMAGE_MIMES, maxPerKind: 1, sensitive: true },
  lead_organizer_second_id: { label: "Lead Organizer Secondary Government ID", mimes: IMAGE_MIMES, maxPerKind: 1, sensitive: true },

  // ── Pillar 2: Signatory Authority / Resolutions ─────────────────────────────
  authorization_letter: { label: "Authorization letter / officer resolution", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  adviser_endorsement: { label: "Adviser Endorsement & Officer Resolution", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  sangguniang_resolution: { label: "Sangguniang Barangay Resolution", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  secretary_certificate_signatories: { label: "Secretary's Certificate of Signatories", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  hoa_resolution: { label: "HOA Board Resolution", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  pastoral_resolution: { label: "Pastoral Council / Finance Committee Resolution", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  board_resolution: { label: "Board resolution", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  fund_utilization_plan: { label: "Signed Fund Utilization Plan", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },

  // ── Pillar 1: Proof of Institutional Existence ──────────────────────────────
  osa_accreditation: { label: "OSA Certificate of Recognition (Office of Student Affairs)", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  school_accreditation: { label: "University / College Accreditation Certificate", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  cbl_calendar: { label: "Club Constitution & By-Laws (CBL) / Approved Calendar", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  dilg_oath: { label: "DILG Oath of Office / Certificate of Canvass", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  proof_of_office: { label: "Proof of office (proclamation / oath of office)", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  barangay_clearance: { label: "Barangay certification / clearance", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  dhsud_registration: { label: "DHSUD (HLURB) registration certificate", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  master_deed_plan: { label: "Subdivision Location Plan / Master Deed", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  sec_registration: { label: "SEC registration certificate", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  dti_registration: { label: "DTI business name registration", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  dti_sec_registration: { label: "DTI Certificate of Business Name or SEC Certificate", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  cda_registration: { label: "CDA registration certificate", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  articles_bylaws: { label: "Articles of incorporation / By-laws", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 3 },
  articles_cooperation: { label: "Articles of Cooperation & By-Laws", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 3 },
  cda_cgs: { label: "CDA Certificate of Good Standing (CGS)", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  bir_registration: { label: "BIR Certificate of Registration (2303)", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  bir_form_2303: { label: "BIR Form 2303 Certificate of Registration", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  pcnc_afs: { label: "Audited Financial Statements (AFS) / PCNC Accreditation", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  business_permit: { label: "Business / mayor's permit", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  church_charter: { label: "SEC Religious Society Registration or Diocesan Charter", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  religious_affiliation: { label: "Denominational affiliation letter", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  league_endorsement: { label: "League / Sports Federation Endorsement", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  league_accreditation: { label: "League / federation accreditation", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  club_charter_roster: { label: "Club Charter & Official Roster", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  campaign_need_cause: { label: "Proof of Campaign Need / Cause (Medical / Calamity)", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 3 },
  dswd_permit: { label: "DSWD Public Solicitation Permit", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  utility_billing: { label: "Proof of Shared Residence / Utility Billing", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 2 },
  purpose_evidence: { label: "Evidence of purpose (e.g. medical, event or project document)", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 3 },
  beneficiary_proof: { label: "Beneficiary proof", mimes: IMAGE_OR_PDF_MIMES, maxPerKind: 3 },
};

const MAX_DOCUMENTS_PER_APPLICATION = 20;

/**
 * Per-type profile.
 *  - tier:               "standard" | "light" (light = family / fundraising, lower limits later)
 *  - registrationRequired / registrationLabel: legal registration number
 *  - emailDomainSuffixes: contact email must end with one of these (empty = no rule)
 *  - extraFields:        additional type-specific text fields (stored in basics.extras)
 *  - documentGroups:     each group is satisfied when AT LEAST ONE of its kinds is uploaded
 *  - requireAuthorizationLetter: false for single-person (light) applications
 */
const TYPE_PROFILES = {
  // ── Institutional (5) ────────────────────────────────────────────────────────
  student_org: {
    label: "Student Organization",
    category: "institutional",
    governingBody: "Office of Student Affairs (OSA) / Student Welfare Directorate",
    tier: "standard",
    registrationRequired: false,
    registrationLabel: "OSA Accreditation Number (if issued)",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "schoolName", label: "University / College Name", type: "text", required: true, min: 2, max: 150 },
      { key: "adviserName", label: "Faculty Adviser Full Name", type: "text", required: true, min: 2, max: 120 },
      { key: "adviserEmail", label: "Faculty Adviser Institutional Email", type: "email", required: true, max: 200 },
      { key: "osaAccreditationNumber", label: "OSA Accreditation Number", type: "text", required: false, min: 2, max: 100 },
    ],
    documentGroups: [
      { id: "accreditation", label: "University Recognition or Accreditation", kinds: ["osa_accreditation", "school_accreditation"] },
    ],
    requireAuthorizationLetter: true,
  },
  barangay: {
    label: "Barangay / SK Public Fund",
    category: "institutional",
    governingBody: "Department of the Interior and Local Government (DILG) / COMELEC",
    tier: "standard",
    registrationRequired: false,
    registrationLabel: "DILG LGU Code (PSGC), if known",
    emailDomainSuffixes: [".gov.ph"],
    extraFields: [
      { key: "municipalityCity", label: "Municipality / City & Province", type: "text", required: false, min: 2, max: 150 },
      { key: "punongBarangayOrSkChair", label: "Punong Barangay / SK Chair Name", type: "text", required: false, min: 2, max: 120 },
      { key: "officialLguEmail", label: "Official LGU Email (.gov.ph)", type: "email", required: false, max: 200 },
      { key: "dilgLguCode", label: "DILG LGU Code", type: "text", required: false, min: 2, max: 64 },
    ],
    documentGroups: [
      { id: "office", label: "DILG Oath of Office / Certificate of Canvass", kinds: ["dilg_oath", "proof_of_office"] },
      { id: "certification", label: "Sangguniang Barangay Resolution", kinds: ["sangguniang_resolution", "barangay_clearance", "board_resolution"] },
    ],
    requireAuthorizationLetter: true,
  },
  homeowners_association: {
    label: "Homeowners Association (HOA)",
    category: "institutional",
    governingBody: "Department of Human Settlements and Urban Development (DHSUD) / HLURB",
    tier: "standard",
    registrationRequired: true,
    registrationLabel: "DHSUD / HLURB Registration Number",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "subdivisionCondoName", label: "Subdivision / Condominium Property Name", type: "text", required: false, min: 2, max: 150 },
      { key: "dhsudRegistrationNumber", label: "DHSUD Registration Number", type: "text", required: false, min: 2, max: 64 },
      { key: "hoaPresidentName", label: "HOA President Full Name", type: "text", required: false, min: 2, max: 120 },
    ],
    documentGroups: [
      { id: "registration", label: "DHSUD Registration Certificate", kinds: ["dhsud_registration"] },
      { id: "resolution", label: "HOA Board Resolution", kinds: ["hoa_resolution", "board_resolution"] },
    ],
    requireAuthorizationLetter: true,
  },
  ngo: {
    label: "NGO / Foundation",
    category: "institutional",
    governingBody: "Securities and Exchange Commission (SEC) / Bureau of Internal Revenue (BIR)",
    tier: "standard",
    registrationRequired: true,
    registrationLabel: "SEC Registration Number",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "foundationLegalName", label: "Registered Foundation Legal Name", type: "text", required: false, min: 2, max: 200 },
      { key: "secRegistrationNumber", label: "SEC Registration Number", type: "text", required: false, min: 2, max: 64 },
      { key: "executiveDirectorName", label: "Executive Director / Managing Trustee Name", type: "text", required: false, min: 2, max: 120 },
    ],
    documentGroups: [
      { id: "registration", label: "SEC Registration Certificate (Non-Stock, Non-Profit)", kinds: ["sec_registration"] },
      { id: "bylaws", label: "Articles of Incorporation / By-Laws", kinds: ["articles_bylaws", "articles_cooperation"] },
      { id: "tax", label: "BIR Form 2303 Registration / Tax Exemption", kinds: ["bir_form_2303", "bir_registration"] },
    ],
    requireAuthorizationLetter: true,
  },
  cooperative: {
    label: "Cooperative",
    category: "institutional",
    governingBody: "Cooperative Development Authority (CDA)",
    tier: "standard",
    registrationRequired: true,
    registrationLabel: "CDA Registration Number (CIN)",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "cooperativeLegalName", label: "Cooperative Legal Registered Name", type: "text", required: false, min: 2, max: 200 },
      { key: "cooperativeIdNumber", label: "Cooperative Identification Number (CIN)", type: "text", required: false, min: 2, max: 64 },
      { key: "boardChairpersonName", label: "Board Chairperson Name", type: "text", required: false, min: 2, max: 120 },
    ],
    documentGroups: [
      { id: "registration", label: "CDA Certificate of Registration", kinds: ["cda_registration"] },
      { id: "bylaws", label: "Articles of Cooperation & By-Laws", kinds: ["articles_cooperation", "articles_bylaws"] },
      { id: "resolution", label: "Secretary's Certificate of Signatories", kinds: ["secretary_certificate_signatories", "board_resolution"] },
    ],
    requireAuthorizationLetter: true,
  },

  // ── Community (2) ────────────────────────────────────────────────────────────
  church: {
    label: "Church / Religious Organization",
    category: "community",
    governingBody: "SEC (Corporation Sole) or Diocesan / Denominational Headquarters",
    tier: "standard",
    registrationRequired: false,
    registrationLabel: "SEC Registration Number (if any)",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "parishMinistryName", label: "Parish / Ministry Name", type: "text", required: false, min: 2, max: 150 },
      { key: "leadPastorPriestName", label: "Lead Pastor / Priest Name", type: "text", required: false, min: 2, max: 120 },
      { key: "denominationAffiliationId", label: "Diocese / Denomination Affiliation ID", type: "text", required: false, min: 2, max: 100 },
    ],
    documentGroups: [
      { id: "registration", label: "SEC Religious Society Registration or Diocesan Charter", kinds: ["church_charter", "sec_registration", "religious_affiliation"] },
    ],
    requireAuthorizationLetter: true,
  },
  sports_club: {
    label: "Sports Club / Athletic Team",
    category: "community",
    governingBody: "Host University / LGU Sports Office / National Sports Association (NSA) / League",
    tier: "standard",
    registrationRequired: false,
    registrationLabel: "League Franchise / Team Registration Number (if any)",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "parentLeagueBanner", label: "Parent League / Host Banner Name", type: "text", required: false, min: 2, max: 150 },
      { key: "teamManagerName", label: "Team Manager Full Name", type: "text", required: false, min: 2, max: 120 },
      { key: "leagueFranchiseNumber", label: "League Franchise / Team Registration Number", type: "text", required: false, min: 2, max: 64 },
    ],
    documentGroups: [
      {
        id: "accreditation",
        label: "League Endorsement, Accreditation or Charter",
        kinds: ["league_endorsement", "league_accreditation", "club_charter_roster", "sec_registration", "dti_registration", "articles_bylaws"],
      },
    ],
    requireAuthorizationLetter: true,
  },

  // ── Commercial & Informal (3) ────────────────────────────────────────────────
  startup: {
    label: "Startup / Micro-Enterprise",
    category: "commercial_and_informal",
    governingBody: "Department of Trade and Industry (DTI) or SEC + Local City Hall",
    tier: "standard",
    registrationRequired: true,
    registrationLabel: "DTI BNRN or SEC Registration Number",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "registeredBusinessName", label: "Registered Business Legal Name", type: "text", required: false, min: 2, max: 200 },
      { key: "dtiOrSecNumber", label: "DTI BNRN or SEC Number", type: "text", required: false, min: 2, max: 64 },
      { key: "founderCeoName", label: "Founder / CEO Full Name", type: "text", required: false, min: 2, max: 120 },
    ],
    documentGroups: [
      { id: "registration", label: "DTI Business Name or SEC Registration", kinds: ["dti_sec_registration", "sec_registration", "dti_registration"] },
      { id: "tax", label: "BIR Form 2303 Certificate of Registration", kinds: ["bir_form_2303", "bir_registration"] },
      { id: "permit", label: "Current Mayor's / Business Permit", kinds: ["business_permit"] },
    ],
    requireAuthorizationLetter: true,
  },
  family: {
    label: "Family & Household Treasury",
    category: "commercial_and_informal",
    governingBody: "Private / Civil identity verification",
    tier: "light",
    registrationRequired: false,
    registrationLabel: "Household Reference (if any)",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "householdAlias", label: "Family / Household Alias", type: "text", required: false, min: 2, max: 120 },
      { key: "headOfHouseholdName", label: "Head of Household Full Name", type: "text", required: false, min: 2, max: 120 },
      { key: "residenceAddress", label: "Residence Address", type: "text", required: false, min: 3, max: 200 },
    ],
    documentGroups: [
      { id: "purpose", label: "Proof of Shared Residence / Utility Billing", kinds: ["utility_billing", "purpose_evidence"] },
    ],
    requireAuthorizationLetter: false,
  },
  fundraising: {
    label: "Community Fundraising Campaign",
    category: "commercial_and_informal",
    governingBody: "DSWD (for public solicitation) or Local Barangay / Hospital",
    tier: "light",
    registrationRequired: false,
    registrationLabel: "Permit / Calamity Reference (if any)",
    emailDomainSuffixes: [],
    extraFields: [
      { key: "beneficiaryName", label: "Beneficiary / Cause", type: "text", required: true, min: 2, max: 200 },
      { key: "campaignCauseBeneficiary", label: "Campaign Cause / Beneficiary Name", type: "text", required: false, min: 2, max: 200 },
      { key: "leadOrganizerName", label: "Lead Organizer Full Name", type: "text", required: false, min: 2, max: 120 },
      { key: "organizerContact", label: "Lead Organizer Contact Details", type: "text", required: false, min: 2, max: 120 },
    ],
    documentGroups: [
      { id: "purpose", label: "Proof of Campaign Need / Cause", kinds: ["campaign_need_cause", "purpose_evidence"] },
    ],
    requireAuthorizationLetter: false,
  },
};

const ID_TYPES = [
  { value: "philsys", label: "PhilSys National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
  { value: "umid", label: "UMID" },
  { value: "voters_id", label: "Voter's ID" },
  { value: "prc", label: "PRC ID" },
  { value: "postal_id", label: "Postal ID" },
  { value: "school_id", label: "School ID" },
  { value: "other", label: "Other government ID" },
];
const ID_TYPE_VALUES = ID_TYPES.map((t) => t.value);

function getOfficerRolesForType(type) {
  if (type === "family") {
    return [
      { level: 1, label: "Co-Head / Primary Signer" },
      { level: 2, label: "Household Budget Manager" },
      { level: 3, label: "Family Member" },
    ];
  }
  if (type === "fundraising") {
    return [
      { level: 1, label: "Lead Campaign Trustee" },
      { level: 2, label: "Disbursement Officer" },
      { level: 3, label: "Campaign Contributor" },
    ];
  }
  return [
    { level: 1, label: "Executive Approver" },
    { level: 2, label: "Finance Officer" },
    { level: 3, label: "Member" },
  ];
}

const GOVERNANCE_LIMITS = {
  minRequiredApprovals: 1,
  maxRequiredApprovals: 10,
  maxOfficers: 20,
  defaultRequiredApprovals: 2,
  defaultHighValueThreshold: 10000,
  officerRoles: [
    { level: 1, label: "Executive Approver" },
    { level: 2, label: "Finance Officer" },
    { level: 3, label: "Member" },
  ],
};

const CONSENT_KEYS = ["acceptTerms", "acceptPrivacy", "acceptAccuracy"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidType(type) {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(TYPE_PROFILES, type);
}

function isValidStep(step) {
  return STEP_KEYS.includes(step);
}

/** Document groups for a type, including the groups common to every organization. */
function getDocumentGroups(type) {
  const profile = TYPE_PROFILES[type];
  if (!profile) return [];
  const common = [
    { id: "rep_id", label: DOCUMENT_KINDS.rep_id_front.label, kinds: ["rep_id_front"], common: true },
    { id: "rep_selfie", label: DOCUMENT_KINDS.rep_selfie_with_id.label, kinds: ["rep_selfie_with_id"], common: true },
  ];
  if (profile.requireAuthorizationLetter) {
    common.push({
      id: "authorization",
      label: DOCUMENT_KINDS.authorization_letter.label,
      kinds: ["authorization_letter"],
      common: true,
    });
  }
  return [...common, ...profile.documentGroups];
}

/** All document kinds that may be attached for a type (required groups + optional extras). */
function getAllowedDocumentKinds(type) {
  const kinds = new Set();
  for (const g of getDocumentGroups(type)) g.kinds.forEach((k) => kinds.add(k));
  if (type === "fundraising") kinds.add("beneficiary_proof");
  // Optional supporting documents any standard org may attach
  if (TYPE_PROFILES[type] && TYPE_PROFILES[type].tier === "standard") kinds.add("authorization_letter");
  return [...kinds];
}

/**
 * Evaluates which document groups are satisfied.
 * @param {string} type
 * @param {Array<{kind:string}>} documents
 * @returns {{complete:boolean, groups:Array, missing:Array}}
 */
function evaluateDocuments(type, documents) {
  const present = new Set((documents || []).map((d) => d.kind));
  const groups = getDocumentGroups(type).map((g) => ({
    id: g.id,
    label: g.label,
    kinds: g.kinds,
    satisfied: g.kinds.some((k) => present.has(k)),
  }));
  const missing = groups.filter((g) => !g.satisfied);
  return { complete: missing.length === 0, groups, missing };
}

/** Public, client-facing requirements payload for one type. */
function getRequirements(type) {
  const profile = TYPE_PROFILES[type];
  if (!profile) return null;
  const groups = getDocumentGroups(type);
  const kindSet = new Set(getAllowedDocumentKinds(type));
  const kinds = {};
  for (const k of kindSet) {
    kinds[k] = {
      label: DOCUMENT_KINDS[k].label,
      mimes: DOCUMENT_KINDS[k].mimes,
      maxPerKind: DOCUMENT_KINDS[k].maxPerKind,
      sensitive: Boolean(DOCUMENT_KINDS[k].sensitive),
    };
  }
  return {
    version: REQUIREMENTS_VERSION,
    type,
    label: profile.label,
    category: profile.category || "institutional",
    governingBody: profile.governingBody || "",
    tier: profile.tier,
    steps: STEPS,
    details: {
      registrationRequired: profile.registrationRequired,
      registrationLabel: profile.registrationLabel,
      extraFields: profile.extraFields,
      missionMinLength: MISSION_MIN,
    },
    representative: {
      idTypes: ID_TYPES,
      emailDomainSuffixes: profile.emailDomainSuffixes,
    },
    documents: { groups, kinds, maxFileSizeBytes: 5 * 1024 * 1024, maxTotal: MAX_DOCUMENTS_PER_APPLICATION },
    governance: {
      ...GOVERNANCE_LIMITS,
      officerRoles: getOfficerRolesForType(type),
    },
    consents: CONSENT_KEYS,
  };
}

/** Lightweight list of all types for the "choose a type" screen. */
function listTypes() {
  return ORG_TYPES.map((type) => ({
    type,
    label: TYPE_PROFILES[type].label,
    category: TYPE_PROFILES[type].category || "institutional",
    governingBody: TYPE_PROFILES[type].governingBody || "",
    tier: TYPE_PROFILES[type].tier,
    registrationRequired: TYPE_PROFILES[type].registrationRequired,
    requiredDocumentCount: getDocumentGroups(type).length,
  }));
}

// ── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PH_PHONE_RE = /^(\+?63|0)9\d{9}$/;
const POSTAL_RE = /^\d{4}$/;
const REG_NO_RE = /^[A-Za-z0-9][A-Za-z0-9\-\/. ]{1,62}[A-Za-z0-9]$/;
const MISSION_MIN = 30;

function cleanStr(v) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function checkText(errors, key, value, { label, required = true, min = 1, max = 200 }) {
  const v = cleanStr(value);
  if (!v) {
    if (required) errors[key] = `${label} is required`;
    return "";
  }
  if (v.length < min) errors[key] = `${label} must be at least ${min} characters`;
  else if (v.length > max) errors[key] = `${label} must be at most ${max} characters`;
  return v;
}

function checkEmail(errors, key, value, { label, required = true }) {
  const v = cleanStr(value).toLowerCase();
  if (!v) {
    if (required) errors[key] = `${label} is required`;
    return "";
  }
  if (v.length > 200 || !EMAIL_RE.test(v)) errors[key] = `${label} must be a valid email address`;
  return v;
}

/** Collapses an email-like or name-like value into a comparison key. */
function normalizeKey(value) {
  return cleanStr(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function validateDetails(payload, profile) {
  const errors = {};
  const p = payload || {};
  const a = p.address || {};
  const value = {
    displayName: checkText(errors, "displayName", p.displayName, { label: "Organization name", min: 2, max: 120 }),
    legalName: checkText(errors, "legalName", p.legalName, { label: "Registered / legal name", min: 2, max: 200 }),
    registrationNumber: "",
    yearEstablished: null,
    mission: checkText(errors, "mission", p.mission, { label: "Mission statement", min: MISSION_MIN, max: 2000 }),
    intendedUse: checkText(errors, "intendedUse", p.intendedUse, { label: "Intended use of funds", min: 10, max: 1000 }),
    logoUrl: "",
    extras: {},
  };

  // Registration number
  const reg = cleanStr(p.registrationNumber);
  if (!reg) {
    if (profile.registrationRequired) errors.registrationNumber = `${profile.registrationLabel} is required`;
  } else if (!REG_NO_RE.test(reg)) {
    errors.registrationNumber = `${profile.registrationLabel} contains invalid characters`;
  } else {
    value.registrationNumber = reg;
  }

  // Year established
  const year = Number(p.yearEstablished);
  const thisYear = new Date().getFullYear();
  if (p.yearEstablished === undefined || p.yearEstablished === null || p.yearEstablished === "") {
    errors.yearEstablished = "Year established is required";
  } else if (!Number.isInteger(year) || year < 1900 || year > thisYear) {
    errors.yearEstablished = `Year established must be between 1900 and ${thisYear}`;
  } else {
    value.yearEstablished = year;
  }

  // Optional logo (public asset, so a URL or a small inline image is acceptable)
  const logo = typeof p.logoUrl === "string" ? p.logoUrl.trim() : "";
  if (logo) {
    const okUrl = /^https?:\/\/[^\s]{3,2000}$/i.test(logo);
    const okData = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo) && logo.length <= 2_200_000;
    if (okUrl || okData) value.logoUrl = logo;
    else errors.logoUrl = "Logo must be an http(s) URL or a small PNG/JPEG/WebP image";
  }

  // Address
  const address = {
    region: checkText(errors, "address.region", a.region, { label: "Region", max: 100 }),
    province: checkText(errors, "address.province", a.province, { label: "Province", max: 100 }),
    city: checkText(errors, "address.city", a.city, { label: "City / municipality", max: 100 }),
    barangay: checkText(errors, "address.barangay", a.barangay, { label: "Barangay", max: 100 }),
    street: checkText(errors, "address.street", a.street, { label: "Street address", min: 3, max: 200 }),
    postalCode: "",
  };
  const postal = cleanStr(a.postalCode);
  if (postal) {
    if (POSTAL_RE.test(postal)) address.postalCode = postal;
    else errors["address.postalCode"] = "Postal code must be 4 digits";
  }

  // Type-specific extra fields
  const extrasIn = p.extras || {};
  for (const f of profile.extraFields) {
    const key = `extras.${f.key}`;
    if (f.type === "email") {
      const v = checkEmail(errors, key, extrasIn[f.key], { label: f.label, required: f.required });
      if (v) value.extras[f.key] = v;
    } else {
      const v = checkText(errors, key, extrasIn[f.key], { label: f.label, required: f.required, min: f.min || 1, max: f.max || 200 });
      if (v) value.extras[f.key] = v;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, value: { basics: value, address } };
}

function validateRepresentative(payload, profile) {
  const errors = {};
  const p = payload || {};
  const rep = {
    fullName: checkText(errors, "fullName", p.fullName, { label: "Full name", min: 2, max: 150 }),
    position: checkText(errors, "position", p.position, { label: "Position / role in the organization", min: 2, max: 100 }),
    idType: "",
    idLast4: "",
  };

  if (!ID_TYPE_VALUES.includes(p.idType)) errors.idType = "Select a valid ID type";
  else rep.idType = p.idType;

  // The full ID number is never stored — only the last 4 characters.
  const idNumber = cleanStr(p.idNumber).replace(/[\s-]/g, "");
  if (!idNumber) errors.idNumber = "ID number is required";
  else if (idNumber.length < 4 || idNumber.length > 40 || !/^[A-Za-z0-9]+$/.test(idNumber)) {
    errors.idNumber = "ID number must be 4-40 letters or digits";
  } else {
    rep.idLast4 = idNumber.slice(-4).toUpperCase();
  }

  const email = checkEmail(errors, "email", p.email, { label: "Official contact email" });
  if (email && profile.emailDomainSuffixes.length > 0) {
    const ok = profile.emailDomainSuffixes.some((s) => email.endsWith(s));
    if (!ok) errors.email = `Official email must end with ${profile.emailDomainSuffixes.join(" or ")}`;
  }

  let phone = "";
  const rawPhone = cleanStr(p.phone).replace(/[\s-]/g, "");
  if (rawPhone) {
    if (PH_PHONE_RE.test(rawPhone)) phone = rawPhone;
    else errors.phone = "Phone must be a valid PH mobile number (e.g. 09171234567)";
  }

  if (p.authorizedConfirmed !== true) {
    errors.authorizedConfirmed = "You must confirm you are authorized to register this organization";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { representative: rep, contact: { email, phone } },
  };
}

function validateGovernance(payload, ctx = {}) {
  const errors = {};
  const p = payload || {};
  const L = GOVERNANCE_LIMITS;

  const approvalsRaw = p.requiredApprovals === undefined ? L.defaultRequiredApprovals : Number(p.requiredApprovals);
  let requiredApprovals = L.defaultRequiredApprovals;
  if (!Number.isInteger(approvalsRaw) || approvalsRaw < L.minRequiredApprovals || approvalsRaw > L.maxRequiredApprovals) {
    errors.requiredApprovals = `Required approvals must be a whole number between ${L.minRequiredApprovals} and ${L.maxRequiredApprovals}`;
  } else {
    requiredApprovals = approvalsRaw;
  }

  const thresholdRaw = p.highValueThreshold === undefined ? L.defaultHighValueThreshold : Number(p.highValueThreshold);
  let highValueThreshold = L.defaultHighValueThreshold;
  if (!Number.isFinite(thresholdRaw) || thresholdRaw <= 0 || thresholdRaw > 1_000_000_000) {
    errors.highValueThreshold = "High-value threshold must be a positive number";
  } else {
    highValueThreshold = thresholdRaw;
  }

  const isPrivate = p.isPrivate === true || p.isPrivate === "true";

  // Officers (the founder is the first approver and is not listed here)
  const officersIn = Array.isArray(p.officers) ? p.officers : [];
  const officers = [];
  const seen = new Set();
  if (ctx.founderEmail) seen.add(String(ctx.founderEmail).toLowerCase());

  if (officersIn.length > L.maxOfficers) {
    errors.officers = `You can list at most ${L.maxOfficers} officers`;
  } else {
    officersIn.forEach((o, i) => {
      const prefix = `officers.${i}`;
      const oe = {};
      const name = checkText(oe, "name", o && o.name, { label: "Name", min: 2, max: 120 });
      const email = checkEmail(oe, "email", o && o.email, { label: "Email" });
      const roleLabel = checkText(oe, "roleLabel", o && o.roleLabel, { label: "Role", required: false, max: 80 });
      const level = o && o.roleLevel === undefined ? 2 : Number(o && o.roleLevel);
      if (![1, 2, 3].includes(level)) oe.roleLevel = "Role level must be 1, 2 or 3";
      if (email && seen.has(email)) oe.email = "Each officer needs a unique email (and cannot be you)";
      if (email) seen.add(email);
      for (const [k, msg] of Object.entries(oe)) errors[`${prefix}.${k}`] = msg;
      officers.push({ name, email, roleLabel, roleLevel: level });
    });
  }

  // The on-chain approver set must be able to reach the threshold: founder + officers >= required.
  if (!errors.officers && !errors.requiredApprovals && officers.length + 1 < requiredApprovals) {
    errors.officers = `Add at least ${requiredApprovals - 1} officer(s) so ${requiredApprovals} approvals can be reached`;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { governance: { requiredApprovals, highValueThreshold, isPrivate, officers } },
  };
}

function validateConsents(payload) {
  const errors = {};
  const p = payload || {};
  for (const key of CONSENT_KEYS) {
    if (p[key] !== true) errors[key] = "This confirmation is required";
  }
  return { ok: Object.keys(errors).length === 0, errors, value: {} };
}

/**
 * Validates one step payload.
 * @param {string} step
 * @param {object} payload
 * @param {{type:string, founderEmail?:string}} ctx
 */
function validateStep(step, payload, ctx) {
  const profile = TYPE_PROFILES[ctx.type];
  if (!profile) return { ok: false, errors: { type: "Unknown organization type" }, value: {} };
  switch (step) {
    case "details":
      return validateDetails(payload, profile);
    case "representative":
      return validateRepresentative(payload, profile);
    case "governance":
      return validateGovernance(payload, ctx);
    case "review":
      return validateConsents(payload);
    default:
      return { ok: false, errors: { step: "This step cannot be saved directly" }, value: {} };
  }
}

module.exports = {
  REQUIREMENTS_VERSION,
  ORG_TYPES,
  ORG_CATEGORIES,
  STEPS,
  STEP_KEYS,
  DOCUMENT_KINDS,
  MAX_DOCUMENTS_PER_APPLICATION,
  TYPE_PROFILES,
  ID_TYPES,
  GOVERNANCE_LIMITS,
  CONSENT_KEYS,
  isValidType,
  isValidStep,
  getDocumentGroups,
  getAllowedDocumentKinds,
  evaluateDocuments,
  getRequirements,
  listTypes,
  validateStep,
  normalizeKey,
  cleanStr,
};
