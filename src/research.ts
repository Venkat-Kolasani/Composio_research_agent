import { agentToolManifest, classifyConnector } from "./agentTools.js";
import { readJson, resolveFromRoot, writeJson } from "./fs.js";
import { assignmentApps } from "./appSeed.js";
import { researchSeeds } from "./researchSeed.js";
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
    const seed = researchSeeds[app.app];
    if (!seed) {
      throw new Error(`Missing research seed for ${app.id}: ${app.app}`);
    }
    return classifyConnector(app, seed);
  });

  const lowConfidence = rows.filter((row) => row.confidence === "low").map((row) => row.app);
  const runLog = {
    generatedAt: new Date().toISOString(),
    mode: "seeded_research_with_composio_ready_tool_manifest",
    agentTools: agentToolManifest,
    rowCount: rows.length,
    lowConfidence,
    note:
      "This deterministic run mirrors the intended agent contract. Add search/LLM keys to replace or refresh seeded evidence before production use."
  };

  await writeJson(resolveFromRoot("data", "research.json"), rows);
  await writeJson(resolveFromRoot("data", "run-logs", "research-run.json"), runLog);
  console.log(`Wrote ${rows.length} research rows to data/research.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
