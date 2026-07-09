import { agentToolManifest, classifyConnector } from "./agentTools.js";
import { readJson, resolveFromRoot, writeJson } from "./fs.js";
import { assignmentApps } from "./appSeed.js";
import { evidenceCatalog } from "./evidenceCatalog.js";
import type { AppResearch, AppSeed } from "./types.js";

async function loadApps() {
  try {
    return await readJson<AppSeed[]>(resolveFromRoot("data", "apps.json"));
  } catch {
    return assignmentApps;
  }
}

async function main() {
  const apps = await loadApps();
  const rows: AppResearch[] = apps.map((app) => {
    const evidence = evidenceCatalog[app.app];
    if (!evidence) {
      throw new Error(`Missing evidence catalog entry for ${app.id}: ${app.app}`);
    }
    return classifyConnector(app, evidence);
  });

  const lowConfidence = rows.filter((row) => row.confidence === "low").map((row) => row.app);
  const runLog = {
    generatedAt: new Date().toISOString(),
    mode: "curated_evidence_catalog_with_composio_ready_tool_manifest",
    agentTools: agentToolManifest,
    rowCount: rows.length,
    lowConfidence,
    note:
      "Rows are generated from a curated evidence catalog with official docs URLs. Add search/LLM keys to refresh evidence before future production use."
  };

  await writeJson(resolveFromRoot("data", "research.json"), rows);
  await writeJson(resolveFromRoot("data", "run-logs", "research-run.json"), runLog);
  console.log(`Wrote ${rows.length} research rows to data/research.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
