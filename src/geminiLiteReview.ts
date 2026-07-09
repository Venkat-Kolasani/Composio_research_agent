import { readJson, resolveFromRoot, writeJson } from "./fs.js";
import { loadDotEnv } from "./loadEnv.js";
import type { AppResearch, Summary } from "./types.js";

type GeminiReview = {
  generatedAt: string;
  status: "created" | "skipped_no_api_key" | "failed";
  model: string;
  docs: string[];
  review?: unknown;
  error?: string;
  note: string;
};

const docs = [
  "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite",
  "https://ai.google.dev/gemini-api/docs/pricing",
  "https://ai.google.dev/gemini-api/docs"
];

function extractJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return { rawText: trimmed };
    try {
      return JSON.parse(match[0]);
    } catch {
      return { rawText: trimmed };
    }
  }
}

function redactSecretFragments(value: string) {
  return value
    .replace(/ak_[^"\\\s,}]+/g, "[redacted Composio API key]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "AIza[redacted]");
}

async function createReview(): Promise<GeminiReview> {
  loadDotEnv();

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  if (!apiKey) {
    return {
      generatedAt: new Date().toISOString(),
      status: "skipped_no_api_key",
      model,
      docs,
      note:
        "GEMINI_API_KEY was not configured. Add it to .env to run the low-cost Gemini Flash-Lite review pass."
    };
  }

  const summary = await readJson<Summary>(resolveFromRoot("data", "summary.json"));
  const rows = await readJson<AppResearch[]>(resolveFromRoot("data", "research.json"));
  const lowConfidenceRows = rows
    .filter((row) => row.confidence === "low" || row.flags.length > 0)
    .slice(0, 20)
    .map((row) => ({
      app: row.app,
      category: row.category,
      verdict: row.buildability,
      access: row.credentialAccess,
      apiSurface: row.apiSurface,
      confidence: row.confidence,
      flags: row.flags,
      blocker: row.mainBlocker
    }));

  const prompt = {
    role: "Composio take-home reviewer",
    task:
      "Review this connector research submission summary. Return strict JSON with fields: overallReadiness, strongestSignals, remainingRisks, interviewTalkingPoints, and suggestedFollowUps. Be concise and concrete.",
    summary: {
      totalApps: summary.totalApps,
      byBuildability: summary.byBuildability,
      byCredentialAccess: summary.byCredentialAccess,
      composioCoverage: summary.composioCoverage,
      verification: summary.verification,
      topBlockers: summary.topBlockers
    },
    lowConfidenceRows
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(prompt) }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 1600
          }
        })
      }
    );

    const payload = (await response.json()) as any;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Gemini API returned HTTP ${response.status}`);
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join("\n") ?? "";
    return {
      generatedAt: new Date().toISOString(),
      status: "created",
      model,
      docs,
      review: extractJson(text),
      note:
        "Ran a low-cost Gemini Flash-Lite review pass over the generated summary and flagged rows. API key is not stored in the artifact."
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      status: "failed",
      model,
      docs,
      error: redactSecretFragments(error instanceof Error ? error.message : String(error)),
      note:
        "Gemini review failed in this environment. The failure is recorded so the submission remains transparent."
    };
  }
}

async function main() {
  const review = await createReview();
  await writeJson(resolveFromRoot("data", "run-logs", "gemini-review.json"), review);
  console.log(`Gemini review status: ${review.status} (${review.model})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
