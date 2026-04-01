import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverAllProviderModels } from "./modelDiscovery";

vi.mock("../../api/ollama", () => ({
  fetchOllamaModels: vi.fn(),
}));
vi.mock("../../api/openai", () => ({
  fetchOpenAIModels: vi.fn(),
}));
vi.mock("../../api/openwebui", () => ({
  fetchOpenWebUIModels: vi.fn(),
}));

import { fetchOllamaModels } from "../../api/ollama";
import { fetchOpenAIModels } from "../../api/openai";
import { fetchOpenWebUIModels } from "../../api/openwebui";

describe("modelDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovers models across providers", async () => {
    vi.mocked(fetchOllamaModels).mockResolvedValue(["llama3"]);
    vi.mocked(fetchOpenAIModels).mockResolvedValue(["gpt-4o-mini"]);
    vi.mocked(fetchOpenWebUIModels).mockResolvedValue(["owui-model"]);

    const result = await discoverAllProviderModels({
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3",
      api_key: null,
      api_keys: { openai: "k1", groq: "k2", open_webui: "k3" },
    });

    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.some((r) => r.provider === "ollama" && r.models.includes("llama3"))).toBe(true);
    expect(result.some((r) => r.provider === "openai")).toBe(true);
  });
});

