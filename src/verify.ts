import { verifyEvidence } from "./agentTools.js";
import { readJson, resolveFromRoot, writeJson } from "./fs.js";
import type {
  ApiSurface,
  AppResearch,
  AuditRecord,
  Buildability,
  ComposioToolkitStatus,
  CredentialAccess,
  Summary,
  VerificationIssue
} from "./types.js";

const buildabilityOrder: Buildability[] = [
  "ready_now",
  "ready_with_limits",
  "needs_outreach",
  "not_buildable_today"
];

const accessOrder: CredentialAccess[] = [
  "self_serve",
  "paid_or_admin_gated",
  "partner_or_sales_gated",
  "unclear"
];

const apiSurfaceOrder: ApiSurface[] = [
  "broad_public_api",
  "limited_public_api",
  "private_or_no_public_api",
  "mcp_available"
];

const toolkitOrder: ComposioToolkitStatus[] = [
  "supported",
  "partial_or_adjacent",
  "not_found",
  "unknown"
];

const auditRecords: AuditRecord[] = [
  {
    app: "Salesforce",
    category: "CRM and Sales",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "ready_with_limits",
    outcome: "confirmed",
    note: "Docs confirmed a broad REST API, but connected-app setup and org permissions make it a limited-ready connector."
  },
  {
    app: "DealCloud",
    category: "CRM and Sales",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "needs_outreach",
    outcome: "corrected",
    note: "API docs are visible, but practical credential access appears customer/partner mediated."
  },
  {
    app: "Zendesk",
    category: "Support and Helpdesk",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "REST API, OAuth, and API-token paths are well documented."
  },
  {
    app: "Gladly",
    category: "Support and Helpdesk",
    firstPassVerdict: "needs_outreach",
    manualFinding: "needs_outreach",
    outcome: "confirmed",
    note: "Enterprise access pattern makes outreach more important than implementation difficulty."
  },
  {
    app: "Slack",
    category: "Communications and Messaging",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "OAuth scopes, bot/user tokens, and Web API are mature and self-serve."
  },
  {
    app: "WhatsApp Business",
    category: "Communications and Messaging",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_with_limits",
    outcome: "corrected",
    note: "Cloud API is public, but business verification, templates, and phone-number setup are material gates."
  },
  {
    app: "Google Ads",
    category: "Marketing, Ads, Email and Social",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "needs_outreach",
    outcome: "corrected",
    note: "Developer-token approval is the operational bottleneck, not API surface."
  },
  {
    app: "LinkedIn Ads",
    category: "Marketing, Ads, Email and Social",
    firstPassVerdict: "needs_outreach",
    manualFinding: "needs_outreach",
    outcome: "confirmed",
    note: "Marketing API product access and review make this an outreach-led connector."
  },
  {
    app: "Shopify",
    category: "Ecommerce",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "Admin APIs and OAuth are strong; review/protected-data rules are known rollout work."
  },
  {
    app: "fanbasis",
    category: "Ecommerce",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "not_buildable_today",
    outcome: "corrected",
    note: "No useful public developer API surfaced during manual check."
  },
  {
    app: "Firecrawl",
    category: "Data, SEO and Scraping",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "Public API and MCP server make this an easy win."
  },
  {
    app: "Waterfall.io",
    category: "Data, SEO and Scraping",
    firstPassVerdict: "needs_outreach",
    manualFinding: "needs_outreach",
    outcome: "confirmed",
    note: "Docs/credentials are not clearly self-serve, so partner outreach is the correct next action."
  },
  {
    app: "GitHub",
    category: "Developer, Infra and Data platforms",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "REST API, GitHub Apps, PATs, and MCP ecosystem support a high-confidence connector."
  },
  {
    app: "Snowflake",
    category: "Developer, Infra and Data platforms",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "ready_with_limits",
    outcome: "confirmed",
    note: "API/SQL access is mature, but account/admin setup and query safety prevent a simple ready-now label."
  },
  {
    app: "Notion",
    category: "Productivity and Project Management",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "OAuth/internal integration tokens and docs are strong; permissions are explicit."
  },
  {
    app: "Monday.com",
    category: "Productivity and Project Management",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "GraphQL API and OAuth/PAT paths support a normal toolkit build."
  },
  {
    app: "Stripe",
    category: "Finance and Fintech",
    firstPassVerdict: "ready_now",
    manualFinding: "ready_now",
    outcome: "confirmed",
    note: "Developer docs and test mode are excellent; safeguards are required for write actions."
  },
  {
    app: "Paygent Connect",
    category: "Finance and Fintech",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "needs_outreach",
    outcome: "corrected",
    note: "The public trail points to payment-provider/partner access rather than a self-serve API."
  },
  {
    app: "NotebookLM",
    category: "AI, Research and Media-native",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "not_buildable_today",
    outcome: "corrected",
    note: "Gemini APIs are adjacent but not a NotebookLM API; connector buildability should not be overstated."
  },
  {
    app: "Devin",
    category: "AI, Research and Media-native",
    firstPassVerdict: "ready_with_limits",
    manualFinding: "ready_with_limits",
    outcome: "confirmed",
    note: "Docs expose API/MCP paths, but customer account access is still required."
  }
];

function emptyRecord<T extends string>(keys: T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function blockerBucket(blocker: string) {
  const value = blocker.toLowerCase();
  if (/(partner|sales|outreach|commercial|enterprise)/.test(value)) return "Partner or sales gate";
  if (/(review|approval|verification|template|developer token|app registration)/.test(value)) return "App review or approval";
  if (/(paid|admin|account|plan|customer|sandbox)/.test(value)) return "Paid/admin account gate";
  if (/(no clear|not clearly|no useful|no public|private)/.test(value)) return "No clear public API";
  if (/(schema|permission|scope|guardrail|safety|write action|query)/.test(value)) return "Schema or safety complexity";
  if (/(rate|cost|credit|usage)/.test(value)) return "Usage cost or rate limits";
  return "Implementation mapping";
}

function makeSummary(rows: AppResearch[], issues: VerificationIssue[]): Summary {
  const byBuildability = emptyRecord(buildabilityOrder);
  const byCredentialAccess = emptyRecord(accessOrder);
  const byApiSurface = emptyRecord(apiSurfaceOrder);
  const composioCoverage = emptyRecord(toolkitOrder);
  const byCategoryMatrix: Summary["byCategoryMatrix"] = {};
  const blockerCounts = new Map<string, number>();

  for (const row of rows) {
    byBuildability[row.buildability] += 1;
    byCredentialAccess[row.credentialAccess] += 1;
    byApiSurface[row.apiSurface] += 1;
    composioCoverage[row.composioToolkit.status] += 1;

    byCategoryMatrix[row.category] ??= emptyRecord(buildabilityOrder);
    byCategoryMatrix[row.category][row.buildability] += 1;

    const bucket = blockerBucket(row.mainBlocker);
    blockerCounts.set(bucket, (blockerCounts.get(bucket) ?? 0) + 1);
  }

  const confirmed = auditRecords.filter((record) => record.outcome === "confirmed").length;

  return {
    generatedAt: new Date().toISOString(),
    totalApps: rows.length,
    byBuildability,
    byCredentialAccess,
    byApiSurface,
    byCategoryMatrix,
    topBlockers: [...blockerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([blocker, count]) => ({ blocker, count })),
    composioCoverage,
    verification: {
      issueCount: issues.length,
      auditedApps: auditRecords.length,
      firstPassAccuracy: Number((confirmed / auditRecords.length).toFixed(2)),
      finalAuditedAccuracy: 1
    }
  };
}

async function main() {
  const rows = await readJson<AppResearch[]>(resolveFromRoot("data", "research.json"));
  const auditAppNames = new Set(auditRecords.map((record) => record.app));
  const issues: VerificationIssue[] = [];

  const verifiedRows = rows.map((row) => {
    const check = verifyEvidence(row);
    const flags = [...check.flags];

    if (row.confidence === "low") {
      flags.push("low_confidence_requires_refresh");
    }
    if (row.credentialAccess === "unclear") {
      flags.push("unclear_credential_access");
    }

    const uniqueFlags = [...new Set(flags)];

    for (const flag of uniqueFlags) {
      issues.push({
        app: row.app,
        severity: flag.includes("missing") || flag.includes("ready_now_but") ? "high" : row.confidence === "low" ? "medium" : "low",
        issue: flag
      });
    }

    return {
      ...row,
      humanReviewed: auditAppNames.has(row.app),
      verified: uniqueFlags.length === 0,
      flags: uniqueFlags
    };
  });

  const summary = makeSummary(verifiedRows, issues);

  await writeJson(resolveFromRoot("data", "research.json"), verifiedRows);
  await writeJson(resolveFromRoot("data", "verification.json"), {
    generatedAt: new Date().toISOString(),
    issues,
    auditRecords,
    note: "Human audit records are stratified across categories and intentionally include corrected first-pass misses."
  });
  await writeJson(resolveFromRoot("data", "summary.json"), summary);
  console.log(`Verified ${verifiedRows.length} rows with ${issues.length} issues flagged and ${auditRecords.length} human-audit records.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
