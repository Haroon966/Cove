import type { BackendType } from "../../types";

export type ModelCapability =
  | "chat"
  | "tools"
  | "vision"
  | "audio_tts"
  | "audio_stt"
  | "image_generation";

export interface ProviderProfile {
  id: BackendType;
  label: string;
  capabilities: ModelCapability[];
  defaultModel: string;
}

export const DEFAULT_PROVIDER_REGISTRY: ProviderProfile[] = [
  {
    id: "ollama",
    label: "Ollama",
    capabilities: ["chat", "tools", "vision"],
    defaultModel: "llama2",
  },
  {
    id: "openai",
    label: "OpenAI Compatible",
    capabilities: ["chat", "tools", "vision", "audio_tts", "audio_stt", "image_generation"],
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "groq",
    label: "Groq",
    capabilities: ["chat", "tools"],
    defaultModel: "llama-3.1-8b-instant",
  },
  {
    id: "openai_compatible",
    label: "Custom OpenAI Compatible",
    capabilities: ["chat", "tools", "vision", "image_generation", "audio_tts", "audio_stt"],
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "open_webui",
    label: "Open WebUI",
    capabilities: ["chat", "tools", "vision", "image_generation", "audio_tts", "audio_stt"],
    defaultModel: "llama3.1",
  },
];

export function getProviderProfile(backendType: BackendType | string | null | undefined): ProviderProfile | null {
  if (!backendType) return null;
  return DEFAULT_PROVIDER_REGISTRY.find((p) => p.id === backendType) ?? null;
}

export function supportsProviderCapability(
  backendType: BackendType | string | null | undefined,
  capability: ModelCapability
): boolean {
  const profile = getProviderProfile(backendType);
  if (!profile) return false;
  return profile.capabilities.includes(capability);
}

