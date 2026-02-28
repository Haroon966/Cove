import { useCallback, useRef, useState } from "react";
import type { Message } from "../types";
import type { AppConfig } from "../types";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import { streamOllamaChat } from "../api/ollama";
import { streamOpenAIChat } from "../api/openai";

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
      options?: { lastMessageImages?: { base64: string; mimeType?: string }[] }
    ) => {
      if (!config) {
        setError("No configuration.");
        return;
      }
      const baseUrl = getEffectiveBaseUrl(config);
      if (!baseUrl) {
        setError("Set base URL in Settings.");
        return;
      }
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const modelRaw = sessionOverride?.model ?? config.model ?? "";
      const model = modelRaw.trim() || "llama2";
      const backendRaw = sessionOverride?.backend_type ?? config.backend_type ?? "";
      const backend = (backendRaw === "ollama" ? "ollama" : "openai") as "ollama" | "openai";
      setError(null);
      setStreaming(true);
      let fullContent = "";
      const done = () => {
        setStreaming(false);
        abortRef.current = null;
        finalizeAssistant(fullContent);
      };
      void backend;

      let apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
      const systemPrompt = config.system_prompt?.trim();
      if (systemPrompt) {
        apiMessages = [{ role: "system" as const, content: systemPrompt }, ...apiMessages];
      }

      const temperature = config.temperature != null ? config.temperature : undefined;
      const maxTokens = config.max_tokens != null ? config.max_tokens : undefined;

      const lastMessageImages = options?.lastMessageImages;
      const ollamaImages = lastMessageImages?.map((img) => img.base64);

      if (backend === "ollama") {
        await streamOllamaChat(
          baseUrl,
          model,
          apiMessages,
          (chunk) => {
            fullContent += chunk;
            appendAssistantChunk(chunk);
          },
          done,
          (err) => {
            setError(err.message);
            setStreaming(false);
            abortRef.current = null;
          },
          signal,
          temperature,
          maxTokens,
          ollamaImages
        );
      } else {
        await streamOpenAIChat(
          baseUrl,
          model,
          apiMessages,
          getEffectiveApiKey(config),
          (chunk) => {
            fullContent += chunk;
            appendAssistantChunk(chunk);
          },
          done,
          (err) => {
            setError(err.message);
            setStreaming(false);
            abortRef.current = null;
          },
          signal,
          temperature,
          maxTokens,
          lastMessageImages
        );
      }
    },
    [config]
  );

  return { send, stop, error, streaming, setError };
}
