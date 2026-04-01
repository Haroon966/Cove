import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export interface McpMarketplaceEntry {
  id: string;
  label: string;
  description: string;
  transport: "stdio" | "http";
  endpoint: string;
  category: "dev" | "data" | "automation";
}

export const CURATED_MCP_MARKETPLACE: McpMarketplaceEntry[] = [
  {
    id: "filesystem-pro",
    label: "Filesystem Pro",
    description: "Advanced project file operations and search.",
    transport: "stdio",
    endpoint: "npx -y @modelcontextprotocol/server-filesystem .",
    category: "dev",
  },
  {
    id: "github",
    label: "GitHub MCP",
    description: "Issues, PRs, checks, and repo automation.",
    transport: "http",
    endpoint: "https://api.githubcopilot.com/mcp/",
    category: "automation",
  },
  {
    id: "postgres",
    label: "Postgres Inspector",
    description: "SQL exploration and table introspection.",
    transport: "stdio",
    endpoint: "npx -y @modelcontextprotocol/server-postgres",
    category: "data",
  },
];

export async function installMarketplaceMcp(entryId: string): Promise<void> {
  const entry = CURATED_MCP_MARKETPLACE.find((e) => e.id === entryId);
  if (!entry) throw new Error(`Marketplace entry not found: ${entryId}`);
  const config = await invoke<AppConfig>("config_load");
  const current = config.mcp_servers ?? [];
  const existingIdx = current.findIndex((s) => s.id === entry.id);
  const nextServer = {
    id: entry.id,
    label: entry.label,
    transport: entry.transport,
    endpoint: entry.endpoint,
    enabled: true,
  };
  const next =
    existingIdx >= 0
      ? current.map((s, i) => (i === existingIdx ? nextServer : s))
      : [...current, nextServer];
  await invoke("config_save", {
    config: {
      ...config,
      mcp_servers: next,
    },
  });
}

