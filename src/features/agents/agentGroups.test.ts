import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAgentGroup, setActiveAgentGroup } from "./agentGroups";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));
import { invoke } from "../../api/tauri";

describe("agentGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves group and sets active group", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ agent_groups: [] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ active_agent_group_id: null })
      .mockResolvedValueOnce(undefined);

    await saveAgentGroup({
      id: "research-pair",
      name: "Research Pair",
      member_profile_ids: ["a", "b"],
    });
    await setActiveAgentGroup("research-pair");

    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          agent_groups: expect.arrayContaining([expect.objectContaining({ id: "research-pair" })]),
        }),
      })
    );
  });
});

