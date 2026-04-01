import type { Message } from "../types";
import { getEffectiveApiKey } from "../configHelpers";
import { streamOllamaChat } from "./ollama";
import { streamOpenAIChat } from "./openai";
import { streamOpenWebUIChat } from "./openwebui";
import type { RuntimeAdapter } from "./runtimeAdapter";

function toApiMessages(messages: Message[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export const RUNTIME_ADAPTERS: Record<string, RuntimeAdapter> = {
  ollama: {
    id: "ollama",
    async streamChat(baseUrl, model, messages, _config, onChunk, onDone, onError, options) {
      await streamOllamaChat(
        baseUrl,
        model,
        toApiMessages(messages),
        onChunk,
        onDone,
        onError,
        options?.signal,
        options?.temperature,
        options?.maxTokens,
        options?.lastMessageImages?.map((i) => i.base64)
      );
    },
  },
  open_webui: {
    id: "open_webui",
    async streamChat(baseUrl, model, messages, config, onChunk, onDone, onError, options) {
      await streamOpenWebUIChat(
        baseUrl,
        model,
        toApiMessages(messages),
        getEffectiveApiKey(config),
        onChunk,
        onDone,
        onError,
        options?.signal,
        options?.temperature,
        options?.maxTokens,
        options?.lastMessageImages,
        config.openwebui_api_path
      );
    },
  },
  openai: {
    id: "openai",
    async streamChat(baseUrl, model, messages, config, onChunk, onDone, onError, options) {
      await streamOpenAIChat(
        baseUrl,
        model,
        toApiMessages(messages),
        getEffectiveApiKey(config),
        onChunk,
        onDone,
        onError,
        options?.signal,
        options?.temperature,
        options?.maxTokens,
        options?.lastMessageImages
      );
    },
  },
};

