export type OrgApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_info"
  | "approved"
  | "rejected"
  | "revoked";

export type StepKey = "details" | "representative" | "documents" | "governance" | "review";

export interface StepDefinition {
  key: StepKey;
  title: string;
  description: string;
}

export interface OrgTypeSummary {
  type: string;
  label: string;
  category?: "institutional" | "community" | "commercial_and_informal";
  governingBody?: string;
  tier: "standard" | "light";
  registrationRequired: boolean;
  requiredDocumentCount: number;
}

export interface ExtraFieldSpec {
  key: string;
  label: string;
  type: "text" | "email";
  required: boolean;
  min?: number;
  max?: number;
}

export interface DocumentGroupSpec {
  id: string;
  label: string;
  kinds: string[];
  common?: boolean;
  satisfied?: boolean;
}

export interface DocumentKindSpec {
  label: string;
  mimes: string[];
  maxPerKind: number;
  sensitive: boolean;
}

export interface OrgRequirements {
  version: string;
  type: string;
  label: string;
  category?: "institutional" | "community" | "commercial_and_informal";
  governingBody?: string;
  tier: "standard" | "light";
  steps: StepDefinition[];
  details: {
    registrationRequired: boolean;
    registrationLabel: string;
    extraFields: ExtraFieldSpec[];
    missionMinLength: number;
  };
  representative: {
    idTypes: Array<{ value: string; label: string }>;
    emailDomainSuffixes: string[];
  };
  documents: {
    groups: DocumentGroupSpec[];
    kinds: Record<string, DocumentKindSpec>;
    maxFileSizeBytes: number;
    maxTotal: number;
  };
  governance: {
    minRequiredApprovals: number;
    maxRequiredApprovals: number;
    maxOfficers: number;
    defaultRequiredApprovals: number;
    defaultHighValueThreshold: number;
    officerRoles: Array<{ level: number; label: string }>;
  };
  consents: string[];
}

export interface OrgApplicationDocument {
  id: string;
  kind: string;
  originalName?: string;
  mime: string;
  size: number;
  sha256: string;
  ipfsCid?: string | null;
  ipfsUrl?: string | null;
  uploadedAt: string;
  status: "pending" | "accepted" | "rejected";
  reviewerNote?: string;
}

export const PHILIPPINE_ORG_CATEGORIES = [
  {
    key: "institutional" as const,
    title: "Institutional (5)",
    badgeColor: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
    description: "Official school accreditations, government units, registered cooperatives, HOAs, and non-profit foundations.",
    types: ["student_org", "barangay", "cooperative", "homeowners_association", "ngo"],
  },
  {
    key: "community" as const,
    title: "Community (2)",
    badgeColor: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    description: "Parishes, diocesan ministries, religious fellowships, and competitive sports clubs.",
    types: ["church", "sports_club"],
  },
  {
    key: "commercial_and_informal" as const,
    title: "Commercial & Informal (3)",
    badgeColor: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    description: "Startups, sole proprietorships, public crowdfunding, and private family trusts.",
    types: ["startup", "fundraising", "family"],
  },
];

export interface OrgOfficer {
  name: string;
  email: string;
  roleLabel?: string;
  roleLevel: number;
}

export interface OrgApplicationView {
  id: string;
  status: OrgApplicationStatus;
  revision: number;
  requirementsVersion: string;
  type: string;
  tier?: "standard" | "light";
  currentStep: StepKey;
  completedSteps: StepKey[];
  basics: {
    type?: string;
    displayName?: string;
    legalName?: string;
    registrationNumber?: string;
    yearEstablished?: number;
    mission?: string;
    intendedUse?: string;
    logoUrl?: string;
    extras?: Record<string, string>;
  };
  address: {
    region?: string;
    province?: string;
    city?: string;
    barangay?: string;
    street?: string;
    postalCode?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    emailVerified: boolean;
  };
  representative: {
    fullName?: string;
    position?: string;
    idType?: string;
    idLast4?: string;
  };
  governance: {
    requiredApprovals?: number;
    highValueThreshold?: number;
    isPrivate?: boolean;
    officers?: OrgOfficer[];
  };
  documents: OrgApplicationDocument[];
  documentChecklist: DocumentGroupSpec[];
  consentsAccepted: boolean;
  review: {
    decision?: "approve" | "reject" | "needs_info";
    reviewedAt?: string;
    applicantMessage?: string;
  };
  anchor?: {
    status: string;
    txHash?: string;
    anchoredAt?: string;
  } | null;
  organization: string | null;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MyOrgApplicationSummary {
  id: string;
  type: string;
  displayName: string;
  status: OrgApplicationStatus;
  currentStep: StepKey;
  completedSteps: StepKey[];
  revision: number;
  applicantMessage?: string;
  organization: string | null;
  submittedAt?: string;
  updatedAt?: string;
}

export function isEditableStatus(status: OrgApplicationStatus): boolean {
  return status === "draft" || status === "needs_info";
}

export function formatStatusLabel(status: OrgApplicationStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted for Review";
    case "under_review":
      return "Under Review";
    case "needs_info":
      return "Action Required (Needs Info)";
    case "approved":
      return "Verified & Approved";
    case "rejected":
      return "Rejected";
    case "revoked":
      return "Verification Revoked";
    default:
      return status;
  }
}
