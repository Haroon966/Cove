import { beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudioWithCurrentConfig } from "./stt";
import type { AppConfig } from "../types";

describe("transcribeAudioWithCurrentConfig", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns text when transcription succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: "hello world" }),
      })
    );
    const cfg: AppConfig = {
      backend_type: "openai_compatible",
      base_url: "http://localhost:1234",
      model: "whisper-1",
      api_key: "k",
    };
    const file = new File(["audio"], "a.wav", { type: "audio/wav" });
    const text = await transcribeAudioWithCurrentConfig(cfg, file);
    expect(text).toBe("hello world");
  });

  it("throws for unsupported backends", async () => {
    const cfg: AppConfig = {
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3",
      api_key: null,
    };
    const file = new File(["audio"], "a.wav", { type: "audio/wav" });
    await expect(transcribeAudioWithCurrentConfig(cfg, file)).rejects.toThrow(
      "not supported"
    );
  });
});

