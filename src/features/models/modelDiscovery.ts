import { fetchOllamaModels } from "../../api/ollama";
import { fetchOpenAIModels } from "../../api/openai";
import { fetchOpenWebUIModels } from "../../api/openwebui";
import type { AppConfig, BackendType } from "../../types";
import { PROVIDER_PRESETS } from "../../configHelpers";

export interface ProviderModelCatalog {
  provider: BackendType;
  label: string;
  baseUrl: string;
  models: string[];
  error?: string;
}

async function discoverOne(
  provider: BackendType,
  label: string,
  baseUrl: string,
  apiKey: string | null,
  openWebUiApiPath?: string | null
): Promise<ProviderModelCatalog> {
  try {
    let models: string[] = [];
    if (provider === "ollama") {
      models = await fetchOllamaModels(baseUrl);
    } else if (provider === "open_webui") {
      models = await fetchOpenWebUIModels(baseUrl, apiKey, openWebUiApiPath);
    } else {
      models = await fetchOpenAIModels(baseUrl, apiKey);
    }
    return {
      provider,
      label,
      baseUrl,
      models,
    };
  } catch (e) {
    return {
      provider,
      label,
      baseUrl,
      models: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function discoverAllProviderModels(
  config: AppConfig
): Promise<ProviderModelCatalog[]> {
  const candidates: Array<Promise<ProviderModelCatalog>> = [];
  const openAiKey = config.api_keys?.openai ?? null;
  const groqKey = config.api_keys?.groq ?? null;
  const openWebUiKey = config.api_keys?.open_webui ?? null;
  const customBase = config.base_url?.trim() ?? "";
  const customKey = config.api_key ?? null;

  candidates.push(
    discoverOne("ollama", "Ollama", customBase || "http://localhost:11434", null)
  );
  candidates.push(
    discoverOne("openai", "OpenAI", PROVIDER_PRESETS.openai.baseUrl, openAiKey)
  );
  candidates.push(
    discoverOne("groq", "Groq", PROVIDER_PRESETS.groq.baseUrl, groqKey)
  );
  candidates.push(
    discoverOne(
      "open_webui",
      "Open WebUI",
      config.backend_type === "open_webui"
        ? customBase || PROVIDER_PRESETS.open_webui.baseUrl
        : PROVIDER_PRESETS.open_webui.baseUrl,
      openWebUiKey,
      config.openwebui_api_path
    )
  );
  if (customBase) {
    candidates.push(
      discoverOne("openai_compatible", "Custom OpenAI Compatible", customBase, customKey)
    );
  }
  return Promise.all(candidates);
}

