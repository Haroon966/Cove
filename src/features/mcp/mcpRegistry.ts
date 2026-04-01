export interface McpServerConfig {
  id: string;
  label: string;
  transport: "stdio" | "http";
  endpoint: string;
  enabled: boolean;
}

export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [];

