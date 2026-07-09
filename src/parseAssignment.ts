import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assignmentApps } from "./appSeed.js";
import { resolveFromRoot, writeJson } from "./fs.js";
import type { AppSeed } from "./types.js";

const defaultAssignmentPath = path.join(
  resolveFromRoot(".."),
  "AI Product Ops Intern -The take-home assignment 26f83199632282e78dd4811e39a6b43e.md"
);

function cleanCell(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/`/g, "")
    .trim();
}

function parseMarkdownApps(markdown: string): AppSeed[] {
  const apps: AppSeed[] = [];
  let category = "";

  for (const line of markdown.split(/\r?\n/)) {
    const categoryMatch = line.match(/^###\s+\d+\.\s+(.+)$/);
    if (categoryMatch) {
      category = categoryMatch[1].trim();
      continue;
    }

    const rowMatch = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/);
    if (!rowMatch || !category) continue;
    if (rowMatch[1] === "#") continue;

    const id = Number(rowMatch[1]);
    if (!Number.isFinite(id)) continue;
    const app = cleanCell(rowMatch[2]);
    const hint = cleanCell(rowMatch[3]);
    if (!app || app === "App") continue;
    apps.push({ id, app, category, hint });
  }

  return apps.length === 100 ? apps : assignmentApps;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const assignmentPath = process.env.ASSIGNMENT_PATH ?? defaultAssignmentPath;
  const apps = (await fileExists(assignmentPath))
    ? parseMarkdownApps(await readFile(assignmentPath, "utf8"))
    : assignmentApps;

  if (apps.length !== 100) {
    throw new Error(`Expected 100 apps, got ${apps.length}`);
  }

  await writeJson(resolveFromRoot("data", "apps.json"), apps);
  console.log(`Parsed ${apps.length} apps into data/apps.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
