import type { ComposioToolkitMatch } from "./types.js";

const supported = new Map<string, string>([
  ["salesforce", "salesforce"],
  ["hubspot", "hubspot"],
  ["pipedrive", "pipedrive"],
  ["attio", "attio"],
  ["podio", "podio"],
  ["zoho crm", "zoho-crm"],
  ["close", "close"],
  ["zendesk", "zendesk"],
  ["intercom", "intercom"],
  ["freshdesk", "freshdesk"],
  ["front", "front"],
  ["helpscout", "helpscout"],
  ["slack", "slack"],
  ["twilio", "twilio"],
  ["discord", "discord"],
  ["telegram", "telegram"],
  ["aircall", "aircall"],
  ["google ads", "googleads"],
  ["meta ads", "facebookads"],
  ["linkedin ads", "linkedin"],
  ["mailchimp", "mailchimp"],
  ["klaviyo", "klaviyo"],
  ["pinterest", "pinterest"],
  ["sendgrid", "sendgrid"],
  ["shopify", "shopify"],
  ["woocommerce", "woocommerce"],
  ["bigcommerce", "bigcommerce"],
  ["magento adobe commerce", "magento"],
  ["amazon selling partner", "amazon"],
  ["ahrefs", "ahrefs"],
  ["apify", "apify"],
  ["firecrawl", "firecrawl"],
  ["bright data", "brightdata"],
  ["github", "github"],
  ["vercel", "vercel"],
  ["netlify", "netlify"],
  ["cloudflare", "cloudflare"],
  ["supabase", "supabase"],
  ["mongodb atlas", "mongodb"],
  ["datadog", "datadog"],
  ["sentry", "sentry"],
  ["notion", "notion"],
  ["airtable", "airtable"],
  ["linear", "linear"],
  ["jira", "jira"],
  ["asana", "asana"],
  ["mondaycom", "monday"],
  ["clickup", "clickup"],
  ["coda", "coda"],
  ["smartsheet", "smartsheet"],
  ["stripe", "stripe"],
  ["quickbooks", "quickbooks"],
  ["xero", "xero"],
  ["brex", "brex"],
  ["ramp", "ramp"],
  ["reducto", "reducto"]
]);

const adjacent = new Map<string, string>([
  ["twenty", "Open-source CRM; adjacent to custom toolkit path."],
  ["dealcloud", "Enterprise CRM; likely custom toolkit/outreach candidate."],
  ["plain", "GraphQL support platform; custom toolkit candidate."],
  ["gorgias", "Ecommerce support platform; public API makes custom toolkit viable."],
  ["whatsapp business", "Meta WhatsApp Cloud API can be represented as custom toolkit."],
  ["lark larksuite", "Lark open platform can be represented as custom toolkit."],
  ["gohighlevel", "Public API makes custom toolkit viable."],
  ["threads meta", "Meta Threads API can be represented as custom toolkit."],
  ["dataforseo", "API-first product; custom toolkit straightforward."],
  ["mrscraper", "API-first scraping product; custom toolkit straightforward."],
  ["sherlock", "CLI/open-source tool; better as local tool than SaaS toolkit."],
  ["clay", "API/webhook surface suggests custom toolkit candidate."],
  ["neo4j", "Graph query/management split suggests custom toolkit candidate."],
  ["snowflake", "Data platform; custom toolkit needs query safety model."],
  ["plaid", "API exists but production approval is the main gate."],
  ["binance", "API exists but trading tools need strict guardrails."],
  ["devin", "MCP/API exists; custom toolkit depends on account access."],
  ["mermaid cli", "CLI tool; custom local skill/tool, not SaaS connector."],
  ["youtube transcript", "Single-purpose API; custom toolkit is small."]
]);

export function normalizeAppName(app: string) {
  return app
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function lookupComposioToolkit(app: string): ComposioToolkitMatch {
  const normalized = normalizeAppName(app);
  const compact = normalized.replace(/\s+/g, "");
  const slug = supported.get(normalized) ?? supported.get(compact);
  if (slug) {
    return {
      status: "supported",
      toolkitSlug: slug,
      note: "Present or strongly expected in Composio's broad toolkit catalog; verify action coverage before shipping."
    };
  }

  const adjacentNote = adjacent.get(normalized) ?? adjacent.get(compact);
  if (adjacentNote) {
    return {
      status: "partial_or_adjacent",
      note: adjacentNote
    };
  }

  return {
    status: "not_found",
    note: "No obvious toolkit match in the curated Composio coverage map; treat as a net-new or outreach candidate."
  };
}
