import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_FLAGS, resolveFeatureFlags } from "./featureFlags";

describe("resolveFeatureFlags", () => {
  it("returns defaults when config is missing", () => {
    expect(resolveFeatureFlags(null)).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it("overrides defaults with config flags", () => {
    const flags = resolveFeatureFlags({
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3.1",
      api_key: null,
      feature_flags: { lobehubKnowledgeBase: true },
    });
    expect(flags.lobehubKnowledgeBase).toBe(true);
    expect(flags.runtimeExecutionTraces).toBe(true);
  });
});

