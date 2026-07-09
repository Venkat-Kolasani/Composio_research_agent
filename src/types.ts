export type CredentialAccess =
  | "self_serve"
  | "paid_or_admin_gated"
  | "partner_or_sales_gated"
  | "unclear";

export type ApiSurface =
  | "broad_public_api"
  | "limited_public_api"
  | "private_or_no_public_api"
  | "mcp_available";

export type Buildability =
  | "ready_now"
  | "ready_with_limits"
  | "needs_outreach"
  | "not_buildable_today";

export type Confidence = "high" | "medium" | "low";

export type ComposioToolkitStatus =
  | "supported"
  | "partial_or_adjacent"
  | "not_found"
  | "unknown";

export type AppSeed = {
  id: number;
  app: string;
  category: string;
  hint: string;
};

export type ResearchSeed = {
  oneLineDescription: string;
  authMethods: string[];
  credentialAccess: CredentialAccess;
  apiSurface: ApiSurface;
  buildability: Buildability;
  mainBlocker: string;
  evidenceUrls: string[];
  confidence: Confidence;
  mcpStatus?: "official_or_vendor_mcp" | "community_mcp_possible" | "none_found" | "not_applicable";
};

export type ComposioToolkitMatch = {
  status: ComposioToolkitStatus;
  toolkitSlug?: string;
  note: string;
};

export type AppResearch = AppSeed &
  ResearchSeed & {
    evidenceQuality: "official_docs" | "mixed" | "weak";
    composioToolkit: ComposioToolkitMatch;
    humanReviewed: boolean;
    verified: boolean;
    flags: string[];
  };

export type VerificationIssue = {
  app: string;
  severity: "high" | "medium" | "low";
  issue: string;
};

export type AuditRecord = {
  app: string;
  category: string;
  firstPassVerdict: Buildability;
  manualFinding: Buildability;
  outcome: "confirmed" | "corrected";
  note: string;
};

export type Summary = {
  generatedAt: string;
  totalApps: number;
  byBuildability: Record<Buildability, number>;
  byCredentialAccess: Record<CredentialAccess, number>;
  byApiSurface: Record<ApiSurface, number>;
  byCategoryMatrix: Record<string, Record<Buildability, number>>;
  topBlockers: Array<{ blocker: string; count: number }>;
  composioCoverage: Record<ComposioToolkitStatus, number>;
  verification: {
    issueCount: number;
    auditedApps: number;
    firstPassAccuracy: number;
    finalAuditedAccuracy: number;
  };
};
