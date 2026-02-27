import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "./api/tauri";
import { SessionList } from "./components/SessionList";
import { ChatPanel } from "./components/ChatPanel";
import { Settings } from "./components/Settings";
import { useStreamingChat } from "./hooks/useStreamingChat";
import type { Session, Message, AppConfig, SearchResult } from "./types";

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

export default function App() {
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
          system_prompt: c.system_prompt ?? null,
          theme: c.theme ?? "light",
          primary_color: c.primary_color ?? null,
        });
      } catch {
        setConfig({
          backend_type: "ollama",
          base_url: "http://localhost:11434",
          model: "llama2",
          api_key: null,
          system_prompt: null,
          theme: "light",
          primary_color: null,
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

  const handleModelChange = async (model: string) => {
    if (!config) return;
    const updated = { ...config, model };
    setConfig(updated);
    try {
      await invoke("config_save", { config: updated });
    } catch (e) {
      console.error(e);
    }
  };

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
      }
    );
  };

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
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="app-main">
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-header-label">Active Chat:</span>
            <span className="app-header-title">{activeChatTitle}</span>
          </div>
        </header>
        <ChatPanel
          messages={messages}
          streamingContent={streamingContent}
          streaming={streaming}
          error={error}
          config={config}
          onModelChange={handleModelChange}
          onStop={stop}
          onSend={handleSend}
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
        />
      )}
    </div>
  );
}
