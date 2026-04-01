import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_BENCHMARKS, scoreBenchmark } from "./agentQualityHarness";

describe("agentQualityHarness", () => {
  it("includes baseline benchmark prompts", () => {
    expect(DEFAULT_AGENT_BENCHMARKS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_AGENT_BENCHMARKS.every((b) => b.expectsTools)).toBe(true);
  });

  it("scores complete and fast runs higher", () => {
    const strong = scoreBenchmark({
      benchmarkId: "x",
      completed: true,
      usedTools: true,
      durationMs: 18000,
      requiredCorrections: 0,
    });
    const weak = scoreBenchmark({
      benchmarkId: "x",
      completed: false,
      usedTools: false,
      durationMs: 60000,
      requiredCorrections: 2,
    });
    expect(strong).toBeGreaterThan(weak);
  });
});
