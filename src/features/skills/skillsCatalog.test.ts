import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_SKILLS, loadEnabledSkills, setEnabledSkills } from "./skillsCatalog";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "../../api/tauri";

describe("skillsCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes built-in skills", () => {
    expect(BUILT_IN_SKILLS.length).toBeGreaterThan(0);
  });

  it("loads and saves enabled skills in config", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ enabled_skills: ["debug-triage"] })
      .mockResolvedValueOnce({ enabled_skills: ["debug-triage"] })
      .mockResolvedValueOnce(undefined);

    const enabled = await loadEnabledSkills();
    expect(enabled).toEqual(["debug-triage"]);

    await setEnabledSkills(["debug-triage", "ui-ux-review"]);
    expect(invoke).toHaveBeenNthCalledWith(3, "config_save", {
      config: expect.objectContaining({
        enabled_skills: ["debug-triage", "ui-ux-review"],
      }),
    });
  });
});

