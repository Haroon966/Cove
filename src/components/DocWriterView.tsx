import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { AppConfig, Message } from "../types";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { ArrowUp, Square } from "./Icons";
import { MarkdownContent } from "./MarkdownContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  const [_models, setModels] = useState<string[]>([]);
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
    return () => { cancelled = true; };
  }, []);

  const docSystemPrompt = useMemo(() => {
    const parts = [DOC_WRITER_SYSTEM_PROMPT_BASE];
    if (skillContent) parts.push("Follow these guidelines when creating the document:\n\n" + skillContent);
    if (config?.system_prompt?.trim()) parts.push(config.system_prompt.trim());
    return parts.filter(Boolean).join("\n\n");
  }, [skillContent, config?.system_prompt]);

  const docConfig: AppConfig | null = config ? { ...config, system_prompt: docSystemPrompt } : null;

  const { send, stop, error, streaming, setError } = useStreamingChat(docConfig);

  const currentModel = config?.model ?? null;

  const fetchModels = useCallback(() => {
    const url = config?.backend_type === "ollama" ? config?.base_url?.trim() : getEffectiveBaseUrl(config ?? null);
    if (!url) { setModels([]); return; }
    setLoadingModels(true);
    if (config?.backend_type === "ollama") {
      fetchOllamaModels(url).then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, getEffectiveApiKey(config ?? null)).then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    }
  }, [config]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

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
      id: 0, session_id: 0, role: "user", content: text, created_at: Math.floor(Date.now() / 1000),
    };
    const newMessages = [...docMessages, userMessage];
    setDocMessages(newMessages);
    let streamed = "";
    setStreamingContent("");
    setError(null);
    await send(
      0, newMessages,
      (chunk) => { streamed += chunk; setStreamingContent(streamed); },
      (fullContent) => {
        setStreamingContent(null);
        setDocContent(fullContent);
        setDocMessages((prev) => [...prev, { id: 0, session_id: 0, role: "assistant", content: fullContent, created_at: Math.floor(Date.now() / 1000) }]);
      }
    );
  }, [inputValue, docMessages, docConfig, streaming, send, setError]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void handleSend(); };

  const CoveIcon = ({ className }: { className?: string }) => (
    <span
      className={cn("inline-block w-4 h-4 shrink-0", className)}
      style={{
        background: "hsl(var(--primary))",
        WebkitMaskImage: `url(${import.meta.env.BASE_URL}cove-icon.svg)`,
        maskImage: `url(${import.meta.env.BASE_URL}cove-icon.svg)`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
      aria-hidden
    />
  );

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* AI chat panel */}
      <div className="flex flex-col w-80 shrink-0 border-r border-border bg-card">
        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {docMessages.length === 0 && !streamingContent && !streaming && (
              <p className="text-sm text-muted-foreground text-center py-8 px-2">
                Ask the AI to write or edit your document. The reply will appear in the document panel.
              </p>
            )}
            {docMessages.map((m, index) => (
              <div key={`${m.role}-${index}-${m.created_at}`} className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CoveIcon />
                  </div>
                )}
                <div className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground"
                )}>
                  {m.role === "user"
                    ? <p>{m.content}</p>
                    : <MarkdownContent content={m.content} className="markdown-content" />
                  }
                </div>
              </div>
            ))}
            {streaming && streamingContent && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <CoveIcon />
                </div>
                <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground max-w-[85%]">
                  <MarkdownContent content={streamingContent} className="markdown-content" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border p-3 space-y-2">
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <div className="text-xs text-muted-foreground truncate px-0.5">
            {loadingModels ? "Loading models…" : (currentModel ?? "No model selected")}
          </div>
          <form className="flex items-end gap-2" onSubmit={handleSubmit}>
            <Textarea
              ref={inputRef}
              placeholder="Ask AI to write or edit the document…"
              rows={2}
              disabled={streaming}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
              }}
              aria-label="Message to AI"
              className="min-h-[56px] max-h-32 resize-none text-sm py-2"
            />
            {streaming ? (
              <Button type="button" size="icon" variant="destructive" className="h-9 w-9 shrink-0" onClick={stop} aria-label="Stop">
                <Square size={16} strokeWidth={2} />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="Send" disabled={!inputValue.trim()}>
                <ArrowUp size={16} strokeWidth={2} />
              </Button>
            )}
          </form>
        </div>
      </div>

      {/* Document panel */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0">
          <div className="flex rounded-md border border-border overflow-hidden" role="tablist" aria-label="Document view">
            <button
              type="button"
              role="tab"
              aria-selected={docViewMode === "code"}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                docViewMode === "code"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setDocViewMode("code")}
            >
              Code
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={docViewMode === "preview"}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors border-l border-border",
                docViewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setDocViewMode("preview")}
            >
              Preview
            </button>
          </div>
          <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={handleNewDocument}>
            New document
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {docViewMode === "code" ? (
            <textarea
              className="w-full h-full resize-none bg-background text-foreground text-sm font-mono p-4 outline-none border-0 focus:ring-0"
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Document content (Markdown). Use the AI panel to generate or edit."
              spellCheck={false}
              aria-label="Document markdown source"
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="max-w-3xl mx-auto px-8 py-6">
                <MarkdownContent content={docContent || "*Nothing to preview yet.*"} className="markdown-content" />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
