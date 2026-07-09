import { readFile } from "node:fs/promises";
import { agentToolManifest } from "./agentTools.js";
import { apiSurfaceLabels, accessLabels, buildabilityLabels } from "./labels.js";
import { readJson, resolveFromRoot, writeText } from "./fs.js";
import type { AppResearch, AuditRecord, Buildability, Summary } from "./types.js";

type VerificationFile = {
  auditRecords: AuditRecord[];
  issues: Array<{ app: string; severity: string; issue: string }>;
};

type RequirementReport = {
  status: "pass" | "fail";
  checks: Array<{ id: string; status: "pass" | "fail"; detail: string }>;
};

type EvidenceUrlReport = {
  totalEvidenceUrls: number;
  reachableOrBlockedCount: number;
  hardFailureCount: number;
  statusCounts: Record<string, number>;
};

const buildabilityOrder: Buildability[] = [
  "ready_now",
  "ready_with_limits",
  "needs_outreach",
  "not_buildable_today"
];

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pct(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

async function optionalText(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function optionalJson<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath);
  } catch {
    return null;
  }
}

function renderMetricCards(summary: Summary) {
  const cards = [
    ["Ready now", summary.byBuildability.ready_now, "Self-serve APIs that can become toolkits immediately."],
    ["Ready with limits", summary.byBuildability.ready_with_limits, "Buildable, but gated by admin setup, app review, scope limits, or account access."],
    ["Needs outreach", summary.byBuildability.needs_outreach, "API exists or likely exists, but access requires partner, sales, or approval work."],
    ["Not buildable today", summary.byBuildability.not_buildable_today, "No useful public API path for a reliable agent toolkit."]
  ];

  return cards
    .map(
      ([label, value, description]) => `
        <article class="metric">
          <strong>${value}</strong>
          <span>${label}</span>
          <p>${description}</p>
        </article>`
    )
    .join("");
}

function renderMatrix(summary: Summary) {
  const rows = Object.entries(summary.byCategoryMatrix)
    .map(([category, counts]) => {
      const total = buildabilityOrder.reduce((sum, key) => sum + counts[key], 0);
      const cells = buildabilityOrder
        .map((key) => {
          const count = counts[key];
          return `<td><span class="matrix-count">${count}</span><span class="bar"><i style="width:${pct(count, total)}"></i></span></td>`;
        })
        .join("");
      return `<tr><th>${escapeHtml(category)}</th>${cells}</tr>`;
    })
    .join("");

  return `
    <table class="matrix">
      <thead>
        <tr>
          <th>Category</th>
          ${buildabilityOrder.map((key) => `<th>${buildabilityLabels[key]}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderPatternBars(summary: Summary) {
  const maxBlocker = Math.max(...summary.topBlockers.map((item) => item.count));
  const blockerRows = summary.topBlockers
    .slice(0, 7)
    .map(
      (item) => `
        <li>
          <span>${escapeHtml(item.blocker)}</span>
          <strong>${item.count}</strong>
          <i style="width:${pct(item.count, maxBlocker)}"></i>
        </li>`
    )
    .join("");

  const accessMax = Math.max(...Object.values(summary.byCredentialAccess));
  const accessRows = Object.entries(summary.byCredentialAccess)
    .map(
      ([key, count]) => `
        <li>
          <span>${accessLabels[key as keyof typeof accessLabels]}</span>
          <strong>${count}</strong>
          <i style="width:${pct(count, accessMax)}"></i>
        </li>`
    )
    .join("");

  return `
    <div class="split">
      <section class="panel">
        <h3>Most Common Blockers</h3>
        <ul class="bars">${blockerRows}</ul>
      </section>
      <section class="panel">
        <h3>Credential Access Pattern</h3>
        <ul class="bars">${accessRows}</ul>
      </section>
    </div>`;
}

function renderDecisionLanes(summary: Summary) {
  const lanes = [
    {
      title: "Ship First",
      value: summary.byBuildability.ready_now,
      body: "Self-serve, broad APIs. Best candidates for immediate toolkit work.",
      className: "ready_now"
    },
    {
      title: "Build With Guardrails",
      value: summary.byBuildability.ready_with_limits,
      body: "Useful APIs with app review, admin setup, limited scope, or safety constraints.",
      className: "ready_with_limits"
    },
    {
      title: "Partner Ops Queue",
      value: summary.byBuildability.needs_outreach,
      body: "Access is the blocker. These need approvals, sales contacts, or vendor partnership motion.",
      className: "needs_outreach"
    },
    {
      title: "Defer",
      value: summary.byBuildability.not_buildable_today,
      body: "No reliable public API route for an agent toolkit today.",
      className: "not_buildable_today"
    }
  ];

  return `
    <div class="lane-grid">
      ${lanes
        .map(
          (lane) => `
            <article class="lane">
              <span class="pill ${lane.className}">${lane.title}</span>
              <strong>${lane.value}</strong>
              <p>${lane.body}</p>
            </article>`
        )
        .join("")}
    </div>`;
}

function renderQualityGates(requirements: RequirementReport | null, evidenceUrls: EvidenceUrlReport | null, verification: VerificationFile) {
  const requirementPassed = requirements?.checks.filter((item) => item.status === "pass").length ?? 0;
  const requirementTotal = requirements?.checks.length ?? 0;
  const requirementLabel = requirements ? `${requirementPassed}/${requirementTotal} checks passed` : "Run npm run verify:requirements";
  const evidenceLabel = evidenceUrls
    ? `${evidenceUrls.reachableOrBlockedCount}/${evidenceUrls.totalEvidenceUrls} evidence URLs reachable or intentionally blocked`
    : "Run npm run verify:urls";
  const issueLabel = `${verification.issues.length} verifier flags retained for review`;

  return `
    <div class="quality-grid">
      <article class="quality-card">
        <span>Assignment Readiness</span>
        <strong>${escapeHtml(requirementLabel)}</strong>
        <p>${requirements?.status === "pass" ? "Schema, required sections, table rows, and public language checks passed." : "Requirement report is pending or failing."}</p>
      </article>
      <article class="quality-card">
        <span>Evidence Health</span>
        <strong>${escapeHtml(evidenceLabel)}</strong>
        <p>${evidenceUrls ? `${evidenceUrls.hardFailureCount} hard URL failures recorded for follow-up.` : "URL reachability report is not generated yet."}</p>
      </article>
      <article class="quality-card">
        <span>Human Audit</span>
        <strong>${verification.auditRecords.length} apps sampled</strong>
        <p>Audit spans all 10 categories and includes ambiguous or gated vendors.</p>
      </article>
      <article class="quality-card">
        <span>Open Review Queue</span>
        <strong>${escapeHtml(issueLabel)}</strong>
        <p>Flags are visible so low-confidence rows become ops follow-ups, not hidden assumptions.</p>
      </article>
    </div>`;
}

function renderWorkflow() {
  const tools = agentToolManifest
    .map(
      (tool) => `
        <article>
          <b>${tool.name}</b>
          <span>${tool.purpose}</span>
        </article>`
    )
    .join("");

  return `
    <div class="workflow">
      <div class="workflow-step">Parse<br><span>100 apps</span></div>
      <div class="workflow-arrow"></div>
      <div class="workflow-step">Discover<br><span>official docs</span></div>
      <div class="workflow-arrow"></div>
      <div class="workflow-step">Extract<br><span>strict JSON</span></div>
      <div class="workflow-arrow"></div>
      <div class="workflow-step">Verify<br><span>flags + audit</span></div>
      <div class="workflow-arrow"></div>
      <div class="workflow-step">Publish<br><span>case study</span></div>
    </div>
    <div class="tool-grid">${tools}</div>`;
}

function renderAudit(auditRecords: AuditRecord[]) {
  return auditRecords
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(record.app)}</td>
          <td>${escapeHtml(record.category)}</td>
          <td><span class="pill muted">${buildabilityLabels[record.firstPassVerdict]}</span></td>
          <td><span class="pill ${record.outcome}">${buildabilityLabels[record.manualFinding]}</span></td>
          <td>${escapeHtml(record.note)}</td>
        </tr>`
    )
    .join("");
}

function renderResearchRows(rows: AppResearch[]) {
  return rows
    .map((row) => {
      const evidence = row.evidenceUrls
        .map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">source ${index + 1}</a>`)
        .join(" ");
      const flags = row.flags.length ? row.flags.join(", ") : "clean";
      return `
        <tr data-verdict="${row.buildability}" data-category="${escapeHtml(row.category)}" data-search="${escapeHtml(
          `${row.app} ${row.category} ${row.authMethods.join(" ")} ${row.mainBlocker} ${row.composioToolkit.status}`.toLowerCase()
        )}">
          <td>${row.id}</td>
          <td><b>${escapeHtml(row.app)}</b><small>${escapeHtml(row.oneLineDescription)}</small></td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.authMethods.join(", "))}</td>
          <td>${accessLabels[row.credentialAccess]}</td>
          <td>${apiSurfaceLabels[row.apiSurface]}</td>
          <td><span class="pill ${row.buildability}">${buildabilityLabels[row.buildability]}</span></td>
          <td>${escapeHtml(row.mainBlocker)}</td>
          <td>${escapeHtml(row.composioToolkit.status)}${row.composioToolkit.toolkitSlug ? `<small>${escapeHtml(row.composioToolkit.toolkitSlug)}</small>` : ""}</td>
          <td>${evidence}<small>${escapeHtml(flags)}</small></td>
        </tr>`;
    })
    .join("");
}

function renderFilterButtons() {
  return `
    <div class="table-controls">
      <input id="table-search" type="search" placeholder="Search app, category, auth, blocker..." aria-label="Search research table">
      <select id="category-filter" aria-label="Filter by category">
        <option value="all">All categories</option>
      </select>
      <div class="filters" aria-label="Research table filters">
        <button data-filter="all" class="active">All</button>
        ${buildabilityOrder.map((key) => `<button data-filter="${key}">${buildabilityLabels[key]}</button>`).join("")}
      </div>
    </div>`;
}

function renderHtml(
  rows: AppResearch[],
  summary: Summary,
  verification: VerificationFile,
  requirements: RequirementReport | null,
  evidenceUrls: EvidenceUrlReport | null,
  mcpProof: string
) {
  const easyWins = summary.byBuildability.ready_now;
  const gated = summary.byCredentialAccess.paid_or_admin_gated + summary.byCredentialAccess.partner_or_sales_gated;
  const firstPassPct = Math.round(summary.verification.firstPassAccuracy * 100);
  const finalPct = Math.round(summary.verification.finalAuditedAccuracy * 100);
  const generatedDate = new Date(summary.generatedAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Composio Connector Research Agent</title>
  <style>
    :root {
      --ink: #172019;
      --muted: #59635f;
      --line: #dce4dd;
      --bg: #f7f8f4;
      --paper: #ffffff;
      --paper-2: #fdfefb;
      --green: #1e7f5c;
      --blue: #2a62b7;
      --amber: #ae6f18;
      --red: #a13a38;
      --soft-green: #dff2e6;
      --soft-blue: #e1ecfb;
      --soft-amber: #f8ead0;
      --soft-red: #f3dddc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }
    header {
      min-height: 64vh;
      display: grid;
      align-items: end;
      padding: 56px max(24px, 6vw) 32px;
      background:
        linear-gradient(115deg, rgba(23,32,25,.94), rgba(23,32,25,.72)),
        radial-gradient(circle at 78% 22%, rgba(255,255,255,.3), transparent 22%),
        repeating-linear-gradient(90deg, rgba(255,255,255,.1) 0 1px, transparent 1px 92px),
        repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 72px),
        linear-gradient(135deg, #1e7f5c, #2a62b7 56%, #ae6f18);
      color: white;
    }
    .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-weight: 700; opacity: .82; }
    h1 {
      max-width: 960px;
      margin: 14px 0 18px;
      font-size: clamp(36px, 7vw, 86px);
      line-height: .98;
      letter-spacing: 0;
    }
    .hero-copy {
      max-width: 780px;
      color: rgba(255,255,255,.86);
      font-size: clamp(16px, 2vw, 21px);
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 30px;
    }
    .hero-meta span {
      border: 1px solid rgba(255,255,255,.24);
      padding: 8px 10px;
      background: rgba(255,255,255,.08);
    }
    main { padding: 28px max(18px, 5vw) 64px; }
    section { margin: 34px auto; max-width: 1220px; }
    h2 { font-size: 26px; margin: 0 0 14px; letter-spacing: 0; }
    h3 { margin: 0 0 12px; font-size: 16px; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: -58px;
      position: relative;
      z-index: 1;
    }
    .metric, .panel, .tool-grid article, .lane, .quality-card {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 12px 34px rgba(23,32,25,.06);
    }
    .metric { padding: 18px; min-height: 150px; }
    .metric strong { display: block; font-size: 42px; line-height: 1; }
    .metric span { display: block; margin-top: 8px; font-weight: 750; }
    .metric p { color: var(--muted); margin: 8px 0 0; }
    .lane-grid, .quality-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .lane, .quality-card { padding: 16px; min-height: 150px; }
    .lane strong, .quality-card strong {
      display: block;
      margin: 14px 0 8px;
      font-size: 30px;
      line-height: 1;
    }
    .lane p, .quality-card p { color: var(--muted); margin: 0; }
    .quality-card span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .insights {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 18px;
      align-items: start;
    }
    .lede {
      font-size: 18px;
      background: var(--paper);
      border-left: 4px solid var(--green);
      padding: 18px 20px;
      border-radius: 0 8px 8px 0;
    }
    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 14px;
    }
    .panel { padding: 16px; }
    .bars { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
    .bars li { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: 10px; align-items: center; position: relative; }
    .bars span, .bars strong { position: relative; z-index: 1; }
    .bars i {
      grid-column: 1 / -1;
      height: 8px;
      background: linear-gradient(90deg, var(--green), var(--blue));
      border-radius: 99px;
      display: block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--muted);
      background: #f1f4ef;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    tbody tr:nth-child(even) { background: var(--paper-2); }
    td small { display: block; color: var(--muted); margin-top: 4px; }
    .matrix th:first-child, .matrix td:first-child { width: 28%; }
    .matrix-count { font-weight: 800; margin-right: 8px; }
    .bar { display: inline-flex; width: 80px; height: 8px; background: #edf1ed; border-radius: 99px; overflow: hidden; }
    .bar i { display: block; background: var(--green); }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 4px 8px;
      border-radius: 999px;
      font-weight: 750;
      white-space: nowrap;
    }
    .ready_now, .confirmed { background: var(--soft-green); color: var(--green); }
    .ready_with_limits { background: var(--soft-blue); color: var(--blue); }
    .needs_outreach, .corrected { background: var(--soft-amber); color: var(--amber); }
    .not_buildable_today { background: var(--soft-red); color: var(--red); }
    .muted { background: #ecf0ec; color: var(--muted); }
    .workflow {
      display: grid;
      grid-template-columns: 1fr 28px 1fr 28px 1fr 28px 1fr 28px 1fr;
      gap: 8px;
      align-items: center;
      margin: 14px 0;
    }
    .workflow-step {
      background: var(--paper);
      border: 1px solid var(--line);
      padding: 14px;
      border-radius: 8px;
      font-weight: 800;
      min-height: 72px;
    }
    .workflow-step span { color: var(--muted); font-weight: 500; }
    .workflow-arrow { height: 2px; background: var(--green); position: relative; }
    .workflow-arrow:after {
      content: "";
      position: absolute;
      right: -1px;
      top: -4px;
      border: 5px solid transparent;
      border-left-color: var(--green);
    }
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .tool-grid article { padding: 14px; }
    .tool-grid b { display: block; margin-bottom: 6px; }
    .tool-grid span { color: var(--muted); }
    .table-controls {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(180px, 260px);
      gap: 10px;
      align-items: center;
      margin: 12px 0;
    }
    .table-controls input, .table-controls select {
      min-height: 40px;
      border: 1px solid var(--line);
      background: white;
      color: var(--ink);
      padding: 8px 10px;
      border-radius: 6px;
      font: inherit;
    }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; grid-column: 1 / -1; }
    .filters button {
      border: 1px solid var(--line);
      background: white;
      color: var(--ink);
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .filters button.active { background: var(--ink); color: white; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    .research-table { min-width: 1280px; }
    .research-table td:nth-child(2) { min-width: 260px; }
    .proof {
      white-space: pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      max-height: 220px;
      overflow: auto;
      background: #111812;
      color: #e8f1e9;
      padding: 14px;
      border-radius: 8px;
    }
    footer { max-width: 1220px; margin: 34px auto 0; color: var(--muted); }
    @media (max-width: 900px) {
      header { min-height: 58vh; padding-inline: 20px; }
      main { padding-inline: 14px; }
      .metrics, .insights, .split, .tool-grid, .lane-grid, .quality-grid, .table-controls { grid-template-columns: 1fr; }
      .metrics { margin-top: 0; }
      .workflow { grid-template-columns: 1fr; }
      .workflow-arrow { height: 22px; width: 2px; margin-left: 24px; }
      .workflow-arrow:after { top: auto; bottom: -8px; right: -4px; border-left-color: transparent; border-top-color: var(--green); }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="eyebrow">Composio Product Ops Take-Home</div>
      <h1>${easyWins} of 100 apps are agent-toolkit ready today.</h1>
      <p class="hero-copy">I built a repeatable connector research agent that classifies API access, auth, buildability, Composio coverage, and blockers, then verifies weak claims with repeatable checks, live source checks, and a human audit sample.</p>
      <div class="hero-meta">
        <span>${gated} apps gated by paid, admin, partner, or sales access</span>
        <span>${summary.verification.auditedApps} manually audited apps</span>
        <span>Accuracy moved from ${firstPassPct}% to ${finalPct}% on audited sample</span>
        <span>Generated ${escapeHtml(generatedDate)}</span>
      </div>
    </div>
  </header>

  <main>
    <section class="metrics">${renderMetricCards(summary)}</section>

    <section>
      <h2>Decision Lanes</h2>
      ${renderDecisionLanes(summary)}
    </section>

    <section class="insights">
      <div>
        <h2>Headline Findings</h2>
        <p class="lede">The easy wins are not random: productivity, developer infrastructure, communications, and mature ecommerce APIs dominate the ready-now bucket. The hard work clusters around ads platforms, enterprise data providers, financial products, and newer AI/media apps where the blocker is access approval more often than engineering complexity.</p>
      </div>
      <div class="panel">
        <h3>What Stands Out</h3>
        <p><b>OAuth/API-token patterns dominate.</b> Most mature SaaS apps can become agent tools once scopes, tenant routing, and write-action safety are modeled.</p>
        <p><b>Gating is the product-ops bottleneck.</b> App review, developer-token approval, partner access, and paid admin credentials decide shipping order.</p>
        <p><b>MCP is a signal, not the whole answer.</b> Existing MCP helps for GitHub, Vercel, Firecrawl, Notion, Linear, Otter, and Devin-style apps, but most connectors still need normal auth and API mapping.</p>
      </div>
    </section>

    <section>
      <h2>Buildability Matrix</h2>
      ${renderMatrix(summary)}
    </section>

    <section>
      <h2>Patterns</h2>
      ${renderPatternBars(summary)}
    </section>

    <section>
      <h2>Data Quality</h2>
      ${renderQualityGates(requirements, evidenceUrls, verification)}
    </section>

    <section>
      <h2>Agent Workflow</h2>
      ${renderWorkflow()}
      <p>The Composio path is explicit: SDK sessions host custom research tools, and <code>npm run proof:mcp</code> can create a hosted MCP session and write a redacted proof artifact when <code>COMPOSIO_API_KEY</code> is configured.</p>
      <div class="proof">${escapeHtml(mcpProof || "No MCP proof artifact generated yet. Run npm run proof:mcp with COMPOSIO_API_KEY to create data/run-logs/mcp-proof.json.")}</div>
    </section>

    <section>
      <h2>Verification</h2>
      <p>The agent's first pass is treated as suspicious by default. The verifier flags weak evidence and the human audit sample records corrected misses instead of hiding them.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>App</th><th>Category</th><th>First pass</th><th>Manual finding</th><th>What changed</th></tr></thead>
          <tbody>${renderAudit(verification.auditRecords)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>100-App Research Table</h2>
      ${renderFilterButtons()}
      <div class="table-wrap">
        <table class="research-table">
          <thead>
            <tr>
              <th>#</th><th>App</th><th>Category</th><th>Auth</th><th>Access</th><th>API Surface</th><th>Verdict</th><th>Main Blocker</th><th>Composio</th><th>Evidence</th>
            </tr>
          </thead>
          <tbody>${renderResearchRows(rows)}</tbody>
        </table>
      </div>
    </section>

    <footer>
      Source repo: <a href="https://github.com/Venkat-Kolasani/Composio_research_agent">github.com/Venkat-Kolasani/Composio_research_agent</a>. Refresh notes: rerun <code>npm run all</code> after updating evidence or adding live search/LLM keys.
    </footer>
  </main>

  <script>
    const buttons = Array.from(document.querySelectorAll("[data-filter]"));
    const rows = Array.from(document.querySelectorAll(".research-table tbody tr"));
    const search = document.querySelector("#table-search");
    const category = document.querySelector("#category-filter");
    const categories = Array.from(new Set(rows.map((row) => row.dataset.category))).sort();
    categories.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      category.appendChild(option);
    });
    let activeVerdict = "all";
    function applyFilters() {
      const query = (search.value || "").trim().toLowerCase();
      const activeCategory = category.value;
      rows.forEach((row) => {
        const verdictMatch = activeVerdict === "all" || row.dataset.verdict === activeVerdict;
        const categoryMatch = activeCategory === "all" || row.dataset.category === activeCategory;
        const searchMatch = !query || row.dataset.search.includes(query);
        row.style.display = verdictMatch && categoryMatch && searchMatch ? "" : "none";
      });
    }
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        activeVerdict = button.dataset.filter;
        buttons.forEach((item) => item.classList.toggle("active", item === button));
        applyFilters();
      });
    });
    search.addEventListener("input", applyFilters);
    category.addEventListener("change", applyFilters);
  </script>
</body>
</html>`;
}

async function main() {
  const rows = await readJson<AppResearch[]>(resolveFromRoot("data", "research.json"));
  const summary = await readJson<Summary>(resolveFromRoot("data", "summary.json"));
  const verification = await readJson<VerificationFile>(resolveFromRoot("data", "verification.json"));
  const requirements = await optionalJson<RequirementReport>(resolveFromRoot("data", "requirement-checks.json"));
  const evidenceUrls = await optionalJson<EvidenceUrlReport>(resolveFromRoot("data", "evidence-url-checks.json"));
  const mcpProof = await optionalText(resolveFromRoot("data", "run-logs", "mcp-proof.json"));
  const html = renderHtml(rows, summary, verification, requirements, evidenceUrls, mcpProof);
  await writeText(resolveFromRoot("site", "index.html"), html);
  console.log("Built site/index.html");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
