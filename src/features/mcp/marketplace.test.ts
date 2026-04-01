import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_MCP_MARKETPLACE, installMarketplaceMcp } from "./marketplace";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "../../api/tauri";

describe("mcp marketplace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has curated entries", () => {
    expect(CURATED_MCP_MARKETPLACE.length).toBeGreaterThan(0);
  });

  it("installs marketplace MCP into config", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        backend_type: "ollama",
        base_url: "http://localhost:11434",
        model: "llama3",
        api_key: null,
        mcp_servers: [],
      })
      .mockResolvedValueOnce(undefined);

    await installMarketplaceMcp("filesystem-pro");

    expect(invoke).toHaveBeenNthCalledWith(1, "config_load");
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          mcp_servers: expect.arrayContaining([
            expect.objectContaining({ id: "filesystem-pro" }),
          ]),
        }),
      })
    );
  });
});

