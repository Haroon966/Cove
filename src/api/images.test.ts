import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImageWithCurrentConfig } from "./images";
import type { AppConfig } from "../types";

describe("generateImageWithCurrentConfig", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns data URL when provider sends b64_json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ b64_json: "AAAA", revised_prompt: "rp" }] }),
      })
    );

    const cfg: AppConfig = {
      backend_type: "openai_compatible",
      base_url: "http://localhost:1234",
      model: "gpt-image-1",
      api_key: "k",
    };

    const result = await generateImageWithCurrentConfig(cfg, "draw a cat");
    expect(result.dataUrl).toContain("data:image/png;base64,AAAA");
  });

  it("throws for unsupported backends", async () => {
    const cfg: AppConfig = {
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3",
      api_key: null,
    };
    await expect(generateImageWithCurrentConfig(cfg, "x")).rejects.toThrow(
      "not supported"
    );
  });
});

