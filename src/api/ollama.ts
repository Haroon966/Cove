/**
 * Ollama API - all requests go to user-configured base URL (local only).
 */

export interface OllamaMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  images?: string[];
  tool_name?: string;
  tool_calls?: Array<{
    function: { name: string; arguments?: string | Record<string, unknown> };
    id?: string;
  }>;
}

export interface OllamaChatChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function: { name: string; arguments?: string | Record<string, unknown> };
      id?: string;
    }>;
  };
  done?: boolean;
}

/** Same shape as OpenAI for agent loop. */
export interface ParsedOllamaToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface OllamaToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** Avoid calling Ollama endpoints on known OpenAI-compatible hosts (prevents 404 when misconfigured). */
function isLikelyOllama(baseUrl: string): boolean {
  const u = baseUrl.replace(/\/$/, "").toLowerCase();
  return !u.includes("groq.com") && !u.includes("openai.com") && !u.endsWith("/v1");
}

export async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  if (!isLikelyOllama(baseUrl)) return [];
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
  if (!isLikelyOllama(baseUrl)) return false;
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

export interface StreamOllamaChatWithToolsOptions {
  tools: OllamaToolDef[];
  onChunk: (text: string) => void;
  onToolCalls: (calls: ParsedOllamaToolCall[]) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  lastMessageImages?: string[];
}

function parseOllamaToolCall(
  tc: { function: { name: string; arguments?: string | Record<string, unknown> }; id?: string },
  index: number
): ParsedOllamaToolCall {
  const args = tc.function.arguments;
  const argsStr =
    typeof args === "string" ? args : typeof args === "object" && args !== null ? JSON.stringify(args) : "{}";
  return {
    id: tc.id ?? `ollama_${index}`,
    name: tc.function.name ?? "",
    arguments: argsStr,
  };
}

/** Stream Ollama chat with tools; onToolCalls is invoked when the model returns tool_calls (then onDone). */
export async function streamOllamaChatWithTools(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  options: StreamOllamaChatWithToolsOptions
): Promise<void> {
  const url = baseUrl.replace(/\/$/, "") + "/api/chat";
  const opts: Record<string, number> = {};
  if (options.temperature != null) opts.temperature = options.temperature;
  if (options.maxTokens != null) opts.num_predict = options.maxTokens;

  let payloadMessages: Array<OllamaMessage & { images?: string[] }> = [...messages];
  if (options.lastMessageImages?.length && payloadMessages.length > 0) {
    const last = payloadMessages[payloadMessages.length - 1];
    if (last.role === "user") {
      payloadMessages = payloadMessages.slice(0, -1).concat({
        ...last,
        images: options.lastMessageImages,
      });
    }
  }

  const body = JSON.stringify({
    model,
    messages: payloadMessages,
    stream: true,
    ...(options.tools?.length ? { tools: options.tools } : {}),
    ...(Object.keys(opts).length > 0 ? { options: opts } : {}),
  });

  let doneCalled = false;
  const callDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      options.onDone();
    }
  };

  const accumulatedToolCalls: ParsedOllamaToolCall[] = [];
  let toolCallsEmitted = false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: options.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) {
      options.onError(new Error("No response body"));
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
          if (parsed.message?.content) options.onChunk(parsed.message.content);
          if (parsed.message?.tool_calls?.length && !toolCallsEmitted) {
            const calls = parsed.message.tool_calls.map((tc, i) => parseOllamaToolCall(tc, i));
            accumulatedToolCalls.push(...calls);
          }
          if (parsed.done && accumulatedToolCalls.length > 0 && !toolCallsEmitted) {
            toolCallsEmitted = true;
            options.onToolCalls(accumulatedToolCalls);
          }
        } catch {
          // skip
        }
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as OllamaChatChunk;
        if (parsed.message?.content) options.onChunk(parsed.message.content);
        if (parsed.message?.tool_calls?.length && !toolCallsEmitted) {
          const calls = parsed.message.tool_calls.map((tc, i) => parseOllamaToolCall(tc, accumulatedToolCalls.length + i));
          accumulatedToolCalls.push(...calls);
        }
        if (parsed.done && accumulatedToolCalls.length > 0 && !toolCallsEmitted) {
          toolCallsEmitted = true;
          options.onToolCalls(accumulatedToolCalls);
        }
      } catch {
        // ignore
      }
    }
    callDone();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      callDone();
      return;
    }
    options.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
