import { readFile } from "node:fs/promises";
import { apiSurfaceLabels, accessLabels, buildabilityLabels } from "./labels.js";
import { readJson, resolveFromRoot, writeJson } from "./fs.js";
import type { AppResearch, Summary } from "./types.js";

type Check = {
  id: string;
  status: "pass" | "fail";
  detail: string;
};

const expectedCategories = [
  "CRM and Sales",
  "Support and Helpdesk",
  "Communications and Messaging",
  "Marketing, Ads, Email and Social",
  "Ecommerce",
  "Data, SEO and Scraping",
  "Developer, Infra and Data platforms",
  "Productivity and Project Management",
  "Finance and Fintech",
  "AI, Research and Media-native"
];

const publicFiles = [
  "README.md",
  "INTERVIEW_NOTES.md",
  "site/index.html",
  "data/run-logs/research-run.json"
];

function check(id: string, condition: boolean, detail: string): Check {
  return { id, status: condition ? "pass" : "fail", detail };
}

function unique<T>(values: T[]) {
  return new Set(values).size;
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

async function main() {
  const rows = await readJson<AppResearch[]>(resolveFromRoot("data", "research.json"));
  const summary = await readJson<Summary>(resolveFromRoot("data", "summary.json"));
  const verification = await readJson<{ auditRecords: unknown[]; issues: unknown[] }>(resolveFromRoot("data", "verification.json"));
  const html = await readFile(resolveFromRoot("site", "index.html"), "utf8");

  const categoryCounts = new Map<string, number>();
  for (const row of rows) {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
  }

  const checks: Check[] = [
    check("100_apps_present", rows.length === 100, `Expected 100 research rows, found ${rows.length}.`),
    check("unique_ids", unique(rows.map((row) => row.id)) === 100, "Every app id is unique."),
    check("unique_app_names", unique(rows.map((row) => row.app)) === 100, "Every app name is unique."),
    check(
      "ten_categories_present",
      expectedCategories.every((category) => categoryCounts.get(category) === 10),
      `Category counts: ${JSON.stringify(Object.fromEntries(categoryCounts), null, 0)}`
    ),
    check(
      "required_fields_complete",
      rows.every(
        (row) =>
          row.app &&
          row.category &&
          row.oneLineDescription &&
          row.authMethods.length > 0 &&
          row.credentialAccess &&
          row.apiSurface &&
          row.buildability &&
          row.mainBlocker &&
          row.confidence
      ),
      "Every row has category, description, auth, access, API surface, verdict, blocker, and confidence."
    ),
    check(
      "evidence_urls_present",
      rows.every((row) => row.evidenceUrls.length >= 1 && row.evidenceUrls.every(isHttpUrl)),
      "Every row has at least one valid HTTP(S) evidence URL."
    ),
    check(
      "unknown_auth_is_not_ready_now",
      rows.every((row) => !row.authMethods.includes("unknown") || row.buildability !== "ready_now"),
      "Rows with unknown auth are not marked ready_now."
    ),
    check(
      "private_api_not_ready_now",
      rows.every((row) => row.apiSurface !== "private_or_no_public_api" || row.buildability !== "ready_now"),
      "Private/no-public-API rows are not marked ready_now."
    ),
    check(
      "audit_sample_minimum",
      verification.auditRecords.length >= 20,
      `Human audit sample has ${verification.auditRecords.length} apps.`
    ),
    check(
      "summary_counts_match_rows",
      Object.values(summary.byBuildability).reduce((sum, value) => sum + value, 0) === rows.length,
      "Summary buildability counts add up to row count."
    ),
    check(
      "html_has_100_rows",
      countMatches(html, /data-verdict=/g) === 100,
      `Generated HTML has ${countMatches(html, /data-verdict=/g)} table rows.`
    ),
    check(
      "html_has_required_sections",
      ["Headline Findings", "Buildability Matrix", "Patterns", "Agent Workflow", "Verification", "100-App Research Table"].every((label) =>
        html.includes(label)
      ),
      "Generated page includes all assignment-critical sections."
    ),
    check(
      "html_has_all_verdict_labels",
      Object.values(buildabilityLabels).every((label) => html.includes(label)),
      "Generated page includes every buildability verdict label."
    ),
    check(
      "html_has_access_and_surface_labels",
      Object.values(accessLabels).every((label) => html.includes(label)) &&
        Object.values(apiSurfaceLabels).every((label) => html.includes(label)),
      "Generated page includes credential-access and API-surface labels."
    ),
    check(
      "composio_docs_present",
      html.includes("docs.composio.dev") || (await readFile(resolveFromRoot("README.md"), "utf8")).includes("docs.composio.dev"),
      "Composio SDK/MCP docs are referenced."
    )
  ];

  const publicText = (
    await Promise.all(publicFiles.map(async (file) => `${file}\n${await readFile(resolveFromRoot(file), "utf8")}`))
  ).join("\n");

  checks.push(
    check(
      "public_language_not_mock",
      !/\b(mock|fake|seeded|fallback data|demo data)\b/i.test(publicText),
      "Public docs/site avoid mock/fake/seeded/fallback-data wording."
    )
  );

  const report = {
    generatedAt: new Date().toISOString(),
    status: checks.every((item) => item.status === "pass") ? "pass" : "fail",
    checks
  };

  await writeJson(resolveFromRoot("data", "requirement-checks.json"), report);

  const failures = checks.filter((item) => item.status === "fail");
  if (failures.length > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(`Requirement checks passed (${checks.length}/${checks.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
