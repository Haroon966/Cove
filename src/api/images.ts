import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import type { AppConfig } from "../types";

export interface GeneratedImageResult {
  dataUrl?: string;
  imageUrl?: string;
  revisedPrompt?: string;
}

function joinPath(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

async function tryOpenAiImageEndpoint(
  endpoint: string,
  apiKey: string | null,
  body: Record<string, unknown>
): Promise<GeneratedImageResult | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const first = json.data?.[0];
  if (!first) return null;
  if (first.b64_json) {
    return {
      dataUrl: `data:image/png;base64,${first.b64_json}`,
      revisedPrompt: first.revised_prompt,
    };
  }
  if (first.url) {
    return {
      imageUrl: first.url,
      revisedPrompt: first.revised_prompt,
    };
  }
  return null;
}

export async function generateImageWithCurrentConfig(
  config: AppConfig,
  prompt: string,
  options?: { size?: "1024x1024" | "1024x1792" | "1792x1024"; model?: string | null }
): Promise<GeneratedImageResult> {
  const baseUrl = getEffectiveBaseUrl(config);
  if (!baseUrl) throw new Error("Missing base URL.");

  const backend = config.backend_type ?? "ollama";
  if (backend === "ollama" || backend === "groq") {
    throw new Error(`Image generation is not supported for backend: ${backend}`);
  }

  const apiKey = getEffectiveApiKey(config);
  const size = options?.size ?? "1024x1024";
  const model = options?.model ?? config.model ?? "gpt-image-1";
  const body = {
    model,
    prompt,
    size,
  };

  const endpoints: string[] =
    backend === "open_webui"
      ? [
          joinPath(baseUrl, `${config.openwebui_api_path ?? "/api"}/v1/images/generations`),
          joinPath(baseUrl, "/v1/images/generations"),
          joinPath(baseUrl, "/api/v1/images/generations"),
        ]
      : [joinPath(baseUrl, "/v1/images/generations")];

  for (const endpoint of endpoints) {
    try {
      const out = await tryOpenAiImageEndpoint(endpoint, apiKey, body);
      if (out) return out;
    } catch {
      // try next
    }
  }
  throw new Error("Image generation failed. Check provider support, model, and API key.");
}

