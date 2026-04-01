import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { Message, AppConfig, Attachment } from "../types";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "../configHelpers";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { fetchOpenWebUIModels } from "../api/openwebui";
import { useVisionCapability } from "../hooks/useVisionCapability";
import { getWordCompletion } from "../wordCompletion";
import {
  ArrowUp, Bot, Check, ChevronDown, Copy, Paperclip, Pencil,
  Play, RefreshCw, Save, Square, X, Mic
} from "./Icons";
import { MarkdownContent } from "./MarkdownContent";
import { transcribeAudioWithCurrentConfig } from "../api/stt";
import { supportsProviderCapability } from "../agent/runtime/providerRegistry";
import { BUILT_IN_SKILLS } from "../features/skills/skillsCatalog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ToolMessageBlock({ name, content }: { name: string; content: string }) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 150 ? content.slice(0, 150) + "…" : content;
  const hasMore = content.length > 150;
  return (
    <div className="flex justify-start px-4 my-1">
      <div className="max-w-[80%] rounded-lg border border-border bg-muted/50 text-sm overflow-hidden">
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/80 transition-colors"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span className="font-mono text-xs font-semibold text-primary truncate">{name}</span>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={cn("ml-auto shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {open && (
          <pre className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto max-h-64">
            {content}
          </pre>
        )}
        {!open && hasMore && (
          <p className="px-3 pb-2 text-xs text-muted-foreground">{preview}</p>
        )}
        {!open && !hasMore && (
          <p className="px-3 pb-2 text-xs text-muted-foreground">{content}</p>
        )}
      </div>
    </div>
  );
}

interface MessageActionButtonProps {
  onClick: () => void;
  title: string;
  label: string;
  children: React.ReactNode;
}

function MessageActionButton({ onClick, title, label, children }: MessageActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="p-1 rounded text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  );
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
  onSend: (text: string, attachment?: Attachment | null) => void;
  onEditAndResend?: (messageId: number, newContent: string) => void;
  onRegenerateFrom?: (fromMessageId: number) => void;
  onBranchFrom?: (fromMessageId: number) => void;
  onCreateArtifactFromMessage?: (messageId: number, content: string) => void;
  onSpeakMessage?: (content: string) => void;
  onCopyMessage?: (content: string) => void;
  agentMode?: boolean;
  onAgentModeChange?: (on: boolean) => void;
  activeSkillIds?: string[];
  recommendedSkillIds?: string[];
  onToggleSkillOverride?: (skillId: string, enabled: boolean) => void;
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
  onBranchFrom,
  onCreateArtifactFromMessage,
  onSpeakMessage,
  onCopyMessage,
  effectiveModel,
  agentMode = false,
  onAgentModeChange,
  activeSkillIds = [],
  recommendedSkillIds = [],
  onToggleSkillOverride,
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [imageSendBlocked, setImageSendBlocked] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [sttBusy, setSttBusy] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);

  const currentModel = effectiveModel ?? config?.model ?? null;
  const enabledSkillIds = useMemo(
    () => new Set(config?.enabled_skills ?? []),
    [config?.enabled_skills]
  );
  const { supportsVision } = useVisionCapability(config, currentModel);
  const supportsStt = supportsProviderCapability(config?.backend_type, "audio_stt");

  useEffect(() => {
    if (attachment?.type !== "image") setImageSendBlocked(false);
  }, [attachment?.type]);

  useEffect(() => {
    if (copiedKey === null) return;
    const t = setTimeout(() => setCopiedKey(null), 2000);
    return () => clearTimeout(t);
  }, [copiedKey]);

  const readFileAsText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  const readFileAsDataURL = useCallback((file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          resolve({ mimeType: match[1], base64: match[2] });
        } else {
          reject(new Error("Invalid data URL"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileAttach = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isText =
        file.type.startsWith("text/") ||
        /\.(txt|md|json|xml|html|css|js|ts|tsx|jsx|py|rs|sh|yaml|yml)$/i.test(file.name);
      if (isImage) {
        try {
          const { base64, mimeType } = await readFileAsDataURL(file);
          setAttachment({ type: "image", name: file.name, dataBase64: base64, mimeType });
        } catch { /* ignore */ }
        return;
      }
      if (isText) {
        try {
          const content = await readFileAsText(file);
          setAttachment({ type: "text", name: file.name, content });
        } catch { /* ignore */ }
      }
    },
    [readFileAsText, readFileAsDataURL]
  );

  const fetchModels = useCallback(() => {
    const url =
      config?.backend_type === "ollama"
        ? config?.base_url?.trim()
        : getEffectiveBaseUrl(config ?? null);
    if (!url) { setModels([]); return; }
    setLoadingModels(true);
    if (config?.backend_type === "ollama") {
      fetchOllamaModels(url).then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    } else if (config?.backend_type === "open_webui") {
      fetchOpenWebUIModels(url, getEffectiveApiKey(config ?? null), config?.openwebui_api_path)
        .then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, getEffectiveApiKey(config ?? null))
        .then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    }
  }, [config]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && streaming) { e.preventDefault(); onStop(); }
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
    }
  }, [inputValue, ghostSuggestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if ((!text && !attachment) || streaming) return;
    if (attachment?.type === "image" && !supportsVision) { setImageSendBlocked(true); return; }
    setImageSendBlocked(false);
    if (attachment?.type === "text") {
      const fullText = text
        ? `${text}\n\n---\n[Attached: ${attachment.name}]\n\n${attachment.content}`
        : `[Attached: ${attachment.name}]\n\n${attachment.content}`;
      onSend(fullText, attachment);
    } else if (attachment?.type === "image") {
      onSend(text || " [Image attached]", attachment);
    } else {
      onSend(text);
    }
    setInputValue("");
    setAttachment(null);
  };

  const handleAudioTranscribe = useCallback(
    async (file: File) => {
      if (!config) return;
      setSttBusy(true);
      setSttError(null);
      try {
        const text = await transcribeAudioWithCurrentConfig(config, file);
        setInputValue((prev) => (prev ? `${prev}\n${text}` : text));
      } catch (e) {
        setSttError(e instanceof Error ? e.message : String(e));
      } finally {
        setSttBusy(false);
      }
    },
    [config]
  );

  const assistantIcon = (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
      <span
        className="w-4 h-4 block"
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
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <main className="flex flex-col flex-1 overflow-hidden bg-background">
        {/* Message list */}
        <ScrollArea className="flex-1">
          <div
            className="max-w-3xl mx-auto px-4 py-6 space-y-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {/* Welcome screen */}
            {messages.length === 0 && !streamingContent && !streaming && (
              <div className="flex flex-col items-center justify-center py-20 text-center" role="region" aria-label="Welcome">
                <img
                  src={`${import.meta.env.BASE_URL}cove-logo-color.png`}
                  alt=""
                  width={72}
                  height={72}
                  decoding="async"
                  className="mb-4 opacity-90"
                />
                <h1 className="text-2xl font-semibold text-foreground mb-1">Cove</h1>
                <p className="text-sm text-muted-foreground">Your Private Corner. Start typing below.</p>
              </div>
            )}

            {/* Open WebUI info */}
            {messages.length === 0 && config?.backend_type === "open_webui" && (
              <div className="flex gap-3 items-start">
                {assistantIcon}
                <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                  Open WebUI mode is active.
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((m, index) => {
              const key = m.id ? `msg-${m.id}` : `msg-temp-${index}-${m.created_at}-${m.role}`;

              if (m.role === "tool") {
                return (
                  <ToolMessageBlock
                    key={key}
                    name={m.tool_name ?? "tool"}
                    content={m.content}
                  />
                );
              }

              if (m.role === "assistant") {
                const msgKey = m.id ? `msg-${m.id}` : `msg-${index}`;
                return (
                  <div key={key} className="flex gap-3 items-start group">
                    {assistantIcon}
                    <div className="flex-1 min-w-0">
                      <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="markdown-content text-sm leading-relaxed text-foreground">
                          <MarkdownContent content={m.content} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground mr-1">{formatTime(m.created_at)}</span>
                        {onCopyMessage && (
                          <MessageActionButton
                            onClick={() => { onCopyMessage(m.content); setCopiedKey(msgKey); }}
                            title={copiedKey === msgKey ? "Copied!" : "Copy"}
                            label="Copy message"
                          >
                            {copiedKey === msgKey ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                          </MessageActionButton>
                        )}
                        {onRegenerateFrom && sessionId !== null && m.id && !streaming && (
                          <MessageActionButton onClick={() => onRegenerateFrom(m.id)} title="Regenerate" label="Regenerate response">
                            <RefreshCw size={13} strokeWidth={2} />
                          </MessageActionButton>
                        )}
                        {onBranchFrom && sessionId !== null && m.id && !streaming && (
                          <MessageActionButton onClick={() => onBranchFrom(m.id)} title="Branch from here" label="Create branch">
                            <Bot size={13} strokeWidth={2} />
                          </MessageActionButton>
                        )}
                        {onCreateArtifactFromMessage && sessionId !== null && m.id && !streaming && (
                          <MessageActionButton
                            onClick={() => onCreateArtifactFromMessage(m.id!, m.content)}
                            title="Save as artifact"
                            label="Save as artifact"
                          >
                            <Save size={13} strokeWidth={2} />
                          </MessageActionButton>
                        )}
                        {onSpeakMessage && !streaming && (
                          <MessageActionButton onClick={() => onSpeakMessage(m.content)} title="Read aloud" label="Read aloud">
                            <Play size={13} strokeWidth={2} />
                          </MessageActionButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              /* User message */
              if (editingMessageId === m.id) {
                return (
                  <div key={key} className="flex justify-end">
                    <div className="w-full max-w-xl space-y-2">
                      <Textarea
                        className="text-sm resize-none"
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={3}
                        aria-label="Edit message"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditingMessageId(null); setEditingContent(""); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const trimmed = editingContent.trim();
                            if (trimmed && onEditAndResend && m.id) {
                              onEditAndResend(m.id, trimmed);
                              setEditingMessageId(null);
                              setEditingContent("");
                            }
                          }}
                        >
                          <Save size={13} className="mr-1.5" />
                          Save & regenerate
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} className="flex justify-end group">
                  <div className="flex flex-col items-end max-w-[80%]">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                      <div className="markdown-content leading-relaxed">
                        <MarkdownContent content={m.content} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-muted-foreground">{formatTime(m.created_at)}</span>
                      {onEditAndResend && sessionId !== null && m.id && !streaming && (
                        <MessageActionButton
                          onClick={() => { setEditingMessageId(m.id); setEditingContent(m.content); }}
                          title="Edit"
                          label="Edit message"
                        >
                          <Pencil size={13} strokeWidth={2} />
                        </MessageActionButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Streaming message */}
            {streamingContent !== null && (
              <div className="flex gap-3 items-start">
                {assistantIcon}
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="markdown-content text-sm leading-relaxed text-foreground" aria-live="polite" aria-atomic="false">
                      <MarkdownContent content={streamingContent} />
                      {streaming && <span className="streaming-cursor" aria-hidden />}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1 pl-1">
                    <span className="text-xs text-muted-foreground">Generating…</span>
                    {onCopyMessage && streamingContent && (
                      <MessageActionButton
                        onClick={() => { onCopyMessage(streamingContent); setCopiedKey("streaming"); }}
                        title={copiedKey === "streaming" ? "Copied!" : "Copy"}
                        label="Copy message"
                      >
                        {copiedKey === "streaming" ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                      </MessageActionButton>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Agent browser notice */}
            {agentMode && typeof window !== "undefined" && !(window as unknown as { __TAURI__?: unknown }).__TAURI__ && (
              <p className="text-xs text-muted-foreground text-center bg-muted/50 rounded-lg px-3 py-2" role="status">
                Agent mode: no tools available in browser. Use the desktop app for agent tools.
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg px-4 py-3" role="alert">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-2">
              {/* Model selector */}
              <div className="relative flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2 shrink-0" aria-hidden />
                <select
                  className="h-7 text-xs bg-transparent border-0 text-muted-foreground hover:text-foreground focus:text-foreground cursor-pointer pr-5 pl-0 outline-none appearance-none"
                  value={currentModel ?? ""}
                  onChange={(e) => { const v = e.target.value; if (v) onModelChange(v); }}
                  disabled={streaming || loadingModels}
                  aria-label="Select model"
                >
                  {loadingModels && <option value="">Loading models…</option>}
                  {!loadingModels && models.length === 0 && (
                    <option value={currentModel ?? ""}>{currentModel || "Set model in Settings"}</option>
                  )}
                  {!loadingModels && models.length > 0 && (() => {
                    const hasCurrent = currentModel && models.includes(currentModel);
                    return (
                      <>
                        {!currentModel && <option value="">Select model</option>}
                        {currentModel && !hasCurrent && <option value={currentModel}>{currentModel}</option>}
                        {models.map((mdl) => <option key={mdl} value={mdl}>{mdl}</option>)}
                      </>
                    );
                  })()}
                </select>
                <ChevronDown size={11} strokeWidth={2} className="pointer-events-none absolute right-0 text-muted-foreground" aria-hidden />
              </div>

              {/* Agent mode toggle */}
              {onAgentModeChange && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="agent-mode"
                    checked={agentMode}
                    onCheckedChange={onAgentModeChange}
                    className="h-4 w-7 data-[state=checked]:bg-primary"
                    aria-label="Agent mode"
                  />
                  <Label htmlFor="agent-mode" className="text-xs text-muted-foreground cursor-pointer">
                    Agent
                  </Label>
                </div>
              )}
            </div>

            {(activeSkillIds.length > 0 || recommendedSkillIds.length > 0) && (
              <div className="mb-2 space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Skills this turn:{" "}
                  {activeSkillIds.length > 0
                    ? `${activeSkillIds.length} active`
                    : "none active"}
                  {recommendedSkillIds.length > 0
                    ? `, ${recommendedSkillIds.length} recommended`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...activeSkillIds, ...recommendedSkillIds])).map((skillId) => {
                    const skill = BUILT_IN_SKILLS.find((s) => s.id === skillId);
                    if (!skill) return null;
                    const isEnabled = enabledSkillIds.has(skillId);
                    const wasRecommended = recommendedSkillIds.includes(skillId);
                    return (
                      <button
                        key={skillId}
                        type="button"
                        className={cn(
                          "text-[10px] rounded-full border px-2 py-0.5 transition-colors",
                          isEnabled
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                        )}
                        onClick={() => onToggleSkillOverride?.(skillId, !isEnabled)}
                        title={skill.description}
                      >
                        {skill.title}
                        {wasRecommended ? " (rec)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Errors / blocked */}
            {imageSendBlocked && (
              <p className="text-xs text-destructive mb-2" role="alert">
                Select a vision-capable model to send images.
              </p>
            )}
            {sttError && (
              <p className="text-xs text-destructive mb-2" role="alert">STT error: {sttError}</p>
            )}

            {/* Attachment preview */}
            {attachment && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
                {attachment.type === "image" && (
                  <img
                    src={`data:${attachment.mimeType};base64,${attachment.dataBase64}`}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                )}
                <Badge variant="secondary" className="text-xs font-normal truncate flex-1">
                  {attachment.name}
                </Badge>
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground transition-colors"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            )}

            {/* Input form */}
            <form
              className="flex items-end gap-2"
              onSubmit={handleSubmit}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer?.files?.[0];
                if (file) void handleFileAttach(file);
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  supportsVision
                    ? "image/*,.txt,.md,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rs,.sh,.yaml,.yml"
                    : ".txt,.md,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rs,.sh,.yaml,.yml"
                }
                className="hidden"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileAttach(file);
                  e.target.value = "";
                }}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAudioTranscribe(file);
                  e.target.value = "";
                }}
              />

              {/* Attach */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={supportsVision ? "Attach image or file" : "Attach text file"}
                  >
                    <Paperclip size={17} strokeWidth={2} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {supportsVision ? "Attach image or file" : "Attach text file"}
                </TooltipContent>
              </Tooltip>

              {/* STT */}
              {supportsStt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn("h-9 w-9 shrink-0", sttBusy ? "text-primary animate-pulse" : "text-muted-foreground")}
                      onClick={() => audioInputRef.current?.click()}
                      disabled={sttBusy || streaming}
                      aria-label="Transcribe audio"
                    >
                      <Mic size={17} strokeWidth={2} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {sttBusy ? "Transcribing…" : "Transcribe audio"}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Text input with ghost suggestion */}
              <div className="relative flex-1">
                <div
                  ref={mirrorRef}
                  className="absolute inset-0 px-3 py-2 text-sm whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
                  aria-hidden
                >
                  <span className="invisible">{inputValue}</span>
                  {ghostSuggestion && (
                    <span className="text-muted-foreground/40">{ghostSuggestion}</span>
                  )}
                </div>
                <Textarea
                  ref={inputRef}
                  className="min-h-[40px] max-h-48 resize-none text-sm py-2 leading-relaxed"
                  placeholder={
                    supportsVision
                      ? "Type a message… (or paste/drop a file)"
                      : "Type a message… (Enter to send, Shift+Enter for newline)"
                  }
                  rows={1}
                  disabled={streaming}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
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
                      setTimeout(() => inputRef.current?.setSelectionRange(newCursor, newCursor), 0);
                    }
                  }}
                  onPaste={(e) => {
                    const file = e.clipboardData?.files?.[0];
                    if (file) { e.preventDefault(); void handleFileAttach(file); }
                  }}
                />
              </div>

              {/* Send / Stop */}
              {streaming ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={onStop}
                  aria-label="Stop generating"
                >
                  <Square size={15} strokeWidth={2.5} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={(!inputValue.trim() && !attachment)}
                  aria-label="Send message"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </Button>
              )}
            </form>

            <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
              Cove · Local &amp; private
            </p>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
