import { useCallback, useRef, useState } from "react";
import type { Message } from "../types";
import type { AppConfig } from "../types";
import { getEffectiveBaseUrl } from "../configHelpers";
import { RUNTIME_ADAPTERS } from "../api/adapters";
import { logger } from "../logging/logger";
import { toDisplayError } from "../errors/taxonomy";

export function useStreamingChat(config: AppConfig | null) {
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (
      _sessionId: number,
      messages: Message[],
      appendAssistantChunk: (chunk: string) => void,
      finalizeAssistant: (fullContent: string) => void,
      sessionOverride?: { model?: string | null; backend_type?: string | null },
      options?: {
        lastMessageImages?: { base64: string; mimeType?: string }[];
        extraSystemPrompt?: string;
      }
    ) => {
      if (!config) {
        setError(toDisplayError("No configuration."));
        return;
      }
      const baseUrl = getEffectiveBaseUrl(config);
      if (!baseUrl) {
        setError(toDisplayError("Set base URL in Settings."));
        return;
      }
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const modelRaw = sessionOverride?.model ?? config.model ?? "";
      const model = modelRaw.trim() || "llama2";
      const backendRaw = sessionOverride?.backend_type ?? config.backend_type ?? "";
      const backend =
        backendRaw === "ollama" ? "ollama" : backendRaw === "open_webui" ? "open_webui" : "openai";
      setError(null);
      setStreaming(true);
      let fullContent = "";
      const done = () => {
        setStreaming(false);
        abortRef.current = null;
        finalizeAssistant(fullContent);
      };
      void backend;

      let runtimeMessages = [...messages];
      const mergedSystemPrompt = [config.system_prompt?.trim(), options?.extraSystemPrompt?.trim()]
        .filter((v): v is string => !!v)
        .join("\n\n");
      if (mergedSystemPrompt) {
        runtimeMessages = [
          {
            id: -1,
            session_id: _sessionId,
            role: "system",
            content: mergedSystemPrompt,
            created_at: 0,
          },
          ...runtimeMessages,
        ];
      }

      const temperature = config.temperature != null ? config.temperature : undefined;
      const maxTokens = config.max_tokens != null ? config.max_tokens : undefined;

      const adapter =
        backend === "ollama"
          ? RUNTIME_ADAPTERS.ollama
          : backend === "open_webui"
            ? RUNTIME_ADAPTERS.open_webui
            : RUNTIME_ADAPTERS.openai;

      await adapter.streamChat(
        baseUrl,
        model,
        runtimeMessages,
        config,
        (chunk) => {
          fullContent += chunk;
          appendAssistantChunk(chunk);
        },
        done,
        (err) => {
          logger.error("streaming_chat_failed", { backend, message: err.message });
          setError(toDisplayError(err));
          setStreaming(false);
          abortRef.current = null;
        },
        {
          signal,
          temperature,
          maxTokens,
          lastMessageImages: options?.lastMessageImages,
        }
      );
    },
    [config]
  );

  return { send, stop, error, streaming, setError };
}
