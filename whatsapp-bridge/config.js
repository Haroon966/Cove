/**
 * Load bridge config from JSON file (same shape as Cove AppConfig subset).
 */
import { readFileSync } from "fs";

const PROVIDER_PRESETS = {
  openai: { baseUrl: "https://api.openai.com" },
  groq: { baseUrl: "https://api.groq.com/openai" },
};

export function loadConfig(configPath) {
  const raw = readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  return config;
}

/** Resolve effective base URL for the current backend (preset or custom). */
export function getEffectiveBaseUrl(config) {
  if (!config?.base_url?.trim()) return null;
  const bt = config.backend_type ?? "ollama";
  const preset = PROVIDER_PRESETS[bt];
  if (preset) return preset.baseUrl;
  return config.base_url.trim();
}

/** Resolve effective API key for the current backend. */
export function getEffectiveApiKey(config) {
  if (!config) return null;
  const bt = config.backend_type ?? "ollama";
  if (bt === "ollama") return null;
  if (config.api_keys?.[bt]) {
    const k = config.api_keys[bt].trim();
    return k || null;
  }
  return config.api_key?.trim() || null;
}
