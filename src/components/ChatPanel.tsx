import { useRef, useEffect, useState, useCallback } from "react";
import type { Message, AppConfig } from "../types";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { ArrowUp, Bot, ChevronDown, Square } from "./Icons";
import { MarkdownContent } from "./MarkdownContent";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

interface ChatPanelProps {
  messages: Message[];
  streamingContent: string | null;
  streaming: boolean;
  error: string | null;
  config: AppConfig | null;
  onModelChange: (model: string) => void;
  onStop: () => void;
  onSend: (text: string) => void;
}

export function ChatPanel({
  messages,
  streamingContent,
  streaming,
  error,
  config,
  onModelChange,
  onStop,
  onSend,
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const currentModel = config?.model ?? null;

  const fetchModels = useCallback(() => {
    if (!config?.base_url?.trim()) {
      setModels([]);
      return;
    }
    const url = config.base_url.trim();
    setLoadingModels(true);
    if (config.backend_type === "ollama") {
      fetchOllamaModels(url)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, config.api_key)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [config?.base_url, config?.backend_type, config?.api_key]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputRef.current?.value?.trim();
    if (!text || streaming) return;
    onSend(text);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="chat-panel">
      <div className="messages">
        <div className="messages-inner">
          {messages.length === 0 && !streamingContent && !streaming && (
            <p className="messages-empty">Send a message to start.</p>
          )}
          {messages.map((m, index) =>
            m.role === "assistant" ? (
              <div
                key={m.id ? `msg-${m.id}` : `msg-temp-${index}-${m.created_at}-${m.role}`}
                className="message message-assistant"
              >
                <div className="message-assistant-icon" aria-hidden><Bot size={20} strokeWidth={2} /></div>
                <div className="message-assistant-content">
                  <div className="message-text">
                    <MarkdownContent content={m.content} />
                  </div>
                  <div className="message-meta">{formatTime(m.created_at)}</div>
                </div>
              </div>
            ) : (
              <div
                key={m.id ? `msg-${m.id}` : `msg-temp-${index}-${m.created_at}-${m.role}`}
                className="message message-user"
              >
                <div className="message-user-inner">
                  <div className="message-text">
                    <MarkdownContent content={m.content} />
                  </div>
                  <div className="message-meta">You · {formatTime(m.created_at)}</div>
                </div>
              </div>
            )
          )}
          {streamingContent !== null && (
            <div className="message message-assistant">
              <div className="message-assistant-icon" aria-hidden><Bot size={20} strokeWidth={2} /></div>
              <div className="message-assistant-content">
                <div className="message-text">
                  <MarkdownContent content={streamingContent} />
                  {streaming && <span className="cursor">▌</span>}
                </div>
                <div className="message-meta">Thinking...</div>
              </div>
            </div>
          )}
          {error && (
            <div className="message-error" role="alert">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="input-wrapper">
        <div className="input-container">
          <div className="input-bar">
            <div className="input-bar-model-wrap">
              <span className="input-bar-model-dot" aria-hidden />
              <select
                className="input-bar-model-select"
                value={currentModel ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onModelChange(v);
                }}
                disabled={streaming || loadingModels}
                title="Change model"
                aria-label="Select model"
              >
                {loadingModels && (
                  <option value="">Loading models…</option>
                )}
                {!loadingModels && models.length === 0 && (
                  <option value={currentModel ?? ""}>
                    {currentModel || "Set in Settings"}
                  </option>
                )}
                {!loadingModels && models.length > 0 && (() => {
                  const hasCurrent = currentModel && models.includes(currentModel);
                  return (
                    <>
                      {!currentModel && (
                        <option value="">Select model</option>
                      )}
                      {currentModel && !hasCurrent && (
                        <option value={currentModel}>{currentModel}</option>
                      )}
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </>
                  );
                })()}
              </select>
              <ChevronDown size={14} strokeWidth={2} className="input-bar-model-chevron" aria-hidden />
            </div>
          </div>
          <form className="input-row" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="input-text"
              placeholder="Type your message here..."
              rows={2}
              disabled={streaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            {streaming ? (
              <button
                type="button"
                className="btn-stop"
                onClick={onStop}
                aria-label="Stop generating"
              >
                <Square size={18} strokeWidth={2} /> Stop
              </button>
            ) : (
              <button type="submit" className="btn-send" aria-label="Send">
                <ArrowUp size={18} strokeWidth={2} />
              </button>
            )}
          </form>
        </div>
        <p className="input-footer">Cove · No data sent online</p>
      </div>
    </main>
  );
}
