# Composio Connector Research Agent

This repo is a runnable take-home submission for Composio's AI Product Ops Intern role. It researches 100 requested apps, classifies their connector buildability, verifies weak claims, and generates a single-page case study.

## What This Proves

- A repeatable agentic workflow for connector research across 100 apps.
- Composio-native design: SDK sessions, custom agent-callable tools, toolkit lookup, and a hosted MCP proof path.
- Verification discipline: evidence requirements, deterministic checks, low-confidence flags, and human audit records.
- A reviewer-friendly final artifact: `site/index.html`.

## Setup

```bash
npm install
cp .env.example .env
```

The pipeline can run without external API keys because it includes a deterministic seeded research fallback. Add `COMPOSIO_API_KEY` to run the real MCP proof script.

## Commands

```bash
npm run parse       # Parse the assignment app list into data/apps.json
npm run research    # Generate structured connector research rows
npm run verify      # Run deterministic verifier and produce audit/summary files
npm run build:site  # Build site/index.html from data artifacts
npm run proof:mcp   # Create a Composio hosted MCP proof artifact, if configured
npm run all         # Parse, research, verify, and build the site
npm run check       # Type-check scripts
```

## Output Files

- `data/apps.json`: normalized 100-app input set.
- `data/research.json`: structured connector research output.
- `data/verification.json`: verifier findings and human audit sample.
- `data/summary.json`: metrics used by the case study.
- `data/run-logs/mcp-proof.json`: redacted Composio MCP proof output.
- `site/index.html`: final single-page case study.

## Current Generated Results

- 100 apps researched across 10 categories.
- 57 apps classified as `ready_now`.
- 31 apps classified as `ready_with_limits`.
- 10 apps classified as `needs_outreach`.
- 2 apps classified as `not_buildable_today`.
- 20 apps in the human audit sample.
- First-pass audited accuracy: 70%; final audited accuracy after verification/correction: 100%.

## How To Read The Results

The page leads with the operational answer: which connectors are ready now, which need limited work, which require outreach, and which are not buildable today. The table keeps each claim tied to evidence. The verification section shows first-pass misses and corrected results so the accuracy story is visible rather than hand-waved.

## Composio Design Notes

The core project is a TypeScript research agent. It is designed to use Composio in two complementary ways:

- **SDK path:** custom agent-callable tools such as `FIND_OFFICIAL_DOCS`, `LOOKUP_COMPOSIO_TOOLKIT`, `CLASSIFY_CONNECTOR`, and `VERIFY_EVIDENCE`.
- **MCP path:** `npm run proof:mcp` creates a Composio session with `mcp: true`, connects with an MCP client, lists available tools, and writes a redacted proof artifact.

The scripts degrade gracefully when API keys are unavailable, which keeps the take-home reproducible for reviewers.

## Deployment

The project is configured for Vercel as a static deployment from the `site/` directory.

```bash
npm run all
npx vercel --prod
```

If Vercel auth is unavailable, `site/index.html` can be hosted through GitHub Pages or any static file host without code changes.
