/**
 * OpenAI-compatible API - all requests go to user-configured base URL (local only).
 */

export interface OpenAIRequestOptions {
  modelsPath?: string;
  chatCompletionsPath?: string;
  extraHeaders?: Record<string, string>;
}

function joinApiPath(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return baseUrl.replace(/\/$/, "") + normalizedPath;
}

export async function fetchOpenAIModels(
  baseUrl: string,
  apiKey?: string | null,
  requestOptions?: OpenAIRequestOptions
): Promise<string[]> {
  const url = joinApiPath(baseUrl, requestOptions?.modelsPath ?? "/v1/models");
  const headers: Record<string, string> = { ...(requestOptions?.extraHeaders ?? {}) };
  if (apiKey?.trim()) headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const list = data.data;
  if (!Array.isArray(list)) return [];
  return list.map((m) => m.id).filter(Boolean);
}

export interface OpenAIToolCallDelta {
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

export interface OpenAIMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | OpenAIContentPart[];
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
}

export type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** OpenAI-format tool for request body. */
export interface OpenAIToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: string;
}

function buildPayload(
  model: string,
  payloadMessages: OpenAIMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    tools?: OpenAIToolDef[];
  }
): string {
  return JSON.stringify({
    model,
    messages: payloadMessages,
    stream: true,
    ...(options.temperature != null && { temperature: options.temperature }),
    ...(options.maxTokens != null && { max_tokens: options.maxTokens }),
    ...(options.tools?.length ? { tools: options.tools } : {}),
  });
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
  maxTokens?: number,
  lastMessageImages?: { base64: string; mimeType?: string }[],
  requestOptions?: OpenAIRequestOptions
): Promise<void> {
  const url = joinApiPath(baseUrl, requestOptions?.chatCompletionsPath ?? "/v1/chat/completions");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(requestOptions?.extraHeaders ?? {}),
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let payloadMessages: OpenAIMessage[] = [...messages];
  if (lastMessageImages?.length && payloadMessages.length > 0) {
    const last = payloadMessages[payloadMessages.length - 1];
    if (last.role === "user" && typeof last.content === "string") {
      const textPart: OpenAIContentPart = { type: "text", text: last.content };
      const imageParts: OpenAIContentPart[] = lastMessageImages.map((img) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:${img.mimeType ?? "image/png"};base64,${img.base64}`,
        },
      }));
      payloadMessages = payloadMessages.slice(0, -1).concat({
        ...last,
        content: [textPart, ...imageParts],
      });
    }
  }

  const body = buildPayload(model, payloadMessages, { temperature, maxTokens });

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
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            };
            const choice = parsed.choices?.[0];
            const content = choice?.delta?.content;
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

export interface StreamOpenAIChatWithToolsOptions {
  tools: OpenAIToolDef[];
  onChunk: (text: string) => void;
  onToolCalls: (calls: ParsedToolCall[]) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  lastMessageImages?: { base64: string; mimeType?: string }[];
  requestOptions?: OpenAIRequestOptions;
}

/** Stream OpenAI chat with tools; onToolCalls is invoked when the model returns tool_calls (then onDone). */
export async function streamOpenAIChatWithTools(
  baseUrl: string,
  model: string,
  messages: OpenAIMessage[],
  apiKey: string | null,
  options: StreamOpenAIChatWithToolsOptions
): Promise<void> {
  const url = joinApiPath(baseUrl, options.requestOptions?.chatCompletionsPath ?? "/v1/chat/completions");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.requestOptions?.extraHeaders ?? {}),
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let payloadMessages: OpenAIMessage[] = [...messages];
  const lastMessageImages = options.lastMessageImages;
  if (lastMessageImages?.length && payloadMessages.length > 0) {
    const last = payloadMessages[payloadMessages.length - 1];
    if (last.role === "user" && typeof last.content === "string") {
      const textPart: OpenAIContentPart = { type: "text", text: last.content };
      const imageParts: OpenAIContentPart[] = lastMessageImages.map((img) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:${img.mimeType ?? "image/png"};base64,${img.base64}`,
        },
      }));
      payloadMessages = payloadMessages.slice(0, -1).concat({
        ...last,
        content: [textPart, ...imageParts],
      });
    }
  }

  const body = buildPayload(model, payloadMessages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    tools: options.tools,
  });

  let doneCalled = false;
  const callDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      options.onDone();
    }
  };

  const toolCallsByIndex: Record<number, { id: string; name: string; arguments: string }> = {};
  let toolCallsEmitted = false;

  const emitAccumulatedToolCalls = () => {
    if (toolCallsEmitted || Object.keys(toolCallsByIndex).length === 0) return;
    toolCallsEmitted = true;
    const ordered = Object.keys(toolCallsByIndex)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => toolCallsByIndex[i])
      .filter((c) => c.id && c.name);
    if (ordered.length) options.onToolCalls(ordered);
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
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
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            emitAccumulatedToolCalls();
            callDone();
            continue;
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: OpenAIToolCallDelta[];
                };
                finish_reason?: string | null;
              }>;
            };
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;
            const finishReason = (parsed.choices?.[0] as { finish_reason?: string | null } | undefined)?.finish_reason;

            if (delta?.content) options.onChunk(delta.content);

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCallsByIndex[idx]) {
                  toolCallsByIndex[idx] = {
                    id: tc.id ?? `call_${idx}`,
                    name: tc.function?.name ?? "",
                    arguments: tc.function?.arguments ?? "",
                  };
                } else {
                  if (tc.id) toolCallsByIndex[idx].id = tc.id;
                  if (tc.function?.name) toolCallsByIndex[idx].name = tc.function.name;
                  if (tc.function?.arguments !== undefined)
                    toolCallsByIndex[idx].arguments += tc.function.arguments;
                }
              }
            }

            if (finishReason === "tool_calls") {
              emitAccumulatedToolCalls();
            }
          } catch {
            // skip
          }
        }
      }
    }
    emitAccumulatedToolCalls();
    callDone();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      callDone();
      return;
    }
    options.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
