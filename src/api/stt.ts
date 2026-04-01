import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import type { AppConfig } from "../types";

function joinPath(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

export async function transcribeAudioWithCurrentConfig(
  config: AppConfig,
  file: File,
  options?: { model?: string }
): Promise<string> {
  const baseUrl = getEffectiveBaseUrl(config);
  if (!baseUrl) throw new Error("Missing base URL.");
  const backend = config.backend_type ?? "ollama";
  if (backend === "ollama" || backend === "groq") {
    throw new Error(`STT is not supported for backend: ${backend}`);
  }
  const apiKey = getEffectiveApiKey(config);
  const model = options?.model ?? "whisper-1";

  const endpoints =
    backend === "open_webui"
      ? [
          joinPath(baseUrl, `${config.openwebui_api_path ?? "/api"}/v1/audio/transcriptions`),
          joinPath(baseUrl, "/v1/audio/transcriptions"),
          joinPath(baseUrl, "/api/v1/audio/transcriptions"),
        ]
      : [joinPath(baseUrl, "/v1/audio/transcriptions")];

  for (const endpoint of endpoints) {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("model", model);
      const headers: Record<string, string> = {};
      if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { text?: string };
      if (json.text?.trim()) return json.text.trim();
    } catch {
      // try next endpoint
    }
  }
  throw new Error("STT request failed. Check provider support, model, and API key.");
}

