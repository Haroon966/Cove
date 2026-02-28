import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "../api/tauri";
import { SessionList } from "../components/SessionList";
import { ChatPanel } from "../components/ChatPanel";
import { Settings } from "../components/Settings";
import { useStreamingChat } from "../hooks/useStreamingChat";
import type { Session, Message, AppConfig, SearchResult } from "../types";

const DEFAULT_PRIMARY = "#5f4a8b";

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyThemeAndPrimaryColor(config: AppConfig | null) {
  const root = document.documentElement;
  const theme = config?.theme ?? "light";
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  root.setAttribute("data-theme", resolved);

  const primary = config?.primary_color?.trim() || DEFAULT_PRIMARY;
  if (config?.primary_color) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-hover", primary);
    root.style.setProperty("--primary-light", hexToRgba(primary, 0.1));
    root.style.setProperty("--primary-border", hexToRgba(primary, 0.2));
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-hover");
    root.style.removeProperty("--primary-light");
    root.style.removeProperty("--primary-border");
  }
}

export default function ChatPage() {
  const configToApplyRef = useRef<AppConfig | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<AppConfig | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInMessages, setSearchInMessages] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  const finalizeAndSave = useCallback(
    async (sessionId: number, fullContent: string) => {
      try {
        await invoke("message_save", {
          session_id: sessionId,
          role: "assistant",
          content: fullContent,
        });
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  const { send, stop, error, streaming, setError } = useStreamingChat(config);

  const loadSessions = useCallback(async () => {
    try {
      const list = await invoke<Session[]>("session_list");
      setSessions(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: number) => {
    try {
      const list = await invoke<Message[]>("messages_load", { session_id: sessionId });
      setMessages(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await invoke<AppConfig>("config_load");
        setConfig({
          backend_type: c.backend_type ?? "ollama",
          base_url: c.base_url ?? "http://localhost:11434",
          model: c.model ?? "llama2",
          api_key: c.api_key ?? null,
          api_keys: c.api_keys ?? null,
          system_prompt: c.system_prompt ?? null,
          theme: c.theme ?? "light",
          primary_color: c.primary_color ?? null,
          temperature: c.temperature ?? null,
          max_tokens: c.max_tokens ?? null,
        });
      } catch {
        setConfig({
          backend_type: "ollama",
          base_url: "http://localhost:11434",
          model: "llama2",
          api_key: null,
          api_keys: null,
          system_prompt: null,
          theme: "light",
          primary_color: null,
          temperature: null,
          max_tokens: null,
        });
      }
    })();
  }, []);

  useEffect(() => {
    const toApply = showSettings && draftConfig !== null ? draftConfig : config;
    configToApplyRef.current = toApply;
    applyThemeAndPrimaryColor(toApply);
    if (toApply?.theme === "system") {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyThemeAndPrimaryColor(configToApplyRef.current);
      m.addEventListener("change", listener);
      return () => m.removeEventListener("change", listener);
    }
  }, [showSettings, draftConfig, config]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as unknown as { __TAURI__?: unknown }).__TAURI__) return;
    const shortcut = "CommandOrControl+Shift+C";
    let cancelled = false;
    (async () => {
      try {
        const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await register(shortcut, () => {
          getCurrentWindow().show();
          getCurrentWindow().setFocus();
        });
        if (cancelled) await unregister(shortcut);
      } catch {
        // Plugin or permission not available
      }
    })();
    return () => {
      cancelled = true;
      import("@tauri-apps/plugin-global-shortcut").then(({ unregister }) => unregister(shortcut)).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (currentSessionId !== null) {
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId, loadMessages]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!searchInMessages || !q) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await invoke<SearchResult[]>("search_sessions", { query: q });
        if (!cancelled) setSearchResults(results);
      } catch (e) {
        if (!cancelled) setSearchResults([]);
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery, searchInMessages]);

  const handleNewChat = async () => {
    try {
      const id = await invoke<number>("session_create", { title: null });
      setSessions((prev) => {
        const next = [...prev];
        const now = Math.floor(Date.now() / 1000);
        next.unshift({
          id,
          title: "New chat",
          created_at: now,
          updated_at: now,
          model: null,
          backend_type: null,
        });
        return next;
      });
      setCurrentSessionId(id);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSession = (id: number) => {
    setCurrentSessionId(id);
  };

  const handleDeleteSession = async (id: number) => {
    try {
      await invoke("session_delete", { session_id: id });
      const nextSessions = sessions.filter((s) => s.id !== id);
      setSessions(nextSessions);
      if (currentSessionId === id) {
        setCurrentSessionId(nextSessions[0]?.id ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleModelChange = useCallback(
    async (model: string) => {
      if (!config) return;
      try {
        if (currentSessionId !== null) {
          await invoke("session_update_model", {
            session_id: currentSessionId,
            model,
            backend_type: config.backend_type,
          });
          await loadSessions();
        } else {
          const updated = { ...config, model };
          setConfig(updated);
          await invoke("config_save", { config: updated });
        }
      } catch (e) {
        console.error(e);
      }
    },
    [config, currentSessionId, loadSessions]
  );

  const handleEditAndResend = useCallback(
    async (messageId: number, newContent: string) => {
      const sessionId = currentSessionId;
      if (sessionId === null || !config?.base_url?.trim()) return;
      try {
        await invoke("message_update", {
          session_id: sessionId,
          message_id: messageId,
          content: newContent.trim(),
        });
        await invoke("messages_delete_from", {
          session_id: sessionId,
          from_message_id: messageId + 1,
        });
        const list = await invoke<Message[]>("messages_load", { session_id: sessionId });
        setMessages(list);
        setStreamingContent("");
        setError(null);
        let streamed = "";
        const sessionOverride = sessions.find((s) => s.id === sessionId);
        await send(
          sessionId,
          list,
          (chunk) => {
            streamed += chunk;
            setStreamingContent(streamed);
          },
          (fullContent) => {
            setStreamingContent(null);
            setMessages((prev) => [
              ...prev,
              {
                id: 0,
                session_id: sessionId,
                role: "assistant",
                content: fullContent,
                created_at: Math.floor(Date.now() / 1000),
              },
            ]);
            finalizeAndSave(sessionId, fullContent);
          },
          sessionOverride ? { model: sessionOverride.model, backend_type: sessionOverride.backend_type } : undefined
        );
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId, config, send, finalizeAndSave, setError, sessions]
  );

  const handleRegenerateFrom = useCallback(
    async (fromMessageId: number) => {
      const sessionId = currentSessionId;
      if (sessionId === null || !config?.base_url?.trim()) return;
      try {
        await invoke("messages_delete_from", {
          session_id: sessionId,
          from_message_id: fromMessageId,
        });
        const list = await invoke<Message[]>("messages_load", { session_id: sessionId });
        setMessages(list);
        setStreamingContent("");
        setError(null);
        let streamed = "";
        const sessionOverride = sessions.find((s) => s.id === sessionId);
        await send(
          sessionId,
          list,
          (chunk) => {
            streamed += chunk;
            setStreamingContent(streamed);
          },
          (fullContent) => {
            setStreamingContent(null);
            setMessages((prev) => [
              ...prev,
              {
                id: 0,
                session_id: sessionId,
                role: "assistant",
                content: fullContent,
                created_at: Math.floor(Date.now() / 1000),
              },
            ]);
            finalizeAndSave(sessionId, fullContent);
          },
          sessionOverride ? { model: sessionOverride.model, backend_type: sessionOverride.backend_type } : undefined
        );
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId, config, send, finalizeAndSave, setError, sessions]
  );

  const handleSend = async (text: string) => {
    let sessionId = currentSessionId;
    if (sessionId === null) {
      try {
        const title = text.slice(0, 50) || "New chat";
        sessionId = await invoke<number>("session_create", { title });
        setCurrentSessionId(sessionId);
        await loadSessions();
      } catch (e) {
        console.error(e);
        return;
      }
    }
    try {
      await invoke("message_save", {
        session_id: sessionId,
        role: "user",
        content: text,
      });
    } catch (e) {
      console.error(e);
      return;
    }
    const currentSession = sessions.find((s) => s.id === sessionId);
    if (currentSession?.title === "New chat") {
      const newTitle = text.slice(0, 50).trim() || "New chat";
      try {
        await invoke("session_update_title", { session_id: sessionId, title: newTitle });
        await loadSessions();
      } catch (e) {
        console.error(e);
      }
    }
    setMessages((prev) => [
      ...prev,
      {
        id: 0,
        session_id: sessionId,
        role: "user",
        content: text,
        created_at: Math.floor(Date.now() / 1000),
      },
    ]);
    let streamed = "";
    setStreamingContent("");
    setError(null);
    const sessionOverride = sessions.find((s) => s.id === sessionId);
    await send(
      sessionId,
      [...messages, { id: 0, session_id: sessionId, role: "user", content: text, created_at: 0 }],
      (chunk) => {
        streamed += chunk;
        setStreamingContent(streamed);
      },
      (fullContent) => {
        setStreamingContent(null);
        setMessages((prev) => [
          ...prev,
          {
            id: 0,
            session_id: sessionId!,
            role: "assistant",
            content: fullContent,
            created_at: Math.floor(Date.now() / 1000),
          },
        ]);
        finalizeAndSave(sessionId!, fullContent);
      },
      sessionOverride ? { model: sessionOverride.model, backend_type: sessionOverride.backend_type } : undefined
    );
  };

  const handleRenameSession = useCallback(async (sessionId: number, title: string) => {
    try {
      await invoke("session_update_title", { session_id: sessionId, title });
      await loadSessions();
    } catch (e) {
      console.error(e);
    }
  }, [loadSessions]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  }, []);

  const handleExportSession = useCallback(
    async (format: "json" | "markdown") => {
      if (currentSessionId === null) return;
      try {
        const data = await invoke<string>("export_session_data", {
          session_id: currentSessionId,
          format,
        });
        const ext = format === "json" ? "json" : "md";
        const defaultName = `cove-export-${currentSessionId}.${ext}`;
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          const path = await save({ defaultPath: defaultName });
          if (path) await writeTextFile(path, data);
        } catch {
          const blob = new Blob([data], {
            type: format === "json" ? "application/json" : "text/markdown",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = defaultName;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId]
  );

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const activeChatTitle = currentSession?.title ?? "New chat";

  return (
    <div className="app">
      <SessionList
        sessions={sessions}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchInMessages={searchInMessages}
        onSearchInMessagesChange={setSearchInMessages}
        searchResults={searchResults}
        currentId={currentSessionId}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="app-main">
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-header-label">Active Chat:</span>
            <span className="app-header-title">{activeChatTitle}</span>
          </div>
          {currentSessionId !== null && (
            <div className="app-header-actions">
              <button
                type="button"
                className="app-header-btn"
                onClick={() => handleExportSession("markdown")}
                title="Export as Markdown"
              >
                Export .md
              </button>
              <button
                type="button"
                className="app-header-btn"
                onClick={() => handleExportSession("json")}
                title="Export as JSON"
              >
                Export .json
              </button>
            </div>
          )}
        </header>
        <ChatPanel
          sessionId={currentSessionId}
          messages={messages}
          streamingContent={streamingContent}
          streaming={streaming}
          error={error}
          config={config}
          effectiveModel={currentSession?.model ?? config?.model ?? null}
          onModelChange={handleModelChange}
          onStop={stop}
          onSend={handleSend}
          onEditAndResend={handleEditAndResend}
          onRegenerateFrom={handleRegenerateFrom}
          onCopyMessage={handleCopyMessage}
        />
      </div>
      {showSettings && config !== null && (
        <Settings
          savedConfig={config}
          onDraftChange={setDraftConfig}
          onClose={() => {
            setShowSettings(false);
            setDraftConfig(null);
          }}
          onSaved={(c) => {
            setConfig(c);
            setShowSettings(false);
            setDraftConfig(null);
          }}
          onBackupRestore={() => loadSessions()}
        />
      )}
    </div>
  );
}
