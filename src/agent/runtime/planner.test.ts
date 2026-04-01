import { describe, expect, it } from "vitest";
import { buildCapabilityAwareExecutionPlan, buildExecutionPlan } from "./planner";

describe("planner", () => {
  it("builds deterministic fallback plan", () => {
    const plan = buildExecutionPlan("Read files and then update docs", 4);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].id).toBe("step_1");
  });

  it("adds tool suggestions and dependencies", () => {
    const plan = buildCapabilityAwareExecutionPlan(
      "Inspect project files, then edit config and run tests",
      5,
      ["read_file", "list_dir", "write_file", "run_shell_command"],
      []
    );
    expect(plan.some((step) => (step.suggestedTools ?? []).includes("read_file"))).toBe(true);
    expect(
      plan.some(
        (step) =>
          (step.suggestedTools ?? []).includes("write_file") &&
          Array.isArray(step.dependsOnStepIds) &&
          step.dependsOnStepIds.length > 0
      )
    ).toBe(true);
  });

  it("splits goal into multiple steps", () => {
    const plan = buildExecutionPlan("open project and run tests and fix failures");
    expect(plan.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to single-step plan", () => {
    const plan = buildExecutionPlan("Summarize this repo.");
    expect(plan).toHaveLength(1);
    expect(plan[0].title).toContain("Summarize");
  });
});

