import { useCallback, useRef, useState } from "react";
import type { Message } from "../types";
import type { AppConfig } from "../types";
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
      finalizeAssistant: (fullContent: string) => void
    ) => {
      if (!config?.base_url?.trim()) {
        setError("Set base URL in Settings.");
        return;
      }
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const baseUrl = config.base_url.trim();
      const model = (config.model?.trim() || "llama2").trim();
      const backend = (config.backend_type || "ollama") as "ollama" | "openai";
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
          signal
        );
      } else {
        await streamOpenAIChat(
          baseUrl,
          model,
          apiMessages,
          config.api_key?.trim() || null,
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
          signal
        );
      }
    },
    [config]
  );

  return { send, stop, error, streaming, setError };
}
