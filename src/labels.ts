import type { ApiSurface, Buildability, CredentialAccess } from "./types.js";

export const buildabilityLabels: Record<Buildability, string> = {
  ready_now: "Ready now",
  ready_with_limits: "Ready with limits",
  needs_outreach: "Needs outreach",
  not_buildable_today: "Not buildable today"
};

export const accessLabels: Record<CredentialAccess, string> = {
  self_serve: "Self-serve",
  paid_or_admin_gated: "Paid/admin gated",
  partner_or_sales_gated: "Partner/sales gated",
  unclear: "Unclear"
};

export const apiSurfaceLabels: Record<ApiSurface, string> = {
  broad_public_api: "Broad public API",
  limited_public_api: "Limited public API",
  private_or_no_public_api: "Private/no public API",
  mcp_available: "MCP available"
};
