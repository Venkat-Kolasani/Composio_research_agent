# Project Walkthrough

## What Was Built

This project turns Composio's 100-app take-home list into an evidence-backed connector research system. It produces:

- A structured 100-row connector dataset.
- Category and buildability patterns.
- A Composio-aware toolkit coverage view.
- A verification report with human audit corrections.
- A single-page case study deployed on Vercel.

## Pipeline

1. `parse`
   - Reads the assignment markdown when available.
   - Produces `data/apps.json` with 100 normalized app inputs.

2. `research`
   - Uses `src/evidenceCatalog.ts` as the curated source-of-truth catalog.
   - Classifies each app by auth, credential access, API surface, buildability, blocker, confidence, MCP status, and evidence URLs.
   - Adds Composio toolkit status from `src/composioToolkitCatalog.ts`.

3. `verify`
   - Flags weak evidence, low confidence, ready-now claims without high confidence, private APIs marked too optimistically, and unclear credentials.
   - Stores a 20-app human audit sample in `data/verification.json`.

4. `verify:requirements`
   - Checks the assignment requirements directly: 100 apps, 10 categories, complete fields, evidence URLs, table rows, required page sections, Composio docs, and no placeholder-style public wording.

5. `verify:urls`
   - Fetches evidence URLs and writes `data/evidence-url-checks.json`.
   - Treats 401/403/429 as blocked/auth rather than hard failure because many official docs block bots.

6. `proof:mcp`
   - Creates a Composio hosted MCP proof artifact when `COMPOSIO_API_KEY` is present.
   - Writes a redacted result to `data/run-logs/mcp-proof.json`.

7. `review:gemini`
   - Uses `gemini-3.1-flash-lite` by default when `GEMINI_API_KEY` is configured.
   - Produces a low-cost independent review artifact in `data/run-logs/gemini-review.json`.

8. `build:site`
   - Generates `site/index.html` from the data artifacts.
   - The page is not hand-maintained, so the table and summary stay consistent.

## Interview Explanation

The strongest way to explain this:

> I built an ops research machine, not just a spreadsheet. The agent classifies 100 app connector opportunities, separates engineering-ready apps from access-gated apps, verifies weak claims, and publishes a case study that product, engineering, and partnerships can all use.

## Why This Fits Composio

- It models the same connector intake problem Composio described in the assignment.
- It distinguishes API existence from actual buildability.
- It uses Composio concepts: toolkits, custom tools, SDK sessions, and MCP.
- It is honest about human-in-the-loop work where approvals or private docs are involved.
