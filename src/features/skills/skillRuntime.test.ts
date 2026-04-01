import { describe, expect, it } from "vitest";
import { resolveSkillContext } from "./skillRuntime";

describe("skill runtime", () => {
  it("merges manual and trusted auto recommendations", () => {
    const context = resolveSkillContext({
      manualSkillIds: ["ui-ux-review"],
      recommendations: [
        { skillId: "debug-triage", score: 25, reason: "debug keywords" },
        { skillId: "release-hardening", score: 19, reason: "release keyword" },
      ],
      trustModes: {
        "debug-triage": "auto",
        "release-hardening": "ask",
      },
    });

    expect(context.selectedSkillIds).toContain("ui-ux-review");
    expect(context.selectedSkillIds).toContain("debug-triage");
    expect(context.selectedSkillIds).not.toContain("release-hardening");
  });

  it("builds merged tool policy from selected skills", () => {
    const context = resolveSkillContext({
      manualSkillIds: ["coding-refactor"],
      recommendations: [],
      trustModes: {},
    });
    expect(context.toolPolicy.allowed_tools).toContain("read_file");
  });
});
