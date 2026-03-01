import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { AppConfig, Message } from "../types";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { ArrowUp, Bot, Square } from "./Icons";
import { MarkdownContent } from "./MarkdownContent";

const DOC_WRITER_SYSTEM_PROMPT_BASE =
  "You are a document writer. Reply only with the document content in Markdown. Do not add commentary or explanations outside the document.";

const SKILL_MD_URL = `${import.meta.env.BASE_URL}skill.md`;

interface DocWriterViewProps {
  config: AppConfig | null;
}

export function DocWriterView({ config }: DocWriterViewProps) {
  const [docContent, setDocContent] = useState("");
  const [docViewMode, setDocViewMode] = useState<"code" | "preview">("code");
  const [docMessages, setDocMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(SKILL_MD_URL)
      .then((res) => (res.ok ? res.text() : Promise.resolve("")))
      .then((text) => {
        if (!cancelled && text.trim()) setSkillContent(text.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const docSystemPrompt = useMemo(() => {
    const parts = [DOC_WRITER_SYSTEM_PROMPT_BASE];
    if (skillContent) {
      parts.push("Follow these guidelines when creating the document:\n\n" + skillContent);
    }
    if (config?.system_prompt?.trim()) {
      parts.push(config.system_prompt.trim());
    }
    return parts.filter(Boolean).join("\n\n");
  }, [skillContent, config?.system_prompt]);

  const docConfig: AppConfig | null = config
    ? {
        ...config,
        system_prompt: docSystemPrompt,
      }
    : null;

  const { send, stop, error, streaming, setError } = useStreamingChat(docConfig);

  const currentModel = config?.model ?? null;

  const fetchModels = useCallback(() => {
    const url =
      config?.backend_type === "ollama" ? config?.base_url?.trim() : getEffectiveBaseUrl(config ?? null);
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
  }, [docMessages, streamingContent]);

  const handleNewDocument = useCallback(() => {
    setDocContent("");
    setDocMessages([]);
    setStreamingContent(null);
    setInputValue("");
    setError(null);
  }, [setError]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !docConfig || streaming) return;

    setInputValue("");
    const userMessage: Message = {
      id: 0,
      session_id: 0,
      role: "user",
      content: text,
      created_at: Math.floor(Date.now() / 1000),
    };
    const newMessages = [...docMessages, userMessage];
    setDocMessages(newMessages);

    let streamed = "";
    setStreamingContent("");
    setError(null);

    await send(
      0,
      newMessages,
      (chunk) => {
        streamed += chunk;
        setStreamingContent(streamed);
      },
      (fullContent) => {
        setStreamingContent(null);
        setDocContent(fullContent);
        setDocMessages((prev) => [
          ...prev,
          {
            id: 0,
            session_id: 0,
            role: "assistant",
            content: fullContent,
            created_at: Math.floor(Date.now() / 1000),
          },
        ]);
      }
    );
  }, [inputValue, docMessages, docConfig, streaming, send, setError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSend();
  };

  return (
    <div className="doc-writer">
      <div className="doc-writer-ai">
        <div className="doc-writer-messages">
          {docMessages.length === 0 && !streamingContent && !streaming && (
            <p className="doc-writer-hint">Ask the AI to write or edit your document. The reply will appear in the document.</p>
          )}
          {docMessages.map((m, index) => (
            <div
              key={`${m.role}-${index}-${m.created_at}`}
              className={"doc-writer-msg doc-writer-msg-" + m.role}
            >
              {m.role === "assistant" && (
                <span className="doc-writer-msg-icon" aria-hidden>
                  <Bot size={14} strokeWidth={2} />
                </span>
              )}
              <div className="doc-writer-msg-body">
                {m.role === "user" ? (
                  <p className="doc-writer-msg-text">{m.content}</p>
                ) : (
                  <MarkdownContent content={m.content} className="doc-writer-msg-md" />
                )}
              </div>
            </div>
          ))}
          {streaming && streamingContent && (
            <div className="doc-writer-msg doc-writer-msg-assistant">
              <span className="doc-writer-msg-icon" aria-hidden>
                <Bot size={14} strokeWidth={2} />
              </span>
              <div className="doc-writer-msg-body">
                <MarkdownContent content={streamingContent} className="doc-writer-msg-md" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="doc-writer-input-wrap">
          {error && (
            <p className="doc-writer-error" role="alert">
              {error}
            </p>
          )}
          <div className="doc-writer-input-row">
            <select
              className="doc-writer-model-select"
              value={currentModel ?? ""}
              disabled
              title="Model (change in Settings)"
              aria-label="Current model"
            >
              {loadingModels && <option value="">Loading…</option>}
              {!loadingModels && (models.length === 0 ? <option value={currentModel ?? ""}>{currentModel || "Model"}</option> : models.map((m) => <option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <form className="doc-writer-form" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="doc-writer-textarea-input"
              placeholder="Ask AI to write or edit the document…"
              rows={2}
              disabled={streaming}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              aria-label="Message to AI"
            />
            {streaming ? (
              <button type="button" className="doc-writer-btn doc-writer-btn-stop" onClick={stop} aria-label="Stop">
                <Square size={16} strokeWidth={2} />
              </button>
            ) : (
              <button type="submit" className="doc-writer-btn doc-writer-btn-send" aria-label="Send">
                <ArrowUp size={16} strokeWidth={2} />
              </button>
            )}
          </form>
        </div>
      </div>
      <div className="doc-writer-doc">
        <div className="doc-writer-toolbar">
          <div className="doc-writer-toggle" role="tablist" aria-label="Document view">
            <button
              type="button"
              role="tab"
              aria-selected={docViewMode === "code"}
              className={"doc-writer-toggle-btn" + (docViewMode === "code" ? " active" : "")}
              onClick={() => setDocViewMode("code")}
            >
              Code
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={docViewMode === "preview"}
              className={"doc-writer-toggle-btn" + (docViewMode === "preview" ? " active" : "")}
              onClick={() => setDocViewMode("preview")}
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            className="doc-writer-new-btn"
            onClick={handleNewDocument}
            title="New document"
          >
            New document
          </button>
        </div>
        <div className="doc-writer-content">
          {docViewMode === "code" ? (
            <textarea
              className="doc-writer-textarea"
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Document content (Markdown). Use the AI panel to generate or edit."
              spellCheck={false}
              aria-label="Document markdown source"
            />
          ) : (
            <div className="doc-writer-preview">
              <MarkdownContent content={docContent || "*Nothing to preview yet.*"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
