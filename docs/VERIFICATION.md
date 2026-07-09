# Verification Guide

## Assignment Requirement Mapping

| Requirement | Artifact |
| --- | --- |
| 100 apps researched | `data/research.json`, `site/index.html` |
| Category and one-line description | `data/research.json` |
| Auth methods | `data/research.json` |
| Self-serve vs gated | `credentialAccess` field |
| API surface and MCP status | `apiSurface`, `mcpStatus`, `composioToolkit` |
| Buildability verdict and blocker | `buildability`, `mainBlocker` |
| Evidence URL for each answer | `evidenceUrls` |
| Pattern analysis | `data/summary.json`, case-study sections |
| Agent/script/pipeline | `src/*.ts`, README commands |
| Verification loop | `data/verification.json`, `data/requirement-checks.json`, `data/evidence-url-checks.json` |
| Single HTML page | `site/index.html` |
| Source repo and README | GitHub repo and `README.md` |

## Verification Commands

```bash
npm run all
npm run verify:requirements
npm run verify:urls
npm run check
```

Or run everything:

```bash
npm run audit
```

## What The Checks Prove

- The dataset has exactly 100 apps.
- There are exactly 10 categories with 10 apps each.
- Every row has required fields.
- Every row has at least one HTTP(S) evidence URL.
- Rows with unknown auth are not marked `ready_now`.
- Private/no-public-API rows are not marked `ready_now`.
- The generated HTML contains 100 table rows and all required sections.
- Public docs/site avoid placeholder-style language.
- Evidence URLs are fetched and categorized as reachable, redirected, blocked/auth, or failed.

## Known Limits

- URL reachability does not prove the page content still says the same thing; it proves the cited source exists and is accessible or intentionally blocked.
- Some official docs block bots, which is why 401/403/429 are tracked separately.
- API access rules change frequently, especially ads, fintech, and enterprise platforms. Refresh before a real Composio build decision.
