import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchMcpTool, testMcpServer } from "./mcpRuntime";
import type { AppConfig } from "../../types";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "../../api/tauri";

describe("mcpRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches stdio MCP tools via tauri command", async () => {
    vi.mocked(invoke).mockResolvedValue("ok");
    const cfg: AppConfig = {
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3.1",
      api_key: null,
      mcp_servers: [
        {
          id: "stdio-1",
          label: "Local MCP",
          transport: "stdio",
          endpoint: "node server.js",
          enabled: true,
        },
      ],
    };
    const out = await dispatchMcpTool(cfg, {
      serverId: "stdio-1",
      toolName: "echo",
      argumentsObject: { text: "hello" },
    });
    expect(out).toBe("ok");
    expect(invoke).toHaveBeenCalledWith("mcp_dispatch_stdio_tool", {
      server_id: "stdio-1",
      tool_name: "echo",
      arguments_json: "{\"text\":\"hello\"}",
    });
  });

  it("tests http MCP endpoints with GET health checks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );
    const out = await testMcpServer({
      id: "http-1",
      transport: "http",
      endpoint: "http://localhost:8081",
    });
    expect(out).toContain("reachable");
  });
});

