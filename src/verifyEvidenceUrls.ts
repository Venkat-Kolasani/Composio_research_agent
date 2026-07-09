import { readJson, resolveFromRoot, writeJson } from "./fs.js";
import type { AppResearch } from "./types.js";

type UrlCheck = {
  app: string;
  url: string;
  status: "reachable" | "blocked_or_auth" | "redirected" | "failed";
  httpStatus?: number;
  finalUrl?: string;
  error?: string;
};

const userAgent =
  "Mozilla/5.0 (compatible; ComposioResearchAgent/1.0; +https://github.com/Venkat-Kolasani/Composio_research_agent)";

async function fetchWithTimeout(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function classifyStatus(status: number, originalUrl: string, finalUrl: string): UrlCheck["status"] {
  if ([401, 403, 429].includes(status)) return "blocked_or_auth";
  if (status >= 200 && status < 300 && originalUrl !== finalUrl) return "redirected";
  if (status >= 200 && status < 400) return "reachable";
  return "failed";
}

async function checkUrl(app: string, url: string): Promise<UrlCheck> {
  try {
    let response = await fetchWithTimeout(url, "HEAD");
    if ([405, 403, 404].includes(response.status)) {
      response = await fetchWithTimeout(url, "GET");
    }

    return {
      app,
      url,
      status: classifyStatus(response.status, url, response.url),
      httpStatus: response.status,
      finalUrl: response.url
    };
  } catch (error) {
    return {
      app,
      url,
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index++;
      const current = items[currentIndex];
      results[currentIndex] = await worker(current);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  const rows = await readJson<AppResearch[]>(resolveFromRoot("data", "research.json"));
  const urls = rows.flatMap((row) => row.evidenceUrls.map((url) => ({ app: row.app, url })));
  const uniqueUrls = [...new Map(urls.map((item) => [`${item.app}|${item.url}`, item])).values()];
  const checks = await runPool(uniqueUrls, 8, (item) => checkUrl(item.app, item.url));
  const hardFailures = checks.filter((item) => item.status === "failed");

  const report = {
    generatedAt: new Date().toISOString(),
    totalEvidenceUrls: checks.length,
    reachableOrBlockedCount: checks.length - hardFailures.length,
    hardFailureCount: hardFailures.length,
    statusCounts: checks.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {}),
    note:
      "401/403/429 responses count as blocked_or_auth rather than failed because several official docs intentionally block bots or require browser/auth context.",
    checks
  };

  await writeJson(resolveFromRoot("data", "evidence-url-checks.json"), report);

  if (hardFailures.length > 0) {
    console.warn(`Evidence URL check completed with ${hardFailures.length} hard failures. See data/evidence-url-checks.json.`);
  } else {
    console.log(`Evidence URL check passed for ${checks.length} URLs.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
