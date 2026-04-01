import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAgentProfile, saveAgentProfile, setActiveAgentProfile } from "./agentProfiles";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));
import { invoke } from "../../api/tauri";

describe("agentProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves profile and can set active profile", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ agent_profiles: [] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ agent_profiles: [], active_agent_profile_id: null })
      .mockResolvedValueOnce(undefined);

    await saveAgentProfile({
      id: "coder",
      name: "Coder",
      system_prompt: "You are a coding assistant.",
    });
    await setActiveAgentProfile("coder");

    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          agent_profiles: expect.arrayContaining([expect.objectContaining({ id: "coder" })]),
        }),
      })
    );
  });

  it("deletes profile and clears active when matching", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        agent_profiles: [{ id: "coder", name: "Coder", system_prompt: "x" }],
        active_agent_profile_id: "coder",
      })
      .mockResolvedValueOnce(undefined);

    await deleteAgentProfile("coder");
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          agent_profiles: [],
          active_agent_profile_id: null,
        }),
      })
    );
  });
});

