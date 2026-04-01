import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_AGENT_MARKETPLACE, installAgentTemplate, removeAgentTemplate } from "./templateCatalog";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));
import { invoke } from "../../api/tauri";

describe("agent template catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("contains curated templates", () => {
    expect(CURATED_AGENT_MARKETPLACE.length).toBeGreaterThan(0);
  });

  it("installs and removes templates in config", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ agent_templates: [] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        agent_templates: [{ id: "research-analyst", name: "Research Analyst", description: "", system_prompt: "" }],
      })
      .mockResolvedValueOnce(undefined);

    await installAgentTemplate("research-analyst");
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          agent_templates: expect.arrayContaining([expect.objectContaining({ id: "research-analyst" })]),
        }),
      })
    );

    await removeAgentTemplate("research-analyst");
    expect(invoke).toHaveBeenNthCalledWith(
      4,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          agent_templates: [],
        }),
      })
    );
  });
});

