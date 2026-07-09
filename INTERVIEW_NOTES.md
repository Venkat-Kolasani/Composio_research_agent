# Interview Notes

## 30-Second Pitch

I treated the assignment as an operations system, not a spreadsheet. The agent turns a 100-app request list into structured connector intelligence, then verifies the weak spots and publishes a case study a reviewer can skim quickly.

## Architecture Decisions

- **TypeScript:** closest fit for Composio SDK examples, Vercel deployment, and readable production-style automation.
- **Generated page:** the HTML page is built from JSON artifacts so the presentation cannot drift from the research data.
- **Composio SDK plus MCP:** the SDK is best for custom tools and execution hooks; MCP is best as a portable proof that the same session can expose hosted tools to MCP-native clients.
- **Seeded fallback:** external web/LLM access can be flaky in take-home review environments, so the pipeline has deterministic fallback data and records confidence instead of pretending everything was live.

## Where A Human Was Needed

- Resolving ambiguous access gates when docs say "contact sales", "partner", or "request access".
- Spot-checking apps with high operational risk: fintech, ads platforms, enterprise research APIs, and AI/media apps with weak public docs.
- Interpreting whether an API is broad enough for an agent toolkit versus a narrow single-purpose endpoint.

## Accuracy Story

The first pass is intentionally treated as untrusted. The verifier checks for missing evidence, unsupported verdicts, low-confidence classifications, unofficial evidence, and gated categories. The human audit sample records first-pass answer, manual correction, and final confidence. The final page reports misses as part of the proof.

## Known Limitations

- Some vendors change developer access and app-review rules frequently.
- "Existing MCP" is a fast-moving ecosystem; findings should be refreshed before engineering commits.
- A public API can exist but still be operationally blocked by partner review, admin access, or paid sandboxes.

## How I Would Extend This In Production

- Add scheduled re-checks for low-confidence and gated apps.
- Store evidence snapshots so changed docs are auditable.
- Connect Gmail/Linear/Notion through Composio to automatically chase approvals and update partner trackers.
- Add an OpenAPI detector that estimates tool count and MCP generation difficulty from specs.
