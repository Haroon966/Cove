/**
 * Browser fallback when not running inside Tauri (e.g. npm run dev in browser).
 * Uses localStorage for config and sessions so you can test the UI and streaming
 * without building the desktop app. Remove or disable in production Tauri build.
 */
import { DEFAULT_APP_CONFIG } from "./config/defaultAppConfig";

const CONFIG_KEY = "cove_config";
const SESSIONS_KEY = "cove_sessions";
const MESSAGES_KEY = "cove_messages";
const KNOWLEDGE_KEY = "cove_knowledge_docs";
const KNOWLEDGE_LINKS_KEY = "cove_knowledge_links";
const ARTIFACTS_KEY = "cove_artifacts";
const EXECUTION_TRACES_KEY = "cove_execution_traces";

interface StoredSession {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  model: string | null;
  backend_type: string | null;
  openwebui_workspace_id?: string | null;
  openwebui_thread_id?: string | null;
  branch_root_message_id?: number | null;
}

interface StoredMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: number;
  tool_call_id?: string | null;
  tool_name?: string | null;
  tool_calls?: string | null;
  parent_message_id?: number | null;
  branch_id?: string | null;
  event_type?: string | null;
}

interface StoredKnowledgeDoc {
  id: number;
  title: string;
  source_path?: string | null;
  mime_type?: string | null;
  content: string;
  chunk_count: number;
  created_at: number;
  updated_at: number;
}

interface StoredArtifact {
  id: number;
  session_id: number;
  message_id?: number | null;
  artifact_type: string;
  title?: string | null;
  payload: string;
  created_at: number;
}

interface StoredExecutionTrace {
  id: number;
  session_id: number;
  message_id?: number | null;
  trace_type: string;
  trace_payload: string;
  created_at: number;
}

interface MockMcpStatus {
  server_id: string;
  transport: string;
  running: boolean;
  detail: string;
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

function getKnowledgeDocs(): StoredKnowledgeDoc[] {
  try {
    const s = localStorage.getItem(KNOWLEDGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function setKnowledgeDocs(docs: StoredKnowledgeDoc[]) {
  localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(docs));
}

function getKnowledgeLinks(): Record<number, number[]> {
  try {
    const s = localStorage.getItem(KNOWLEDGE_LINKS_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function setKnowledgeLinks(links: Record<number, number[]>) {
  localStorage.setItem(KNOWLEDGE_LINKS_KEY, JSON.stringify(links));
}

function getArtifacts(): StoredArtifact[] {
  try {
    const s = localStorage.getItem(ARTIFACTS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function setArtifacts(items: StoredArtifact[]) {
  localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(items));
}

function getExecutionTraces(): StoredExecutionTrace[] {
  try {
    const s = localStorage.getItem(EXECUTION_TRACES_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function setExecutionTraces(items: StoredExecutionTrace[]) {
  localStorage.setItem(EXECUTION_TRACES_KEY, JSON.stringify(items));
}

/** Set to true when the browser mock is installed. Used to detect desktop (real Tauri) vs web. */
declare global {
  interface Window {
    __TAURI_MOCK__?: boolean;
  }
}

export function installTauriMock() {
  if (typeof window === "undefined" || (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
    return;
  }
  (window as unknown as { __TAURI_MOCK__: boolean }).__TAURI_MOCK__ = true;
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
            return s ? { ...DEFAULT_APP_CONFIG, ...JSON.parse(s) } : { ...DEFAULT_APP_CONFIG };
          } catch {
            return { ...DEFAULT_APP_CONFIG };
          }
        }
        if (cmd === "config_save" && args?.config) {
          localStorage.setItem(CONFIG_KEY, JSON.stringify(args.config));
          return undefined;
        }
        if (cmd === "deep_link_consume_pending") {
          return [];
        }
        if (cmd === "deep_link_emit") {
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
            openwebui_workspace_id: null,
            openwebui_thread_id: null,
            branch_root_message_id: null,
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
          setArtifacts(getArtifacts().filter((a) => a.session_id !== id));
          setExecutionTraces(getExecutionTraces().filter((t) => t.session_id !== id));
          return undefined;
        }
        if (cmd === "session_update_model" && typeof args?.session_id === "number") {
          const id = args.session_id as number;
          const model = args.model as string | null | undefined;
          const backend_type = args.backend_type as string | null | undefined;
          const list = getSessions();
          const session = list.find((s) => s.id === id);
          if (session) {
            session.model = model ?? null;
            session.backend_type = backend_type ?? null;
            setSessions(list);
          }
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
        if (cmd === "session_set_branch_root" && typeof args?.session_id === "number") {
          const id = args.session_id as number;
          const root = (args.branch_root_message_id as number | null | undefined) ?? null;
          const list = getSessions();
          const session = list.find((s) => s.id === id);
          if (session) {
            session.branch_root_message_id = root;
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
            tool_call_id: (args.tool_call_id as string | null) ?? null,
            tool_name: (args.tool_name as string | null) ?? null,
            tool_calls: (args.tool_calls as string | null) ?? null,
            parent_message_id: (args.parent_message_id as number | null | undefined) ?? null,
            branch_id: (args.branch_id as string | null | undefined) ?? null,
            event_type: (args.event_type as string | null | undefined) ?? "message",
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
        if (cmd === "messages_load_branch" && typeof args?.session_id === "number") {
          const sessionId = args.session_id as number;
          const branchId = (args.branch_id as string | null | undefined) ?? "";
          const list = getMessages()[sessionId] ?? [];
          if (!branchId) return list.filter((m) => !m.branch_id);
          return list.filter((m) => !m.branch_id || m.branch_id === branchId);
        }
        if (cmd === "message_branch_list" && typeof args?.session_id === "number") {
          const sessionId = args.session_id as number;
          const list = getMessages()[sessionId] ?? [];
          const groups = new Map<string, StoredMessage[]>();
          for (const m of list) {
            const key = m.branch_id ?? "";
            const arr = groups.get(key) ?? [];
            arr.push(m);
            groups.set(key, arr);
          }
          return Array.from(groups.entries())
            .map(([branchKey, msgs]) => {
              const sorted = [...msgs].sort((a, b) => a.created_at - b.created_at || a.id - b.id);
              return {
                branch_id: branchKey || null,
                message_count: msgs.length,
                first_created_at: sorted[0]?.created_at ?? 0,
                last_created_at: sorted[sorted.length - 1]?.created_at ?? 0,
                preview: sorted[0]?.content?.slice(0, 80) ?? "",
              };
            })
            .sort((a, b) => b.last_created_at - a.last_created_at);
        }
        if (cmd === "message_update" && typeof args?.session_id === "number" && typeof args?.message_id === "number" && typeof args?.content === "string") {
          const sessionId = args.session_id as number;
          const messageId = args.message_id as number;
          const content = args.content as string;
          const bySession = getMessages();
          const list = bySession[sessionId] ?? [];
          const idx = list.findIndex((m) => m.id === messageId);
          if (idx >= 0) {
            list[idx].content = content;
            setMessages(bySession);
          }
          return undefined;
        }
        if (cmd === "messages_delete_from" && typeof args?.session_id === "number" && typeof args?.from_message_id === "number") {
          const sessionId = args.session_id as number;
          const fromId = args.from_message_id as number;
          const bySession = getMessages();
          const list = bySession[sessionId] ?? [];
          bySession[sessionId] = list.filter((m) => m.id < fromId);
          setMessages(bySession);
          setArtifacts(
            getArtifacts().filter(
              (a) => a.session_id !== sessionId || !a.message_id || a.message_id < fromId
            )
          );
          return undefined;
        }
        if (
          cmd === "artifact_create" &&
          typeof args?.session_id === "number" &&
          typeof args?.artifact_type === "string" &&
          typeof args?.payload === "string"
        ) {
          const items = getArtifacts();
          const id = items.length ? Math.max(...items.map((a) => a.id)) + 1 : 1;
          const now = Math.floor(Date.now() / 1000);
          items.unshift({
            id,
            session_id: args.session_id as number,
            message_id: (args.message_id as number | null | undefined) ?? null,
            artifact_type: args.artifact_type as string,
            title: (args.title as string | null | undefined) ?? null,
            payload: args.payload as string,
            created_at: now,
          });
          setArtifacts(items);
          return id;
        }
        if (cmd === "artifact_list" && typeof args?.session_id === "number") {
          return getArtifacts().filter((a) => a.session_id === (args.session_id as number));
        }
        if (cmd === "artifact_update" && typeof args?.artifact_id === "number") {
          const items = getArtifacts();
          const idx = items.findIndex((a) => a.id === (args.artifact_id as number));
          if (idx >= 0) {
            if (typeof args.title === "string") items[idx].title = args.title;
            if (typeof args.payload === "string") items[idx].payload = args.payload;
            setArtifacts(items);
          }
          return undefined;
        }
        if (cmd === "artifact_delete" && typeof args?.artifact_id === "number") {
          setArtifacts(getArtifacts().filter((a) => a.id !== (args.artifact_id as number)));
          return undefined;
        }
        if (
          cmd === "execution_trace_add" &&
          typeof args?.session_id === "number" &&
          typeof args?.trace_type === "string" &&
          typeof args?.trace_payload === "string"
        ) {
          const items = getExecutionTraces();
          const id = items.length ? Math.max(...items.map((t) => t.id)) + 1 : 1;
          const now = Math.floor(Date.now() / 1000);
          items.push({
            id,
            session_id: args.session_id as number,
            message_id: (args.message_id as number | null | undefined) ?? null,
            trace_type: args.trace_type as string,
            trace_payload: args.trace_payload as string,
            created_at: now,
          });
          setExecutionTraces(items);
          return id;
        }
        if (cmd === "execution_trace_list" && typeof args?.session_id === "number") {
          return getExecutionTraces().filter((t) => t.session_id === (args.session_id as number));
        }
        if (cmd === "execution_trace_clear" && typeof args?.session_id === "number") {
          setExecutionTraces(
            getExecutionTraces().filter((t) => t.session_id !== (args.session_id as number))
          );
          return undefined;
        }
        if (cmd === "export_all_data") {
          const sessionList = getSessions();
          const bySession = getMessages();
          const messagesList: StoredMessage[] = [];
          for (const s of sessionList) {
            for (const m of bySession[s.id] ?? []) {
              messagesList.push(m);
            }
          }
          const config = (() => {
            try {
              const raw = localStorage.getItem(CONFIG_KEY);
              return raw ? { ...DEFAULT_APP_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_APP_CONFIG };
            } catch {
              return { ...DEFAULT_APP_CONFIG };
            }
          })();
          return JSON.stringify({ sessions: sessionList, messages: messagesList, config }, null, 2);
        }
        if (cmd === "import_backup" && typeof args?.json === "string" && typeof args?.mode === "string") {
          const backup = JSON.parse(args.json as string) as { sessions: StoredSession[]; messages: StoredMessage[]; config?: unknown };
          const mode = args.mode as string;
          if (mode === "replace") {
            setSessions([]);
            setMessages({});
          }
          const existing = getSessions();
          const existingMessages = getMessages();
          const maxId = existing.length ? Math.max(...existing.map((s) => s.id)) : 0;
          let nextId = maxId + 1;
          const idMap: Record<number, number> = {};
          for (const s of backup.sessions) {
            idMap[s.id] = nextId;
            existing.unshift({
              ...s,
              id: nextId,
            });
            nextId += 1;
          }
          setSessions(existing);
          for (const m of backup.messages) {
            const newSid = idMap[m.session_id] ?? m.session_id;
            if (!existingMessages[newSid]) existingMessages[newSid] = [];
            existingMessages[newSid].push({
              ...m,
              id: existingMessages[newSid].length + 1,
              session_id: newSid,
            });
          }
          setMessages(existingMessages);
          if (backup.config && typeof backup.config === "object") {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(backup.config));
          }
          return undefined;
        }
        if (cmd === "export_session_data" && typeof args?.session_id === "number" && typeof args?.format === "string") {
          const sessionId = args.session_id as number;
          const format = args.format as string;
          const sessionList = getSessions();
          const session = sessionList.find((s) => s.id === sessionId);
          if (!session) return Promise.reject(new Error("Session not found"));
          const messagesList = getMessages()[sessionId] ?? [];
          if (format === "json") {
            return JSON.stringify({ session, messages: messagesList }, null, 2);
          }
          if (format === "markdown") {
            let md = `# ${session.title}\n\n`;
            for (const m of messagesList) {
              const label = m.role === "user" ? "**You**" : "**Assistant**";
              md += `${label}:\n\n${m.content}\n\n`;
            }
            return md;
          }
          return Promise.reject(new Error("format must be 'json' or 'markdown'"));
        }
        if (cmd === "run_shell_command") {
          return Promise.reject(new Error("Running commands is only available in the desktop app."));
        }
        if (cmd === "whatsapp_bridge_config_path_cmd") {
          return "(WhatsApp bridge only in desktop app)";
        }
        if (cmd === "whatsapp_write_bridge_config") {
          return undefined;
        }
        if (cmd === "whatsapp_bridge_start") {
          return Promise.reject(new Error("WhatsApp bridge is only available in the desktop app."));
        }
        if (cmd === "whatsapp_bridge_stop") {
          return undefined;
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
        if (cmd === "knowledge_doc_list") {
          return getKnowledgeDocs();
        }
        if (cmd === "knowledge_doc_create" && typeof args?.title === "string" && typeof args?.content === "string") {
          const docs = getKnowledgeDocs();
          const id = docs.length ? Math.max(...docs.map((d) => d.id)) + 1 : 1;
          const now = Math.floor(Date.now() / 1000);
          const content = args.content as string;
          const computedChunkCount = Math.max(1, Math.ceil(content.length / 1200));
          docs.unshift({
            id,
            title: args.title as string,
            source_path: (args.source_path as string | null | undefined) ?? null,
            mime_type: (args.mime_type as string | null | undefined) ?? null,
            content,
            chunk_count: computedChunkCount,
            created_at: now,
            updated_at: now,
          });
          setKnowledgeDocs(docs);
          return id;
        }
        if (cmd === "knowledge_doc_delete" && typeof args?.doc_id === "number") {
          const docId = args.doc_id as number;
          setKnowledgeDocs(getKnowledgeDocs().filter((d) => d.id !== docId));
          const links = getKnowledgeLinks();
          for (const key of Object.keys(links)) {
            links[Number(key)] = (links[Number(key)] ?? []).filter((id) => id !== docId);
          }
          setKnowledgeLinks(links);
          return undefined;
        }
        if (cmd === "knowledge_session_sources_list" && typeof args?.session_id === "number") {
          const links = getKnowledgeLinks();
          return links[args.session_id as number] ?? [];
        }
        if (
          cmd === "knowledge_session_sources_set" &&
          typeof args?.session_id === "number" &&
          Array.isArray(args?.doc_ids)
        ) {
          const links = getKnowledgeLinks();
          links[args.session_id as number] = (args.doc_ids as number[]).filter((id) =>
            Number.isFinite(id)
          );
          setKnowledgeLinks(links);
          return undefined;
        }
        if (cmd === "knowledge_retrieve" && typeof args?.query === "string") {
          const q = (args.query as string).trim().toLowerCase();
          if (!q) return [];
          const docs = getKnowledgeDocs();
          const limit = Math.max(1, Math.min(20, Number(args?.limit ?? 6)));
          const sessionId = (args?.session_id as number | null | undefined) ?? null;
          const links = getKnowledgeLinks();
          const linked = sessionId != null ? new Set(links[sessionId] ?? []) : null;
          const hasLinks = linked != null && linked.size > 0;
          const filteredDocs = hasLinks ? docs.filter((d) => linked!.has(d.id)) : docs;
          const hits: Array<{
            doc_id: number;
            doc_title: string;
            chunk_index: number;
            snippet: string;
            score: number;
          }> = [];
          for (const doc of filteredDocs) {
            const idx = doc.content.toLowerCase().indexOf(q);
            if (idx === -1) continue;
            const start = Math.max(0, idx - 100);
            const end = Math.min(doc.content.length, idx + q.length + 140);
            hits.push({
              doc_id: doc.id,
              doc_title: doc.title,
              chunk_index: Math.floor(idx / 1200),
              snippet: doc.content.slice(start, end),
              score: idx,
            });
          }
          return hits.sort((a, b) => a.score - b.score).slice(0, limit);
        }
        if (cmd === "mcp_server_status" && typeof args?.server_id === "string") {
          const cfg = (JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") as { mcp_servers?: Array<{ id: string; transport: string }> });
          const server = (cfg.mcp_servers ?? []).find((s) => s.id === args.server_id);
          const status: MockMcpStatus = {
            server_id: args.server_id as string,
            transport: server?.transport ?? "http",
            running: true,
            detail: "Mock MCP status",
          };
          return status;
        }
        if (cmd === "mcp_server_start" && typeof args?.server_id === "string") {
          return {
            server_id: args.server_id as string,
            transport: "stdio",
            running: true,
            detail: "Mock MCP started",
          } as MockMcpStatus;
        }
        if (cmd === "mcp_server_stop" && typeof args?.server_id === "string") {
          return {
            server_id: args.server_id as string,
            transport: "stdio",
            running: false,
            detail: "Mock MCP stopped",
          } as MockMcpStatus;
        }
        if (cmd === "mcp_server_test" && typeof args?.server_id === "string") {
          return `Mock MCP test OK for ${args.server_id as string}`;
        }
        if (
          cmd === "mcp_dispatch_stdio_tool" &&
          typeof args?.server_id === "string" &&
          typeof args?.tool_name === "string"
        ) {
          return JSON.stringify({
            server: args.server_id,
            tool: args.tool_name,
            args: typeof args.arguments_json === "string" ? JSON.parse(args.arguments_json) : {},
            mock: true,
          });
        }
        return undefined;
      },
    },
  };
}
