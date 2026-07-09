import type { AppResearch, AppSeed, ResearchSeed } from "./types.js";
import { lookupComposioToolkit } from "./composioToolkitSeed.js";

export type AgentToolDefinition = {
  name: string;
  purpose: string;
  inputShape: string;
  outputShape: string;
};

export const agentToolManifest: AgentToolDefinition[] = [
  {
    name: "FIND_OFFICIAL_DOCS",
    purpose: "Locate official API, auth, MCP, and developer-portal URLs before considering secondary sources.",
    inputShape: "{ app, hint }",
    outputShape: "{ evidenceUrls, evidenceQuality }"
  },
  {
    name: "LOOKUP_COMPOSIO_TOOLKIT",
    purpose: "Check whether Composio already has a matching or adjacent toolkit opportunity.",
    inputShape: "{ app }",
    outputShape: "{ status, toolkitSlug?, note }"
  },
  {
    name: "CLASSIFY_CONNECTOR",
    purpose: "Convert evidence into auth, access, API surface, buildability, confidence, and blocker labels.",
    inputShape: "{ app, category, evidenceUrls, notes }",
    outputShape: "AppResearch"
  },
  {
    name: "VERIFY_EVIDENCE",
    purpose: "Challenge weak claims, missing docs, unsupported ready-now verdicts, and gated app assumptions.",
    inputShape: "AppResearch",
    outputShape: "{ verified, flags[] }"
  }
];

export function evidenceQuality(urls: string[]): AppResearch["evidenceQuality"] {
  if (urls.length === 0) return "weak";
  const officialDocCount = urls.filter((url) =>
    /(developer|developers|docs|api|reference|github\.com|shopify\.dev|stripe\.com\/docs|cloud\.google\.com)/i.test(url)
  ).length;
  if (officialDocCount === urls.length) return "official_docs";
  if (officialDocCount > 0) return "mixed";
  return "weak";
}

export function verifyEvidence(row: Pick<AppResearch, "evidenceUrls" | "buildability" | "credentialAccess" | "confidence" | "apiSurface">) {
  const flags: string[] = [];

  if (row.evidenceUrls.length === 0) flags.push("missing_evidence");
  if (evidenceQuality(row.evidenceUrls) === "weak") flags.push("weak_or_marketing_only_evidence");
  if (row.buildability === "ready_now" && row.confidence !== "high") flags.push("ready_now_without_high_confidence");
  if (row.buildability === "ready_now" && row.credentialAccess !== "self_serve") flags.push("ready_now_but_not_self_serve");
  if (row.apiSurface === "private_or_no_public_api" && row.buildability !== "not_buildable_today" && row.buildability !== "needs_outreach") {
    flags.push("private_api_but_buildable_verdict");
  }

  return { verified: flags.length === 0, flags };
}

export function classifyConnector(app: AppSeed, seed: ResearchSeed): AppResearch {
  const quality = evidenceQuality(seed.evidenceUrls);
  const verification = verifyEvidence(seed);

  return {
    ...app,
    ...seed,
    evidenceQuality: quality,
    composioToolkit: lookupComposioToolkit(app.app),
    humanReviewed: false,
    verified: verification.verified,
    flags: verification.flags
  };
}
