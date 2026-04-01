import {
  fetchOpenAIModels,
  streamOpenAIChat,
  streamOpenAIChatWithTools,
  type OpenAIMessage,
  type OpenAIToolDef,
  type ParsedToolCall,
} from "./openai";

function normalizeApiPath(path?: string | null): string {
  const clean = (path ?? "/api").trim();
  if (!clean) return "/api";
  return clean.startsWith("/") ? clean.replace(/\/$/, "") : `/${clean.replace(/\/$/, "")}`;
}

function getModelPathCandidates(apiPath?: string | null): string[] {
  const prefix = normalizeApiPath(apiPath);
  return [`${prefix}/models`, "/v1/models"];
}

function getChatPathCandidates(apiPath?: string | null): string[] {
  const prefix = normalizeApiPath(apiPath);
  return [`${prefix}/chat/completions`, "/v1/chat/completions"];
}

async function firstSuccessful<T>(tasks: Array<() => Promise<T>>): Promise<T> {
  let lastError: Error | null = null;
  for (const task of tasks) {
    try {
      return await task();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("No successful Open WebUI endpoint.");
}

async function firstSuccessfulStream(tasks: Array<() => Promise<void>>): Promise<void> {
  let lastError: Error | null = null;
  for (const task of tasks) {
    try {
      await task();
      return;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("No successful Open WebUI streaming endpoint.");
}

function openWebUIHeaders(apiKey: string | null | undefined): Record<string, string> {
  if (!apiKey?.trim()) return {};
  return { Authorization: `Bearer ${apiKey.trim()}` };
}

export async function fetchOpenWebUIModels(
  baseUrl: string,
  apiKey?: string | null,
  apiPath?: string | null
): Promise<string[]> {
  const headers = openWebUIHeaders(apiKey);
  return firstSuccessful(
    getModelPathCandidates(apiPath).map((modelsPath) => () =>
      fetchOpenAIModels(baseUrl, null, {
        modelsPath,
        extraHeaders: headers,
      })
    )
  );
}

export async function streamOpenWebUIChat(
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
  apiPath?: string | null
): Promise<void> {
  const headers = openWebUIHeaders(apiKey);
  try {
    await firstSuccessfulStream(
      getChatPathCandidates(apiPath).map((chatCompletionsPath) => async () => {
        let callDone = false;
        await new Promise<void>((resolve, reject) => {
          void streamOpenAIChat(
            baseUrl,
            model,
            messages,
            null,
            onChunk,
            () => {
              callDone = true;
              onDone();
              resolve();
            },
            (err) => {
              reject(err);
            },
            signal,
            temperature,
            maxTokens,
            lastMessageImages,
            {
              chatCompletionsPath,
              extraHeaders: headers,
            }
          ).catch(reject);
        });
        if (!callDone) {
          throw new Error(`Open WebUI stream ended unexpectedly via ${chatCompletionsPath}`);
        }
      })
    );
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export interface StreamOpenWebUIWithToolsOptions {
  tools: OpenAIToolDef[];
  onChunk: (text: string) => void;
  onToolCalls: (calls: ParsedToolCall[]) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  lastMessageImages?: { base64: string; mimeType?: string }[];
  apiPath?: string | null;
}

export async function streamOpenWebUIChatWithTools(
  baseUrl: string,
  model: string,
  messages: OpenAIMessage[],
  apiKey: string | null,
  options: StreamOpenWebUIWithToolsOptions
): Promise<void> {
  const headers = openWebUIHeaders(apiKey);
  try {
    await firstSuccessfulStream(
      getChatPathCandidates(options.apiPath).map((chatCompletionsPath) => async () => {
        await new Promise<void>((resolve, reject) => {
          void streamOpenAIChatWithTools(baseUrl, model, messages, null, {
            ...options,
            onDone: () => {
              options.onDone();
              resolve();
            },
            onError: (err) => {
              reject(err);
            },
            requestOptions: {
              chatCompletionsPath,
              extraHeaders: headers,
            },
          }).catch(reject);
        });
      })
    );
  } catch (err) {
    options.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
