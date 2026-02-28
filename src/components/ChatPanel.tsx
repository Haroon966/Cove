import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { Message, AppConfig } from "../types";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { getWordCompletion } from "../wordCompletion";
import { ArrowUp, Bot, Check, ChevronDown, Copy, Pencil, RefreshCw, Save, Square, X } from "./Icons";
import { MarkdownContent } from "./MarkdownContent";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

interface ChatPanelProps {
  sessionId: number | null;
  messages: Message[];
  streamingContent: string | null;
  streaming: boolean;
  error: string | null;
  config: AppConfig | null;
  effectiveModel?: string | null;
  onModelChange: (model: string) => void;
  onStop: () => void;
  onSend: (text: string) => void;
  onEditAndResend?: (messageId: number, newContent: string) => void;
  onRegenerateFrom?: (fromMessageId: number) => void;
  onCopyMessage?: (content: string) => void;
}

export function ChatPanel({
  sessionId,
  messages,
  streamingContent,
  streaming,
  error,
  config,
  onModelChange,
  onStop,
  onSend,
  onEditAndResend,
  onRegenerateFrom,
  onCopyMessage,
  effectiveModel,
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const mirrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (copiedKey === null) return;
    const t = setTimeout(() => setCopiedKey(null), 2000);
    return () => clearTimeout(t);
  }, [copiedKey]);

  const currentModel = effectiveModel ?? config?.model ?? null;

  const readFileAsText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  const handleFileAttach = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("text/") && !file.name.match(/\.(txt|md|json|xml|html|css|js|ts|tsx|jsx|py|rs|sh|yaml|yml)$/i)) {
        return;
      }
      try {
        const content = await readFileAsText(file);
        setAttachment({ name: file.name, content });
      } catch {
        // ignore read errors
      }
    },
    [readFileAsText]
  );

  const fetchModels = useCallback(() => {
    const url = config?.backend_type === "ollama" ? config?.base_url?.trim() : getEffectiveBaseUrl(config ?? null);
    if (!url) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    if (config?.backend_type === "ollama") {
      fetchOllamaModels(url)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, getEffectiveApiKey(config ?? null))
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [config]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && streaming) {
        e.preventDefault();
        onStop();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [streaming, onStop]);

  const ghostSuggestion = useMemo((): string => {
    if (streaming || !inputValue.trim()) return "";
    const lines = inputValue.split("\n");
    const currentLine = lines[lines.length - 1] ?? "";
    const fragment = currentLine.trim();
    if (fragment.length < 2) return "";
    return getWordCompletion(fragment);
  }, [inputValue, streaming]);

  useEffect(() => {
    if (inputRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = inputRef.current.scrollTop;
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, [inputValue, ghostSuggestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if ((!text && !attachment) || streaming) return;
    const fullText = attachment
      ? (text ? `${text}\n\n---\n[Attached: ${attachment.name}]\n\n${attachment.content}` : `[Attached: ${attachment.name}]\n\n${attachment.content}`)
      : text;
    onSend(fullText);
    setInputValue("");
    setAttachment(null);
  };

  return (
    <main className="chat-panel">
      <div className="messages">
        <div className="messages-inner">
          {messages.length === 0 && !streamingContent && !streaming && (
            <div className="welcome-screen" role="region" aria-label="Welcome">
              <div className="welcome-screen-logo">
                <img
                  src={`${import.meta.env.BASE_URL}cove-logo-color.png`}
                  alt=""
                  width={120}
                  height={120}
                  decoding="async"
                />
              </div>
              <h1 className="welcome-screen-title">Cove</h1>
              <p className="welcome-screen-tagline">Your Private Corner.</p>
              <p className="welcome-screen-hint">Type a message below to start the conversation.</p>
            </div>
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
                  <div className="message-meta">
                    <span>{formatTime(m.created_at)}</span>
                    <div className="message-actions">
                      {onCopyMessage && (
                        <button
                          type="button"
                          className="message-action-btn"
                          onClick={() => {
                            onCopyMessage(m.content);
                            setCopiedKey(m.id ? `msg-${m.id}` : `msg-${index}`);
                          }}
                          title={copiedKey === (m.id ? `msg-${m.id}` : `msg-${index}`) ? "Copied" : "Copy"}
                          aria-label={copiedKey === (m.id ? `msg-${m.id}` : `msg-${index}`) ? "Copied" : "Copy message"}
                        >
                          {copiedKey === (m.id ? `msg-${m.id}` : `msg-${index}`) ? (
                            <Check size={14} strokeWidth={2} />
                          ) : (
                            <Copy size={14} strokeWidth={2} />
                          )}
                        </button>
                      )}
                      {onRegenerateFrom && sessionId !== null && m.id && !streaming && (
                        <button
                          type="button"
                          className="message-action-btn"
                          onClick={() => onRegenerateFrom(m.id)}
                          title="Regenerate"
                          aria-label="Regenerate response"
                        >
                          <RefreshCw size={14} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : editingMessageId === m.id ? (
              <div
                key={m.id ? `msg-${m.id}` : `msg-temp-${index}-${m.created_at}-${m.role}`}
                className="message message-user message-editing"
              >
                <div className="message-user-inner">
                  <textarea
                    className="message-edit-textarea"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={4}
                    aria-label="Edit message"
                  />
                  <div className="message-edit-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => {
                        setEditingMessageId(null);
                        setEditingContent("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-small"
                      onClick={() => {
                        const trimmed = editingContent.trim();
                        if (trimmed && onEditAndResend && m.id) {
                          onEditAndResend(m.id, trimmed);
                          setEditingMessageId(null);
                          setEditingContent("");
                        }
                      }}
                    >
                      <Save size={14} strokeWidth={2} /> Save & regenerate
                    </button>
                  </div>
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
                  <div className="message-meta">
                    <span>You · {formatTime(m.created_at)}</span>
                    {onEditAndResend && sessionId !== null && m.id && !streaming && (
                      <button
                        type="button"
                        className="message-action-btn"
                        onClick={() => {
                          setEditingMessageId(m.id);
                          setEditingContent(m.content);
                        }}
                        title="Edit"
                        aria-label="Edit message"
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                    )}
                  </div>
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
                <div className="message-meta">
                  <span>Thinking...</span>
                  {onCopyMessage && (
                    <button
                      type="button"
                      className="message-action-btn"
                      onClick={() => {
                        onCopyMessage(streamingContent);
                        setCopiedKey("streaming");
                      }}
                      title={copiedKey === "streaming" ? "Copied" : "Copy"}
                      aria-label={copiedKey === "streaming" ? "Copied" : "Copy message"}
                    >
                      {copiedKey === "streaming" ? (
                        <Check size={14} strokeWidth={2} />
                      ) : (
                        <Copy size={14} strokeWidth={2} />
                      )}
                    </button>
                  )}
                </div>
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
          <form
            className="input-row"
            onSubmit={handleSubmit}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer?.files?.[0];
              if (file) handleFileAttach(file);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {attachment && (
              <div className="input-attachment">
                <span className="input-attachment-name">Attached: {attachment.name}</span>
                <button
                  type="button"
                  className="input-attachment-remove"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="input-text-wrap">
              <div
                ref={mirrorRef}
                className="input-text-mirror"
                aria-hidden
              >
                {inputValue}
                {ghostSuggestion ? <span className="ghost-text">{ghostSuggestion}</span> : null}
              </div>
              <textarea
                ref={inputRef}
                className="input-text"
                placeholder="Type your message here... (or paste/drop a text file)"
                rows={2}
                disabled={streaming}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onScroll={() => {
                  if (inputRef.current && mirrorRef.current) {
                    mirrorRef.current.scrollTop = inputRef.current.scrollTop;
                    mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                    return;
                  }
                  if ((e.key === "Tab" || e.key === "ArrowRight") && ghostSuggestion) {
                    e.preventDefault();
                    const start = inputRef.current?.selectionStart ?? inputValue.length;
                    const end = inputRef.current?.selectionEnd ?? inputValue.length;
                    const newVal = inputValue.slice(0, start) + ghostSuggestion + inputValue.slice(end);
                    setInputValue(newVal);
                    const newCursor = start + ghostSuggestion.length;
                    setTimeout(() => {
                      inputRef.current?.setSelectionRange(newCursor, newCursor);
                    }, 0);
                  }
                }}
                onPaste={(e) => {
                  const file = e.clipboardData?.files?.[0];
                  if (file) {
                    e.preventDefault();
                    handleFileAttach(file);
                  }
                }}
              />
            </div>
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
