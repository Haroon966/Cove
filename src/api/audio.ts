import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import type { AppConfig } from "../types";

function joinPath(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

export async function synthesizeSpeechWithCurrentConfig(
  config: AppConfig,
  text: string,
  options?: { voice?: string; model?: string }
): Promise<Blob> {
  const baseUrl = getEffectiveBaseUrl(config);
  if (!baseUrl) throw new Error("Missing base URL.");
  const backend = config.backend_type ?? "ollama";
  if (backend === "ollama" || backend === "groq") {
    throw new Error(`TTS is not supported for backend: ${backend}`);
  }
  const apiKey = getEffectiveApiKey(config);
  const model = options?.model ?? "gpt-4o-mini-tts";
  const voice = options?.voice ?? "alloy";
  const body = {
    model,
    voice,
    input: text,
    format: "mp3",
  };

  const endpoints =
    backend === "open_webui"
      ? [
          joinPath(baseUrl, `${config.openwebui_api_path ?? "/api"}/v1/audio/speech`),
          joinPath(baseUrl, "/v1/audio/speech"),
          joinPath(baseUrl, "/api/v1/audio/speech"),
        ]
      : [joinPath(baseUrl, "/v1/audio/speech")];

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      return await res.blob();
    } catch {
      // try next endpoint
    }
  }
  throw new Error("TTS request failed. Check provider support, model, and API key.");
}

