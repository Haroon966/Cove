/**
 * Browser fallback when not running inside Tauri (e.g. npm run dev in browser).
 * Uses localStorage for config and sessions so you can test the UI and streaming
 * without building the desktop app. Remove or disable in production Tauri build.
 */

const CONFIG_KEY = "cove_config";
const SESSIONS_KEY = "cove_sessions";
const MESSAGES_KEY = "cove_messages";

interface StoredSession {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  model: string | null;
  backend_type: string | null;
}

interface StoredMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: number;
}

function getSessions(): StoredSession[] {
  try {
    const s = localStorage.getItem(SESSIONS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function setSessions(sessions: StoredSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function getMessages(): Record<number, StoredMessage[]> {
  try {
    const s = localStorage.getItem(MESSAGES_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function setMessages(bySession: Record<number, StoredMessage[]>) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(bySession));
}

export function installTauriMock() {
  if (typeof window === "undefined" || (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
    return;
  }
  let nextSessionId = 1;
  let nextMessageId = 1;
  const sessions = getSessions();
  if (sessions.length > 0) {
    const max = Math.max(...sessions.map((s) => s.id));
    nextSessionId = max + 1;
  }
  const allMessages = getMessages();
  for (const list of Object.values(allMessages)) {
    for (const m of list) {
      if (m.id >= nextMessageId) nextMessageId = m.id + 1;
    }
  }

  (window as unknown as { __TAURI__: { core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } } }).__TAURI__ = {
    core: {
      invoke: async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
        if (cmd === "config_load") {
          try {
            const s = localStorage.getItem(CONFIG_KEY);
            const defaults = { backend_type: "ollama", base_url: "http://localhost:11434", model: "llama2", api_key: null, system_prompt: null, theme: null, primary_color: null };
            return s ? { ...defaults, ...JSON.parse(s) } : defaults;
          } catch {
            return { backend_type: "ollama", base_url: "http://localhost:11434", model: "llama2", api_key: null, system_prompt: null, theme: null, primary_color: null };
          }
        }
        if (cmd === "config_save" && args?.config) {
          localStorage.setItem(CONFIG_KEY, JSON.stringify(args.config));
          return undefined;
        }
        if (cmd === "session_create") {
          const title = (args?.title as string) ?? "New chat";
          const now = Math.floor(Date.now() / 1000);
          const session: StoredSession = {
            id: nextSessionId,
            title,
            created_at: now,
            updated_at: now,
            model: null,
            backend_type: null,
          };
          nextSessionId += 1;
          const list = getSessions();
          list.unshift(session);
          setSessions(list);
          return session.id;
        }
        if (cmd === "session_list") {
          return getSessions();
        }
        if (cmd === "session_load" && typeof args?.session_id === "number") {
          const list = getSessions().filter((s) => s.id === args!.session_id);
          return list[0] ?? null;
        }
        if (cmd === "session_delete" && typeof args?.session_id === "number") {
          const id = args.session_id as number;
          setSessions(getSessions().filter((s) => s.id !== id));
          const bySession = getMessages();
          delete bySession[id];
          setMessages(bySession);
          return undefined;
        }
        if (cmd === "session_update_title" && typeof args?.session_id === "number" && typeof args?.title === "string") {
          const id = args.session_id as number;
          const title = args.title as string;
          const list = getSessions();
          const session = list.find((s) => s.id === id);
          if (session) {
            session.title = title;
            session.updated_at = Math.floor(Date.now() / 1000);
            setSessions(list);
          }
          return undefined;
        }
        if (cmd === "message_save" && typeof args?.session_id === "number" && typeof args?.role === "string" && typeof args?.content === "string") {
          const sessionId = args.session_id as number;
          const now = Math.floor(Date.now() / 1000);
          const msg: StoredMessage = {
            id: nextMessageId,
            session_id: sessionId,
            role: args.role as string,
            content: args.content as string,
            created_at: now,
          };
          nextMessageId += 1;
          const bySession = getMessages();
          if (!bySession[sessionId]) bySession[sessionId] = [];
          bySession[sessionId].push(msg);
          setMessages(bySession);
          const sessions = getSessions();
          const s = sessions.find((x) => x.id === sessionId);
          if (s) {
            s.updated_at = now;
            setSessions(sessions);
          }
          return msg.id;
        }
        if (cmd === "messages_load" && typeof args?.session_id === "number") {
          const list = getMessages()[args.session_id as number] ?? [];
          return list;
        }
        if (cmd === "search_sessions" && typeof args?.query === "string") {
          const q = (args.query as string).trim().toLowerCase();
          if (!q) return [];
          const sessionList = getSessions();
          const bySession = getMessages();
          const matched = new Map<number, { title: string; snippet: string }>();
          for (const s of sessionList) {
            if (s.title.toLowerCase().includes(q)) {
              matched.set(s.id, { title: s.title, snippet: s.title });
            }
          }
          for (const [sessionId, msgs] of Object.entries(bySession)) {
            const sid = Number(sessionId);
            for (const m of msgs) {
              if (m.content.toLowerCase().includes(q)) {
                const session = sessionList.find((x) => x.id === sid);
                if (session && !matched.has(sid)) {
                  matched.set(sid, {
                    title: session.title,
                    snippet: m.content.slice(0, 120),
                  });
                } else if (session && matched.has(sid)) {
                  const cur = matched.get(sid)!;
                  if (cur.snippet === cur.title)
                    matched.set(sid, { ...cur, snippet: m.content.slice(0, 120) });
                }
              }
            }
          }
          return Array.from(matched.entries())
            .map(([session_id, { title, snippet }]) => ({ session_id, title, snippet }))
            .sort((a, b) => {
              const sa = sessionList.find((x) => x.id === a.session_id);
              const sb = sessionList.find((x) => x.id === b.session_id);
              return (sb?.updated_at ?? 0) - (sa?.updated_at ?? 0);
            });
        }
        return undefined;
      },
    },
  };
}
