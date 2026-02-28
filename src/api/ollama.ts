/**
 * Ollama API - all requests go to user-configured base URL (local only).
 */

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
}

export async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "") + "/api/tags";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  const models = data.models as Array<{ name: string }> | undefined;
  if (!Array.isArray(models)) return [];
  return models.map((m) => m.name);
}

export interface OllamaShowResponse {
  capabilities?: string[];
}

/** Fetch model details; returns true if model has vision capability. */
export async function fetchOllamaModelShow(
  baseUrl: string,
  model: string,
  signal?: AbortSignal
): Promise<boolean> {
  const url = baseUrl.replace(/\/$/, "") + "/api/show";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
    signal,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as OllamaShowResponse;
  const caps = data.capabilities;
  return Array.isArray(caps) && caps.includes("vision");
}

export async function streamOllamaChat(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
  temperature?: number,
  maxTokens?: number,
  lastMessageImages?: string[]
): Promise<void> {
  const url = baseUrl.replace(/\/$/, "") + "/api/chat";
  const options: Record<string, number> = {};
  if (temperature != null) options.temperature = temperature;
  if (maxTokens != null) options.num_predict = maxTokens;

  let payloadMessages: Array<OllamaMessage & { images?: string[] }> = [...messages];
  if (lastMessageImages?.length && payloadMessages.length > 0) {
    const last = payloadMessages[payloadMessages.length - 1];
    if (last.role === "user") {
      payloadMessages = payloadMessages.slice(0, -1).concat({
        ...last,
        images: lastMessageImages,
      });
    }
  }

  const body = JSON.stringify({
    model,
    messages: payloadMessages,
    stream: true,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  });
  let fullContent = "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) {
      onError(new Error("No response body"));
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as OllamaChatChunk;
          if (parsed.message?.content) {
            fullContent += parsed.message.content;
            onChunk(parsed.message.content);
          }
          if (parsed.done) {
            /* done chunk seen; onDone called once at end of stream */
          }
        } catch {
          // skip invalid JSON lines
        }
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as OllamaChatChunk;
        if (parsed.message?.content) {
          onChunk(parsed.message.content);
        }
      } catch {
        // ignore
      }
    }
    onDone();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      onDone();
      return;
    }
    onError(e instanceof Error ? e : new Error(String(e)));
  }
}
