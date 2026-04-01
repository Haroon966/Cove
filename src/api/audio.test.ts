import { beforeEach, describe, expect, it, vi } from "vitest";
import { synthesizeSpeechWithCurrentConfig } from "./audio";
import type { AppConfig } from "../types";

describe("synthesizeSpeechWithCurrentConfig", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns audio blob for supported backends", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["audio"], { type: "audio/mpeg" }),
      })
    );
    const cfg: AppConfig = {
      backend_type: "openai_compatible",
      base_url: "http://localhost:1234",
      model: "gpt-4o-mini-tts",
      api_key: "k",
    };
    const blob = await synthesizeSpeechWithCurrentConfig(cfg, "hello");
    expect(blob.type).toContain("audio");
  });

  it("throws for unsupported backends", async () => {
    const cfg: AppConfig = {
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3",
      api_key: null,
    };
    await expect(synthesizeSpeechWithCurrentConfig(cfg, "hello")).rejects.toThrow(
      "not supported"
    );
  });
});

