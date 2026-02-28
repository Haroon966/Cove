/**
 * OpenAI-compatible API - all requests go to user-configured base URL (local only).
 */

export async function fetchOpenAIModels(
  baseUrl: string,
  apiKey?: string | null
): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "") + "/v1/models";
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const list = data.data;
  if (!Array.isArray(list)) return [];
  return list.map((m) => m.id).filter(Boolean);
}

export interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function streamOpenAIChat(
  baseUrl: string,
  model: string,
  messages: OpenAIMessage[],
  apiKey: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
  temperature?: number,
  maxTokens?: number
): Promise<void> {
  const url = baseUrl.replace(/\/$/, "") + "/v1/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    ...(temperature != null && { temperature }),
    ...(maxTokens != null && { max_tokens: maxTokens }),
  });

  let doneCalled = false;
  const callDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      onDone();
    }
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
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
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            callDone();
            continue;
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {
            // skip
          }
        }
      }
    }
    callDone();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      callDone();
      return;
    }
    onError(e instanceof Error ? e : new Error(String(e)));
  }
}
