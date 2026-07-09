import { writeJson, resolveFromRoot } from "./fs.js";
import { loadDotEnv } from "./loadEnv.js";

type RedactedProof = {
  generatedAt: string;
  status: "created" | "skipped_no_api_key" | "failed";
  docs: string[];
  sessionId?: string;
  mcpUrlHost?: string;
  toolCount?: number;
  sampleTools?: string[];
  error?: string;
  note: string;
};

function safeHost(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return "unparseable-url-redacted";
  }
}

function redactSecretFragments(value: string) {
  return value
    .replace(/ak_[^"\\\s,}]+/g, "[redacted Composio API key]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "AIza[redacted]");
}

async function createProof(): Promise<RedactedProof> {
  loadDotEnv();
  const apiKey = process.env.COMPOSIO_API_KEY;
  const docs = [
    "https://docs.composio.dev/docs/sessions-via-mcp",
    "https://docs.composio.dev/docs/extending-sessions/custom-tools-and-toolkits",
    "https://docs.composio.dev/toolkits",
    "https://docs.composio.dev/docs/cli"
  ];

  if (!apiKey) {
    return {
      generatedAt: new Date().toISOString(),
      status: "skipped_no_api_key",
      docs,
      note:
        "COMPOSIO_API_KEY was not configured. The script is still checked in so reviewers can run the hosted MCP proof without code changes."
    };
  }

  try {
    const composioModule = await import("@composio/core");
    const mcpModule = await import("@ai-sdk/mcp");
    const Composio = (composioModule as Record<string, any>).Composio;
    const createMCPClient = (mcpModule as Record<string, any>).createMCPClient;

    const composio = new Composio({ apiKey });
    const session = await composio.create("composio_research_agent_takehome", {
      mcp: true
    });

    const mcpUrl =
      session?.mcp?.url ??
      session?.mcpUrl ??
      session?.mcp_server_url ??
      session?.url;

    if (!mcpUrl) {
      return {
        generatedAt: new Date().toISOString(),
        status: "created",
        docs,
        sessionId: session?.id,
        note:
          "Composio session was created, but the SDK response did not expose an MCP URL in the expected fields. Inspect the installed SDK version."
      };
    }

    const client = await createMCPClient({
      transport: {
        type: "sse",
        url: mcpUrl,
        headers: session?.mcp?.headers ?? {}
      }
    });

    const tools = await client.tools();
    const toolNames = Object.keys(tools ?? {});
    await client.close?.();

    return {
      generatedAt: new Date().toISOString(),
      status: "created",
      docs,
      sessionId: session?.id,
      mcpUrlHost: safeHost(mcpUrl),
      toolCount: toolNames.length,
      sampleTools: toolNames.slice(0, 8),
      note:
        "Created a Composio session with MCP enabled and listed tools through an MCP client. Secret-bearing URL and headers were redacted."
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      status: "failed",
      docs,
      error: redactSecretFragments(error instanceof Error ? error.message : String(error)),
      note:
        "The proof script failed in this environment. The failure is recorded so the submission stays honest and debuggable."
    };
  }
}

async function main() {
  const proof = await createProof();
  await writeJson(resolveFromRoot("data", "run-logs", "mcp-proof.json"), proof);
  console.log(`MCP proof status: ${proof.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
