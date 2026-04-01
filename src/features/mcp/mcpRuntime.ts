import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export interface McpServerRuntimeStatus {
  server_id: string;
  transport: string;
  running: boolean;
  detail: string;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/$/, "");
}

export async function startMcpServer(serverId: string): Promise<McpServerRuntimeStatus> {
  return invoke<McpServerRuntimeStatus>("mcp_server_start", { server_id: serverId });
}

export async function stopMcpServer(serverId: string): Promise<McpServerRuntimeStatus> {
  return invoke<McpServerRuntimeStatus>("mcp_server_stop", { server_id: serverId });
}

export async function getMcpServerStatus(serverId: string): Promise<McpServerRuntimeStatus> {
  return invoke<McpServerRuntimeStatus>("mcp_server_status", { server_id: serverId });
}

export async function testMcpServer(
  server: { id: string; transport: "stdio" | "http"; endpoint: string }
): Promise<string> {
  if (server.transport === "http") {
    const endpoint = normalizeEndpoint(server.endpoint);
    const healthUrls = [endpoint, `${endpoint}/health`, `${endpoint}/status`];
    let lastError = "No response";
    for (const url of healthUrls) {
      try {
        const res = await fetch(url, { method: "GET" });
        if (res.ok) return `HTTP MCP reachable at ${url} (status ${res.status})`;
        lastError = `HTTP ${res.status} at ${url}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(`HTTP MCP health test failed: ${lastError}`);
  }
  return invoke<string>("mcp_server_test", { server_id: server.id });
}

export async function dispatchMcpTool(
  appConfig: AppConfig,
  input: { serverId: string; toolName: string; argumentsObject: Record<string, unknown> }
): Promise<string> {
  const server = (appConfig.mcp_servers ?? []).find((s) => s.id === input.serverId);
  if (!server) throw new Error(`MCP server not found: ${input.serverId}`);
  if (!server.enabled) throw new Error(`MCP server is disabled: ${input.serverId}`);

  const payload = {
    tool: input.toolName,
    arguments: input.argumentsObject,
  };

  if (server.transport === "http") {
    const endpoint = normalizeEndpoint(server.endpoint);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP MCP dispatch failed (${res.status}): ${text}`);
    return text;
  }

  return invoke<string>("mcp_dispatch_stdio_tool", {
    server_id: server.id,
    tool_name: input.toolName,
    arguments_json: JSON.stringify(input.argumentsObject),
  });
}

