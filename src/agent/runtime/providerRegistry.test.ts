import { describe, expect, it } from "vitest";
import { DEFAULT_PROVIDER_REGISTRY, supportsProviderCapability } from "./providerRegistry";

describe("DEFAULT_PROVIDER_REGISTRY", () => {
  it("contains the core providers used by Cove", () => {
    const ids = DEFAULT_PROVIDER_REGISTRY.map((p) => p.id);
    expect(ids).toContain("ollama");
    expect(ids).toContain("openai");
    expect(ids).toContain("open_webui");
  });

  it("defines at least one chat capability per provider", () => {
    for (const provider of DEFAULT_PROVIDER_REGISTRY) {
      expect(provider.capabilities).toContain("chat");
    }
  });

  it("exposes capability helper for runtime gating", () => {
    expect(supportsProviderCapability("openai_compatible", "audio_tts")).toBe(true);
    expect(supportsProviderCapability("ollama", "audio_tts")).toBe(false);
  });
});

