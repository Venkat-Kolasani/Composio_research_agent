# Data Methodology

## Classification Fields

- `authMethods`: OAuth2, API key, token, Basic, JWT, or special product-specific auth.
- `credentialAccess`: whether credentials are self-serve, paid/admin gated, partner/sales gated, or unclear.
- `apiSurface`: broad public API, limited public API, private/no public API, or MCP available.
- `buildability`: whether Composio could build an agent toolkit today.
- `mainBlocker`: the most important non-obvious blocker.
- `confidence`: confidence after evidence review.

## Buildability Rules

- `ready_now`: public docs, self-serve credentials, and broad enough API surface.
- `ready_with_limits`: buildable but blocked by plan/admin access, app review, limited API scope, or safety complexity.
- `needs_outreach`: API exists or likely exists, but practical access needs partner/sales/vendor approval.
- `not_buildable_today`: no useful public API path or the named product does not expose the requested surface.

## Evidence Rules

- Prefer official developer docs and API references.
- Product pages are allowed only when the right finding is “no public API found” or “access unclear.”
- Low-confidence rows are intentionally flagged instead of overclaimed.
- Gated APIs are treated as useful product-ops findings, not failures.

## Human Audit Sample

The 20-app audit sample intentionally spans all 10 categories and includes risky/gated apps:

- Mature self-serve APIs: GitHub, Stripe, Shopify, Notion, Slack.
- Enterprise or approval-heavy APIs: DealCloud, Google Ads, LinkedIn Ads, Snowflake.
- Ambiguous or weak-public-doc apps: fanbasis, Waterfall.io, NotebookLM, Paygent Connect.

This mirrors the real work: easy wins should move fast, while ambiguous apps become outreach tasks.
