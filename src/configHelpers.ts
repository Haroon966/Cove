import type { AppConfig } from "./types";

export const PROVIDER_PRESETS: Record<string, { baseUrl: string; label: string }> = {
  openai: { baseUrl: "https://api.openai.com", label: "OpenAI" },
  groq: { baseUrl: "https://api.groq.com/openai", label: "Groq" },
};

export const DEFAULT_API_KEY_PROVIDERS = ["openai", "gemini", "groq"] as const;

/** Resolve effective base URL for the current backend (preset or custom). */
export function getEffectiveBaseUrl(config: AppConfig | null): string | null {
  if (!config?.base_url?.trim()) return null;
  const bt = config.backend_type ?? "ollama";
  const preset = bt in PROVIDER_PRESETS ? PROVIDER_PRESETS[bt as keyof typeof PROVIDER_PRESETS] : null;
  if (preset) return preset.baseUrl;
  return config.base_url.trim();
}

/** Resolve effective API key for the current backend (from api_keys or legacy api_key). */
export function getEffectiveApiKey(config: AppConfig | null): string | null {
  if (!config) return null;
  const bt = config.backend_type ?? "ollama";
  if (bt === "ollama") return null;
  if (bt in PROVIDER_PRESETS && config.api_keys?.[bt]) {
    const k = config.api_keys[bt].trim();
    return k || null;
  }
  return config.api_key?.trim() || null;
}
