import { describe, expect, it } from "vitest";
import { applyThemeTokens } from "./tokens";

describe("applyThemeTokens", () => {
  it("applies token overrides to css vars", () => {
    const styleStore = new Map<string, string>();
    const style = {
      setProperty: (name: string, value: string) => styleStore.set(name, value),
      removeProperty: (name: string) => styleStore.delete(name),
      getPropertyValue: (name: string) => styleStore.get(name) ?? "",
    };
    const previousDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      documentElement: { style },
    };
    applyThemeTokens({
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3",
      api_key: null,
      theme_tokens: {
        surface_bg: "#111111",
        radius_scale: "lg",
        density: "compact",
      },
    });
    expect(style.getPropertyValue("--surface-bg")).toContain("#111111");
    expect(style.getPropertyValue("--radius-scale")).toContain("1.2");
    (globalThis as { document?: unknown }).document = previousDocument;
  });
});

