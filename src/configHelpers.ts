import type { AppConfig } from "./types";

export const PROVIDER_PRESETS: Record<string, { baseUrl: string; label: string }> = {
  openai: { baseUrl: "https://api.openai.com", label: "OpenAI" },
  groq: { baseUrl: "https://api.groq.com/openai", label: "Groq" },
  open_webui: { baseUrl: "http://127.0.0.1:8080", label: "Open WebUI" },
};

export const FIXED_BASE_URL_PROVIDERS = ["openai", "groq"] as const;

export const DEFAULT_API_KEY_PROVIDERS = ["openai", "gemini", "groq", "open_webui"] as const;

/** Resolve effective base URL for the current backend (preset or custom). */
export function getEffectiveBaseUrl(config: AppConfig | null): string | null {
  if (!config) return null;
  const bt = config.backend_type ?? "ollama";
  const preset = bt in PROVIDER_PRESETS ? PROVIDER_PRESETS[bt as keyof typeof PROVIDER_PRESETS] : null;
  if (preset && (FIXED_BASE_URL_PROVIDERS as readonly string[]).includes(bt)) return preset.baseUrl;
  if (!config.base_url?.trim()) return null;
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

export function isFeatureEnabled(
  config: AppConfig | null,
  flag: string,
  fallback = false
): boolean {
  return config?.feature_flags?.[flag] ?? fallback;
}

type ToolPolicy = NonNullable<AppConfig["tool_policy"]>;
type SkillPolicy = {
  allowed_tools?: string[] | null;
  denied_tools?: string[] | null;
  require_confirmation_for?: string[] | null;
} | null;

export function resolveRuntimeToolPolicy(
  globalPolicy: AppConfig["tool_policy"] | null | undefined,
  skillPolicy: SkillPolicy,
  profileToolsDisabled: boolean
): ToolPolicy {
  if (profileToolsDisabled) {
    return {
      role: "restricted",
      mode: "deny_all",
      allowed_tools: null,
      denied_tools: null,
      require_confirmation_for: null,
    };
  }
  const base: ToolPolicy = globalPolicy ?? {
    role: "owner",
    mode: "confirm_all",
    allowed_tools: null,
    denied_tools: null,
    require_confirmation_for: ["run_shell_command"],
  };
  if (!skillPolicy) return base;
  const allowed =
    base.allowed_tools && skillPolicy.allowed_tools
      ? base.allowed_tools.filter((tool) => skillPolicy.allowed_tools!.includes(tool))
      : (base.allowed_tools ?? skillPolicy.allowed_tools ?? null);
  const denied = Array.from(new Set([...(base.denied_tools ?? []), ...(skillPolicy.denied_tools ?? [])]));
  const requireConfirm = Array.from(
    new Set([...(base.require_confirmation_for ?? []), ...(skillPolicy.require_confirmation_for ?? [])])
  );
  return {
    ...base,
    allowed_tools: allowed,
    denied_tools: denied.length ? denied : null,
    require_confirmation_for: requireConfirm.length ? requireConfirm : null,
  };
}
