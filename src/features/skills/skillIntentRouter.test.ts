import { describe, expect, it } from "vitest";
import { recommendSkillsFromPrompt } from "./skillIntentRouter";

describe("skill intent router", () => {
  it("recommends debug triage for bug prompts", () => {
    const recs = recommendSkillsFromPrompt(
      "I hit a regression bug after deploy. Please debug and isolate root cause."
    );
    expect(recs[0]?.skillId).toBe("debug-triage");
  });

  it("limits recommendations to configured maximum", () => {
    const recs = recommendSkillsFromPrompt(
      "Refactor this UI, improve accessibility, and verify release checklist before production ship.",
      2
    );
    expect(recs.length).toBeLessThanOrEqual(2);
  });
});
