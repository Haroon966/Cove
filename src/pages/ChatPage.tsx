import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { invoke } from "../api/tauri";
import { SessionList } from "../components/SessionList";
import { ChatPanel } from "../components/ChatPanel";
import { ToolAuditTimeline } from "../components/ToolAuditTimeline";
import type { AppLayoutContext } from "../components/AppLayout";
import { applyTheme } from "../components/AppLayout";
import { ArtifactPanel } from "../components/ArtifactPanel";
import { ExecutionTracePanel } from "../components/ExecutionTracePanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { useAgentStreamingChat } from "../hooks/useAgentStreamingChat";
import type {
  Session,
  Message,
  AppConfig,
  SearchResult,
  Attachment,
  AgentToolCall,
  BackendType,
  Artifact,
  ExecutionTrace,
} from "../types";
import { PROVIDER_PRESETS, isFeatureEnabled, resolveRuntimeToolPolicy } from "../configHelpers";
import { supportsProviderCapability } from "../agent/runtime/providerRegistry";
import { sendDesktopNotification } from "../desktop/notifications";
import { flushMetrics, metricIncrement, metricObserveDuration } from "../features/observability/metrics";
import { createArtifact, deleteArtifact, listArtifacts } from "../features/artifacts/artifactService";
import { generateImageWithCurrentConfig } from "../api/images";
import { synthesizeSpeechWithCurrentConfig } from "../api/audio";
import {
  addExecutionTrace,
  clearExecutionTraces,
  listExecutionTraces,
} from "../features/runtime/executionTraceService";
import {
  listKnowledgeDocs,
  listSessionKnowledgeSources,
  retrieveKnowledge,
  setSessionKnowledgeSources,
  type KnowledgeDoc,
} from "../features/knowledge/knowledgeService";
import { type SkillTrustMode } from "../features/skills/skillsCatalog";
import { recommendSkillsFromPrompt } from "../features/skills/skillIntentRouter";
import { buildSkillPromptBlock, resolveSkillContext } from "../features/skills/skillRuntime";

/** Normalize message from DB (tool_calls may be JSON string) to Message. */
function normalizeMessage(m: Message & { tool_calls?: string | AgentToolCall[] | null }): Message {
  let tool_calls: Message["tool_calls"] = m.tool_calls ?? null;
  if (typeof tool_calls === "string") {
    try {
      tool_calls = tool_calls ? (JSON.parse(tool_calls) as AgentToolCall[]) : null;
    } catch {
      tool_calls = null;
    }
  }
  return { ...m, tool_calls };
}

function getLastPersistedMessageId(list: Message[]): number | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].id && list[i].id > 0) return list[i].id;
  }
  return null;
}

interface ChatPageProps {
  forceBackendType?: BackendType;
}

interface MessageBranchInfo {
  branch_id: string | null;
  message_count: number;
  first_created_at: number;
  last_created_at: number;
  preview: string;
}

export default function ChatPage({ forceBackendType }: ChatPageProps) {
  const layoutCtx = useOutletContext<AppLayoutContext | undefined>();
  const onOpenSettings = layoutCtx?.onOpenSettings ?? (() => {});
  const configVersion = layoutCtx?.configVersion ?? 0;

  const configToApplyRef = useRef<AppConfig | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [branches, setBranches] = useState<MessageBranchInfo[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInMessages, setSearchInMessages] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const [plannerMode, setPlannerMode] = useState(true);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [selectedKnowledgeDocIds, setSelectedKnowledgeDocIds] = useState<number[]>([]);
  const [showArtifactPanel, setShowArtifactPanel] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [showTracePanel, setShowTracePanel] = useState(false);
  const [executionTraces, setExecutionTraces] = useState<ExecutionTrace[]>([]);
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState<"1024x1024" | "1024x1792" | "1792x1024">("1024x1024");
  const [imageGenBusy, setImageGenBusy] = useState(false);
  const [imageGenError, setImageGenError] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [lastTurnActiveSkills, setLastTurnActiveSkills] = useState<string[]>([]);
  const [lastTurnRecommendedSkills, setLastTurnRecommendedSkills] = useState<string[]>([]);
  const recentFailedTools = useMemo(() => {
    const failed: string[] = [];
    for (let i = executionTraces.length - 1; i >= 0 && failed.length < 8; i -= 1) {
      const trace = executionTraces[i];
      if (trace.trace_type !== "tool_result") continue;
      try {
        const parsed = JSON.parse(trace.trace_payload) as {
          tool_name?: string | null;
          status?: string;
          error_category?: string;
        };
        if ((parsed.status === "error" || parsed.error_category) && parsed.tool_name) {
          failed.push(parsed.tool_name);
        }
      } catch {
        // ignore malformed traces
      }
    }
    return Array.from(new Set(failed));
  }, [executionTraces]);
  const recentSuccessfulTools = useMemo(() => {
    const success: string[] = [];
    for (let i = executionTraces.length - 1; i >= 0 && success.length < 8; i -= 1) {
      const trace = executionTraces[i];
      if (trace.trace_type !== "tool_result") continue;
      try {
        const parsed = JSON.parse(trace.trace_payload) as {
          tool_name?: string | null;
          status?: string;
          error_category?: string;
        };
        if (parsed.status === "success" && !parsed.error_category && parsed.tool_name) {
          success.push(parsed.tool_name);
        }
      } catch {
        // ignore malformed traces
      }
    }
    return Array.from(new Set(success));
  }, [executionTraces]);

  const finalizeAndSave = useCallback(
    async (sessionId: number, fullContent: string, parentMessageId?: number | null) => {
      try {
        await invoke("message_save", {
          session_id: sessionId,
          role: "assistant",
          content: fullContent,
          tool_call_id: null,
          tool_name: null,
          tool_calls: null,
          parent_message_id: parentMessageId ?? null,
          branch_id: currentBranchId,
          event_type: "message",
        });
      } catch (e) {
        console.error(e);
      }
    },
    [currentBranchId]
  );

  const { send, stop, error, streaming, setError } = useStreamingChat(config);
  const {
    send: agentSend,
    stop: agentStop,
    error: agentError,
    streaming: agentStreaming,
    setError: setAgentError,
  } = useAgentStreamingChat(config);

  const loadSessions = useCallback(async () => {
    try {
      const list = await invoke<Session[]>("session_list");
      setSessions(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: number, branchId?: string | null) => {
    try {
      const list = await invoke<(Message & { tool_calls?: string | unknown })[]>("messages_load_branch", {
        session_id: sessionId,
        branch_id: branchId ?? null,
      });
      setMessages(list.map((m) => normalizeMessage(m as Message & { tool_calls?: string | AgentToolCall[] | null })));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadArtifacts = useCallback(async (sessionId: number) => {
    try {
      const list = await listArtifacts(sessionId);
      setArtifacts(list);
    } catch (e) {
      console.error(e);
      setArtifacts([]);
    }
  }, []);

  const loadExecutionTraces = useCallback(async (sessionId: number) => {
    try {
      const list = await listExecutionTraces(sessionId);
      setExecutionTraces(list);
    } catch (e) {
      console.error(e);
      setExecutionTraces([]);
    }
  }, []);

  const loadBranches = useCallback(async (sessionId: number) => {
    try {
      const list = await invoke<MessageBranchInfo[]>("message_branch_list", {
        session_id: sessionId,
      });
      setBranches(list);
    } catch (e) {
      console.error(e);
      setBranches([]);
    }
  }, []);

  const loadKnowledgeBinding = useCallback(async (sessionId: number) => {
    try {
      const [docs, linkedIds] = await Promise.all([
        listKnowledgeDocs(),
        listSessionKnowledgeSources(sessionId),
      ]);
      setKnowledgeDocs(docs);
      setSelectedKnowledgeDocIds(linkedIds);
    } catch (e) {
      console.error(e);
      setKnowledgeDocs([]);
      setSelectedKnowledgeDocIds([]);
    }
  }, []);

  const buildKnowledgePrompt = useCallback(
    async (query: string, sessionId: number | null): Promise<string | null> => {
      if (!config?.openwebui_enable_rag) return null;
      const snippets = await retrieveKnowledge(query, {
        limit: 6,
        sessionId,
      });
      if (!snippets.length) return null;
      const context = snippets
        .map(
          (s, idx) =>
            `[Source ${idx + 1}] ${s.doc_title} (chunk ${s.chunk_index})\n${s.snippet}`
        )
        .join("\n\n");
      return [
        "Use the following local knowledge context when relevant.",
        "If the answer is not present, say so clearly and do not fabricate citations.",
        "",
        context,
      ].join("\n");
    },
    [config?.openwebui_enable_rag]
  );

  useEffect(() => {
    (async () => {
      try {
        const c = await invoke<AppConfig>("config_load");
        const forcedBaseUrl =
          forceBackendType && forceBackendType in PROVIDER_PRESETS
            ? PROVIDER_PRESETS[forceBackendType as keyof typeof PROVIDER_PRESETS].baseUrl
            : null;
        setConfig({
          backend_type: forceBackendType ?? c.backend_type ?? "ollama",
          base_url: forceBackendType ? forcedBaseUrl ?? c.base_url ?? "http://localhost:11434" : c.base_url ?? "http://localhost:11434",
          model: c.model ?? "llama2",
          api_key: c.api_key ?? null,
          api_keys: c.api_keys ?? null,
          system_prompt: c.system_prompt ?? null,
          theme: c.theme ?? "light",
          primary_color: c.primary_color ?? null,
          temperature: c.temperature ?? null,
          max_tokens: c.max_tokens ?? null,
          agent_workspace_path: c.agent_workspace_path ?? null,
          openwebui_api_path: c.openwebui_api_path ?? "/api",
          openwebui_enable_tools: c.openwebui_enable_tools ?? true,
          openwebui_enable_rag: c.openwebui_enable_rag ?? false,
          openwebui_workspace: c.openwebui_workspace ?? null,
          feature_flags: c.feature_flags ?? null,
          runtime_profile: c.runtime_profile ?? "default",
          knowledge_index_mode: c.knowledge_index_mode ?? "sqlite_fts",
          mcp_servers: c.mcp_servers ?? [],
          tool_policy: c.tool_policy ?? {
            role: "owner",
            mode: "confirm_all",
            allowed_tools: null,
            denied_tools: null,
            require_confirmation_for: ["run_shell_command"],
          },
          enabled_skills: c.enabled_skills ?? [],
          skill_auto_recommend: c.skill_auto_recommend ?? true,
          skill_trust_modes: c.skill_trust_modes ?? {},
          agent_templates: c.agent_templates ?? [],
          agent_profiles: c.agent_profiles ?? [],
          active_agent_profile_id: c.active_agent_profile_id ?? null,
          agent_groups: c.agent_groups ?? [],
          active_agent_group_id: c.active_agent_group_id ?? null,
          workspaces: c.workspaces ?? [],
          active_workspace_id: c.active_workspace_id ?? null,
          scheduled_tasks: c.scheduled_tasks ?? [],
          browser_command_bridge_enabled: c.browser_command_bridge_enabled ?? false,
          browser_command_bridge_url: c.browser_command_bridge_url ?? "http://127.0.0.1:4317",
          browser_command_bridge_token: c.browser_command_bridge_token ?? null,
          theme_tokens: c.theme_tokens ?? null,
        });
      } catch {
        const forcedBaseUrl =
          forceBackendType && forceBackendType in PROVIDER_PRESETS
            ? PROVIDER_PRESETS[forceBackendType as keyof typeof PROVIDER_PRESETS].baseUrl
            : null;
        setConfig({
          backend_type: forceBackendType ?? "ollama",
          base_url: forcedBaseUrl ?? "http://localhost:11434",
          model: "llama2",
          api_key: null,
          api_keys: null,
          system_prompt: null,
          theme: "light",
          primary_color: null,
          temperature: null,
          max_tokens: null,
          agent_workspace_path: null,
          openwebui_api_path: "/api",
          openwebui_enable_tools: true,
          openwebui_enable_rag: false,
          openwebui_workspace: null,
          feature_flags: null,
          runtime_profile: "default",
          knowledge_index_mode: "sqlite_fts",
          mcp_servers: [],
          tool_policy: {
            role: "owner",
            mode: "confirm_all",
            allowed_tools: null,
            denied_tools: null,
            require_confirmation_for: ["run_shell_command"],
          },
          enabled_skills: [],
          skill_auto_recommend: true,
          skill_trust_modes: {},
          agent_templates: [],
          agent_profiles: [],
          active_agent_profile_id: null,
          agent_groups: [],
          active_agent_group_id: null,
          workspaces: [],
          active_workspace_id: null,
          scheduled_tasks: [],
          browser_command_bridge_enabled: false,
          browser_command_bridge_url: "http://127.0.0.1:4317",
          browser_command_bridge_token: null,
          theme_tokens: null,
        });
      }
    })();
  }, [forceBackendType, configVersion]);

  useEffect(() => {
    configToApplyRef.current = config;
    applyTheme(config);
    if (config?.theme === "system") {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme(configToApplyRef.current);
      m.addEventListener("change", listener);
      return () => m.removeEventListener("change", listener);
    }
  }, [config]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showImageGenModal) setShowImageGenModal(false);
      else if (showTracePanel) setShowTracePanel(false);
      else if (showArtifactPanel) setShowArtifactPanel(false);
      else if (showKnowledgePicker) setShowKnowledgePicker(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showImageGenModal, showTracePanel, showArtifactPanel, showKnowledgePicker]);

  useEffect(() => {
    if (currentSessionId !== null) {
      loadMessages(currentSessionId, currentBranchId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId, currentBranchId, loadMessages]);

  useEffect(() => {
    if (currentSessionId !== null) {
      void loadBranches(currentSessionId);
    } else {
      setBranches([]);
    }
  }, [currentSessionId, loadBranches]);

  useEffect(() => {
    if (currentSessionId !== null) {
      void loadArtifacts(currentSessionId);
    } else {
      setArtifacts([]);
    }
  }, [currentSessionId, loadArtifacts]);

  useEffect(() => {
    if (currentSessionId !== null) {
      void loadExecutionTraces(currentSessionId);
    } else {
      setExecutionTraces([]);
    }
  }, [currentSessionId, loadExecutionTraces]);

  useEffect(() => {
    if (currentSessionId === null) {
      setKnowledgeDocs([]);
      setSelectedKnowledgeDocIds([]);
      return;
    }
    void loadKnowledgeBinding(currentSessionId);
  }, [currentSessionId, loadKnowledgeBinding]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const latest = await invoke<AppConfig>("config_load");
        const tasks = latest.scheduled_tasks ?? [];
        if (tasks.length === 0) return;
        const now = Math.floor(Date.now() / 1000);
        let changed = false;
        const updatedTasks = tasks.map((task) => {
          if (!task.enabled) return task;
          const nextRun = task.next_run_at ?? now;
          if (nextRun > now) return task;
          changed = true;
          if (currentSessionId !== null) {
            void addExecutionTrace({
              sessionId: currentSessionId,
              traceType: "scheduled_task_executed",
              tracePayload: JSON.stringify({
                task_id: task.id,
                task_name: task.name,
                prompt: task.prompt,
                executed_at: now,
              }),
            });
          }
          return {
            ...task,
            next_run_at: now + Math.max(1, task.interval_minutes) * 60,
          };
        });
        if (changed) {
          const nextConfig = {
            ...latest,
            scheduled_tasks: updatedTasks,
          };
          await invoke("config_save", { config: nextConfig });
          if (!cancelled) {
            setConfig((prev) => (prev ? { ...prev, scheduled_tasks: updatedTasks } : prev));
            if (currentSessionId !== null) {
              void loadExecutionTraces(currentSessionId);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    const id = setInterval(() => {
      void tick();
    }, 30000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [currentSessionId, loadExecutionTraces]);

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
      setCurrentBranchId(null);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSession = (id: number) => {
    setCurrentSessionId(id);
    setCurrentBranchId(null);
  };

  const handleDeleteSession = async (id: number) => {
    try {
      await invoke("session_delete", { session_id: id });
      const nextSessions = sessions.filter((s) => s.id !== id);
      setSessions(nextSessions);
      if (currentSessionId === id) {
        setCurrentSessionId(nextSessions[0]?.id ?? null);
        setCurrentBranchId(null);
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

  const handleToggleSkillManualOverride = useCallback(
    async (skillId: string, enabled: boolean) => {
      if (!config) return;
      const current = new Set(config.enabled_skills ?? []);
      if (enabled) current.add(skillId);
      else current.delete(skillId);
      const updated: AppConfig = { ...config, enabled_skills: Array.from(current) };
      setConfig(updated);
      try {
        await invoke("config_save", { config: updated });
      } catch (e) {
        console.error(e);
      }
    },
    [config]
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
        const list = await invoke<(Message & { tool_calls?: string | unknown })[]>("messages_load_branch", {
          session_id: sessionId,
          branch_id: currentBranchId,
        });
        const normalizedList = list.map((msg) =>
          normalizeMessage(msg as Message & { tool_calls?: string | AgentToolCall[] | null })
        );
        setMessages(normalizedList);
        setStreamingContent("");
        setError(null);
        let streamed = "";
        const sessionOverride = sessions.find((s) => s.id === sessionId);
        await send(
          sessionId,
          normalizedList,
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
            finalizeAndSave(sessionId, fullContent, getLastPersistedMessageId(normalizedList));
          },
          sessionOverride ? { model: sessionOverride.model, backend_type: sessionOverride.backend_type } : undefined
        );
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId, currentBranchId, config, send, finalizeAndSave, setError, sessions]
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
        const list = await invoke<(Message & { tool_calls?: string | unknown })[]>("messages_load_branch", {
          session_id: sessionId,
          branch_id: currentBranchId,
        });
        const normalizedList = list.map((msg) =>
          normalizeMessage(msg as Message & { tool_calls?: string | AgentToolCall[] | null })
        );
        setMessages(normalizedList);
        setStreamingContent("");
        setError(null);
        let streamed = "";
        const sessionOverride = sessions.find((s) => s.id === sessionId);
        await send(
          sessionId,
          normalizedList,
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
            finalizeAndSave(sessionId, fullContent, getLastPersistedMessageId(normalizedList));
          },
          sessionOverride ? { model: sessionOverride.model, backend_type: sessionOverride.backend_type } : undefined
        );
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId, currentBranchId, config, send, finalizeAndSave, setError, sessions]
  );

  const handleSend = async (text: string, attachment?: Attachment | null) => {
    const requestStartedAt = performance.now();
    metricIncrement("chat_requests_total", 1);
    let sessionId = currentSessionId;
    const now = Math.floor(Date.now() / 1000);

    if (sessionId === null) {
      const title = text.slice(0, 50) || "New chat";
      try {
        sessionId = await invoke<number>("session_create", { title });
        setCurrentSessionId(sessionId);
        await loadSessions();
      } catch (e) {
        console.error(e);
        // Fallback: create an in-memory session when persistence is unavailable (e.g. dev/web without Tauri)
        sessionId = Date.now();
        setCurrentSessionId(sessionId);
        setSessions((prev) => [
          {
            id: sessionId as number,
            title,
            created_at: now,
            updated_at: now,
            model: null,
            backend_type: null,
          },
          ...prev,
        ]);
      }
    }

    const messageContent = text;
    const inferredParentId = getLastPersistedMessageId(messages);
    let persistedUserMessageId: number | null = null;

    try {
      persistedUserMessageId = await invoke<number>("message_save", {
        session_id: sessionId,
        role: "user",
        content: messageContent,
        tool_call_id: null,
        tool_name: null,
        tool_calls: null,
        parent_message_id: inferredParentId,
        branch_id: currentBranchId,
        event_type: "message",
      });
      await loadBranches(sessionId);
    } catch (e) {
      // In dev/web (no Tauri) this will fail; log and continue without persistence
      console.error(e);
    }
    try {
      await addExecutionTrace({
        sessionId: sessionId,
        messageId: persistedUserMessageId,
        traceType: "user_message",
        tracePayload: JSON.stringify({ content_preview: messageContent.slice(0, 200) }),
      });
      await loadExecutionTraces(sessionId);
    } catch (e) {
      console.error(e);
    }

    const currentSession = sessions.find((s) => s.id === sessionId);
    if (currentSession?.title === "New chat") {
      const newTitle = messageContent.slice(0, 50).trim() || "New chat";
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
        content: messageContent,
        created_at: now,
      },
    ]);
    let streamed = "";
    setStreamingContent("");
    setError(null);
    setAgentError(null);
    const sessionOverride = sessions.find((s) => s.id === sessionId);
    const effectiveSessionOverride = {
      model: activeAgentProfile?.preferred_model ?? sessionOverride?.model ?? null,
      backend_type: activeAgentProfile?.preferred_backend ?? sessionOverride?.backend_type ?? null,
    };
    const lastMessageImages =
      attachment?.type === "image"
        ? [{ base64: attachment.dataBase64, mimeType: attachment.mimeType }]
        : undefined;
    const messageList = [
      ...messages,
      { id: 0, session_id: sessionId, role: "user" as const, content: messageContent, created_at: 0 },
    ];
    let extraSystemPrompt: string | null = null;
    try {
      extraSystemPrompt = await buildKnowledgePrompt(messageContent, sessionId);
    } catch (e) {
      console.error(e);
    }
    if (activeAgentProfile?.system_prompt?.trim()) {
      extraSystemPrompt = [activeAgentProfile.system_prompt.trim(), extraSystemPrompt]
        .filter(Boolean)
        .join("\n\n");
    }
    if (activeWorkspace) {
      const workspaceContext = [
        `Current workspace: ${activeWorkspace.name}`,
        activeWorkspace.description ? `Description: ${activeWorkspace.description}` : null,
        activeWorkspace.root_path ? `Root path: ${activeWorkspace.root_path}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      extraSystemPrompt = [workspaceContext, extraSystemPrompt].filter(Boolean).join("\n\n");
    }
    const autoRecommendEnabled =
      (config?.feature_flags?.["skills.autoRecommend.enabled"] ?? true) &&
      (config?.skill_auto_recommend ?? true);
    const skillRecommendations = autoRecommendEnabled
      ? recommendSkillsFromPrompt(messageContent, 3, {
          recentFailedTools,
          recentSuccessfulTools,
          previousSkillIds: lastTurnActiveSkills,
        })
      : [];
    const trustModes = (config?.skill_trust_modes ?? {}) as Record<string, SkillTrustMode>;
    const skillContext = resolveSkillContext({
      manualSkillIds: config?.enabled_skills ?? [],
      recommendations: skillRecommendations,
      trustModes,
    });
    const skillPromptBlock = buildSkillPromptBlock(skillContext);
    if (skillPromptBlock) {
      extraSystemPrompt = [extraSystemPrompt, skillPromptBlock].filter(Boolean).join("\n\n");
    }
    setLastTurnActiveSkills(skillContext.selectedSkillIds);
    setLastTurnRecommendedSkills(skillRecommendations.map((r) => r.skillId));
    try {
      await addExecutionTrace({
        sessionId: sessionId,
        traceType: "skill_selection",
        tracePayload: JSON.stringify({
          auto_recommend_enabled: autoRecommendEnabled,
          selected: skillContext.selectedSkillIds,
          recommended: skillRecommendations,
          reasons: skillContext.recommendationReasons,
        }),
      });
    } catch (traceErr) {
      console.error(traceErr);
    }
    if (agentMode && activeGroupProfiles.length > 0) {
      const collaboratorNotes: string[] = [];
      for (const profile of activeGroupProfiles) {
        try {
          const profileSystemPrompt = [
            profile.system_prompt?.trim(),
            "You are part of a multi-agent group. Return concise findings for the final coordinator.",
          ]
            .filter(Boolean)
            .join("\n\n");
          const memberOutput = await new Promise<string>((resolve) => {
            let buffered = "";
            void send(
              sessionId,
              messageList,
              (chunk) => {
                buffered += chunk;
              },
              (full) => resolve(full || buffered),
              {
                model: profile.preferred_model ?? effectiveSessionOverride.model ?? null,
                backend_type: profile.preferred_backend ?? effectiveSessionOverride.backend_type ?? null,
              },
              {
                ...(lastMessageImages ? { lastMessageImages } : {}),
                extraSystemPrompt: profileSystemPrompt,
              }
            ).catch(() => resolve(buffered));
          });
          collaboratorNotes.push(`- ${profile.name}: ${memberOutput.slice(0, 800)}`);
          await addExecutionTrace({
            sessionId: sessionId!,
            traceType: "group_member_result",
            tracePayload: JSON.stringify({
              profile_id: profile.id,
              profile_name: profile.name,
              output_preview: memberOutput.slice(0, 240),
            }),
          });
        } catch (e) {
          console.error(e);
        }
      }
      if (collaboratorNotes.length > 0) {
        extraSystemPrompt = [
          extraSystemPrompt,
          "Multi-agent collaborator notes (use as additional context):",
          collaboratorNotes.join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n");
      }
    }

    const profileToolsDisabled = activeAgentProfile?.tools_enabled === false;
    const effectiveToolPolicy = resolveRuntimeToolPolicy(
      config?.tool_policy ?? null,
      skillContext.toolPolicy,
      profileToolsDisabled
    );
    try {
      await addExecutionTrace({
        sessionId: sessionId,
        traceType: "tool_policy_resolved",
        tracePayload: JSON.stringify({
          profile_tools_disabled: profileToolsDisabled,
          role: effectiveToolPolicy.role,
          mode: effectiveToolPolicy.mode,
          allowed_tools: effectiveToolPolicy.allowed_tools,
          denied_tools: effectiveToolPolicy.denied_tools,
          require_confirmation_for: effectiveToolPolicy.require_confirmation_for,
        }),
      });
    } catch (traceErr) {
      console.error(traceErr);
    }

    const onToolTurn = async (
      assistantContent: string,
      toolCalls: AgentToolCall[],
      toolResults: {
        tool_call_id: string;
        content: string;
        is_error?: boolean;
        meta?: {
          tool_name: string;
          duration_ms: number;
          attempts: number;
          retries: number;
          timed_out?: boolean;
          error_category?: string;
          status: "success" | "error";
        };
      }[]
    ): Promise<Message[]> => {
      try {
        await invoke("message_save", {
          session_id: sessionId,
          role: "assistant",
          content: assistantContent,
          tool_call_id: null,
          tool_name: null,
          tool_calls: JSON.stringify(toolCalls),
          parent_message_id: persistedUserMessageId ?? inferredParentId,
          branch_id: currentBranchId,
          event_type: "tool_call",
        });
        try {
          await addExecutionTrace({
            sessionId: sessionId,
            traceType: "tool_call_turn",
            tracePayload: JSON.stringify({
              assistant_content_preview: assistantContent.slice(0, 180),
              tool_calls: toolCalls.map((t) => ({ id: t.id, name: t.name })),
            }),
          });
        } catch (traceErr) {
          console.error(traceErr);
        }
        for (let i = 0; i < toolResults.length; i++) {
          await invoke("message_save", {
            session_id: sessionId,
            role: "tool",
            content: toolResults[i].content,
            tool_call_id: toolResults[i].tool_call_id,
            tool_name: toolCalls[i]?.name ?? null,
            tool_calls: null,
            branch_id: currentBranchId,
            event_type: "tool_result",
          });
          try {
            await addExecutionTrace({
              sessionId: sessionId,
              traceType: "tool_result",
              tracePayload: JSON.stringify({
                tool_call_id: toolResults[i].tool_call_id,
                tool_name: toolCalls[i]?.name ?? null,
                content_preview: toolResults[i].content.slice(0, 200),
                status: toolResults[i].meta?.status ?? (toolResults[i].is_error ? "error" : "success"),
                duration_ms: toolResults[i].meta?.duration_ms ?? null,
                retries: toolResults[i].meta?.retries ?? 0,
                attempts: toolResults[i].meta?.attempts ?? 1,
                timed_out: toolResults[i].meta?.timed_out ?? false,
                error_category: toolResults[i].meta?.error_category ?? null,
              }),
            });
          } catch (traceErr) {
            console.error(traceErr);
          }
        }
        const list = await invoke<(Message & { tool_calls?: string | unknown })[]>("messages_load_branch", {
          session_id: sessionId,
          branch_id: currentBranchId,
        });
        const normalized = list.map((m) =>
          normalizeMessage(m as Message & { tool_calls?: string | AgentToolCall[] | null })
        );
        setMessages(normalized);
        await loadExecutionTraces(sessionId);
        return normalized;
      } catch (e) {
        console.error(e);
        return messageList;
      }
    };

    if (agentMode) {
      await agentSend(
        sessionId,
        messageList,
        (chunk) => {
          streamed += chunk;
          setStreamingContent(streamed);
        },
        (fullContent) => {
          metricObserveDuration("agent_request_duration", performance.now() - requestStartedAt);
          metricIncrement("chat_responses_total", 1);
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
          finalizeAndSave(sessionId!, fullContent, persistedUserMessageId ?? inferredParentId);
          if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            void sendDesktopNotification("Cove: Reply ready", fullContent.slice(0, 160));
          }
          void addExecutionTrace({
            sessionId: sessionId!,
            traceType: "assistant_final",
            tracePayload: JSON.stringify({ content_preview: fullContent.slice(0, 240) }),
          }).then(() => loadExecutionTraces(sessionId!)).catch(console.error);
          void flushMetrics("agent_response_metrics").catch(() => {});
        },
        effectiveSessionOverride,
        {
          lastMessageImages,
          onToolTurn,
          extraSystemPrompt: extraSystemPrompt ?? undefined,
          skillContext,
          toolPolicy: effectiveToolPolicy,
          recentToolFailures: recentFailedTools,
          toolExecution: {
            timeoutMs: 25000,
            maxRetries: 1,
            retryBackoffMs: 600,
            maxParallelTools: isFeatureEnabled(config, "agent.tools.maxParallel.enabled", true) ? 2 : 1,
            forceSequentialTools: !isFeatureEnabled(config, "agent.tools.parallel.enabled", true),
          },
          planner: { enabled: plannerMode, maxSteps: 5 },
          onPlannerEvent: async (event) => {
            try {
              await addExecutionTrace({
                sessionId: sessionId!,
                traceType: `planner_${event.type}`,
                tracePayload: JSON.stringify({
                  step: event.step ?? null,
                  step_index: event.stepIndex ?? null,
                  plan: event.plan ?? null,
                  output_preview: event.stepOutputPreview ?? null,
                }),
              });
            } catch (traceErr) {
              console.error(traceErr);
            }
          },
          onShellApprove: (command: string) =>
            Promise.resolve(
              window.confirm(
                `Allow agent to run this command?\n\n${command}\n\nOnly approve if you trust the model and the command.`
              )
            ),
        }
      );
    } else {
      await send(
        sessionId,
        messageList,
        (chunk) => {
          streamed += chunk;
          setStreamingContent(streamed);
        },
        (fullContent) => {
          metricObserveDuration("chat_request_duration", performance.now() - requestStartedAt);
          metricIncrement("chat_responses_total", 1);
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
          finalizeAndSave(sessionId!, fullContent, persistedUserMessageId ?? inferredParentId);
          if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            void sendDesktopNotification("Cove: Reply ready", fullContent.slice(0, 160));
          }
          void addExecutionTrace({
            sessionId: sessionId!,
            traceType: "assistant_final",
            tracePayload: JSON.stringify({ content_preview: fullContent.slice(0, 240) }),
          }).then(() => loadExecutionTraces(sessionId!)).catch(console.error);
          void flushMetrics("chat_response_metrics").catch(() => {});
        },
        effectiveSessionOverride,
        {
          ...(lastMessageImages ? { lastMessageImages } : {}),
          ...(extraSystemPrompt ? { extraSystemPrompt } : {}),
        }
      );
    }
  };

  const handleRenameSession = useCallback(async (sessionId: number, title: string) => {
    try {
      await invoke("session_update_title", { session_id: sessionId, title });
      await loadSessions();
    } catch (e) {
      console.error(e);
    }
  }, [loadSessions]);

  const handleBranchFrom = useCallback(
    async (fromMessageId: number) => {
      if (currentSessionId === null) return;
      const branchId = `branch-${fromMessageId}-${Date.now()}`;
      try {
        await invoke("session_set_branch_root", {
          session_id: currentSessionId,
          branch_root_message_id: fromMessageId,
        });
      } catch {
        // best-effort in browser/mock mode
      }
      setCurrentBranchId(branchId);
      void loadBranches(currentSessionId);
    },
    [currentSessionId, loadBranches]
  );

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  }, []);

  const handleCreateArtifactFromMessage = useCallback(
    async (messageId: number, content: string) => {
      if (currentSessionId === null) return;
      try {
        await createArtifact({
          sessionId: currentSessionId,
          messageId,
          artifactType: "markdown",
          title: `Artifact ${new Date().toLocaleString()}`,
          payload: JSON.stringify({ content }),
        });
        await loadArtifacts(currentSessionId);
        setShowArtifactPanel(true);
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId, loadArtifacts]
  );

  const handleDeleteArtifact = useCallback(
    async (artifactId: number) => {
      if (currentSessionId === null) return;
      try {
        await deleteArtifact(artifactId);
        await loadArtifacts(currentSessionId);
      } catch (e) {
        console.error(e);
      }
    },
    [currentSessionId, loadArtifacts]
  );

  const handleClearExecutionTraces = useCallback(async () => {
    if (currentSessionId === null) return;
    try {
      await clearExecutionTraces(currentSessionId);
      await loadExecutionTraces(currentSessionId);
    } catch (e) {
      console.error(e);
    }
  }, [currentSessionId, loadExecutionTraces]);

  const handleGenerateImage = useCallback(async () => {
    if (currentSessionId === null || !config) return;
    const prompt = imagePrompt.trim();
    if (!prompt) return;
    setImageGenBusy(true);
    setImageGenError(null);
    try {
      const result = await generateImageWithCurrentConfig(config, prompt, {
        size: imageSize,
      });
      const imageLink = result.dataUrl ?? result.imageUrl;
      if (!imageLink) throw new Error("No image returned by provider.");
      const md = `Generated image for prompt: "${prompt}"\n\n![generated image](${imageLink})`;
      const parent = getLastPersistedMessageId(messages);
      await invoke("message_save", {
        session_id: currentSessionId,
        role: "assistant",
        content: md,
        tool_call_id: null,
        tool_name: null,
        tool_calls: null,
        parent_message_id: parent,
        branch_id: currentBranchId,
        event_type: "artifact",
      });
      await createArtifact({
        sessionId: currentSessionId,
        messageId: parent,
        artifactType: "image",
        title: `Image - ${prompt.slice(0, 40)}`,
        payload: JSON.stringify({
          prompt,
          revised_prompt: result.revisedPrompt ?? null,
          size: imageSize,
          image: imageLink,
        }),
      });
      await loadMessages(currentSessionId, currentBranchId);
      await loadArtifacts(currentSessionId);
      setShowImageGenModal(false);
      setShowArtifactPanel(true);
      setImagePrompt("");
    } catch (e) {
      setImageGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setImageGenBusy(false);
    }
  }, [
    currentSessionId,
    config,
    imagePrompt,
    imageSize,
    messages,
    currentBranchId,
    loadMessages,
    loadArtifacts,
  ]);

  const handleSpeakMessage = useCallback(
    async (content: string) => {
      if (!config) return;
      setTtsBusy(true);
      setTtsError(null);
      try {
        const blob = await synthesizeSpeechWithCurrentConfig(config, content.slice(0, 4000));
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        await audio.play();
      } catch (e) {
        setTtsError(e instanceof Error ? e.message : String(e));
      } finally {
        setTtsBusy(false);
      }
    },
    [config]
  );

  const handleOpenKnowledgePicker = useCallback(async () => {
    if (currentSessionId === null) return;
    await loadKnowledgeBinding(currentSessionId);
    setShowKnowledgePicker(true);
  }, [currentSessionId, loadKnowledgeBinding]);

  const handleSaveKnowledgePicker = useCallback(async () => {
    if (currentSessionId === null) return;
    try {
      await setSessionKnowledgeSources(currentSessionId, selectedKnowledgeDocIds);
      setShowKnowledgePicker(false);
    } catch (e) {
      console.error(e);
    }
  }, [currentSessionId, selectedKnowledgeDocIds]);

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
  const activeAgentProfile = useMemo(
    () =>
      (config?.agent_profiles ?? []).find((p) => p.id === (config?.active_agent_profile_id ?? "")) ??
      null,
    [config?.agent_profiles, config?.active_agent_profile_id]
  );
  const activeAgentGroup = useMemo(
    () =>
      (config?.agent_groups ?? []).find((g) => g.id === (config?.active_agent_group_id ?? "")) ??
      null,
    [config?.agent_groups, config?.active_agent_group_id]
  );
  const activeGroupProfiles = useMemo(() => {
    if (!activeAgentGroup) return [];
    const all = config?.agent_profiles ?? [];
    return activeAgentGroup.member_profile_ids
      .map((id) => all.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [activeAgentGroup, config?.agent_profiles]);
  const activeWorkspace = useMemo(
    () =>
      (config?.workspaces ?? []).find((w) => w.id === (config?.active_workspace_id ?? "")) ?? null,
    [config?.workspaces, config?.active_workspace_id]
  );
  const activeChatTitle = currentSession?.title ?? "New chat";
  const activeLabel = forceBackendType === "open_webui" ? "Open WebUI Chat" : "Active Chat";
  const supportsImageGeneration = supportsProviderCapability(config?.backend_type, "image_generation");

  return (
    <>
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
        onOpenSettings={onOpenSettings}
      />
      <div className="flex flex-col flex-1 overflow-hidden bg-background">
        {/* Chat header */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">{activeLabel}:</span>
            <span className="text-sm font-medium truncate">{activeChatTitle}</span>
            {agentMode && activeAgentGroup && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {activeAgentGroup.name} ({activeGroupProfiles.length})
              </Badge>
            )}
            {activeWorkspace && (
              <Badge variant="outline" className="text-xs shrink-0">{activeWorkspace.name}</Badge>
            )}
            {currentSessionId !== null && branches.length > 0 && (
              <select
                className="h-6 text-xs bg-muted border border-border rounded px-1.5 text-muted-foreground"
                value={currentBranchId ?? ""}
                onChange={(e) => setCurrentBranchId(e.target.value || null)}
                title="Conversation branch"
              >
                {branches.map((b) => (
                  <option key={b.branch_id ?? "main"} value={b.branch_id ?? ""}>
                    {(b.branch_id ? "Branch" : "Main") +
                      ` (${b.message_count}) - ` +
                      (b.preview ? b.preview.slice(0, 28) : "empty")}
                  </option>
                ))}
              </select>
            )}
          </div>
          {currentSessionId !== null && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShowArtifactPanel(true)}>
                Artifacts
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShowTracePanel(true)}>
                Traces
              </Button>
              {agentMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setPlannerMode((v) => !v)}
                >
                  {plannerMode ? "Planner: On" : "Planner: Off"}
                </Button>
              )}
              {supportsImageGeneration && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShowImageGenModal(true)}>
                  Image
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => void handleOpenKnowledgePicker()}>
                Knowledge
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => handleExportSession("markdown")}>
                .md
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => handleExportSession("json")}>
                .json
              </Button>
            </div>
          )}
        </header>

        <ToolAuditTimeline messages={messages} traces={executionTraces} />

        {(ttsBusy || ttsError) && (
          <div className="px-4 py-1.5 text-xs text-muted-foreground bg-muted/50 border-b border-border">
            {ttsBusy ? "Generating speech…" : `TTS error: ${ttsError}`}
          </div>
        )}

        <ChatPanel
          sessionId={currentSessionId}
          messages={messages}
          streamingContent={streamingContent}
          streaming={agentMode ? agentStreaming : streaming}
          error={agentMode ? agentError : error}
          config={config}
          effectiveModel={currentSession?.model ?? config?.model ?? null}
          onModelChange={handleModelChange}
          onStop={agentMode ? agentStop : stop}
          onSend={handleSend}
          onEditAndResend={handleEditAndResend}
          onRegenerateFrom={handleRegenerateFrom}
          onBranchFrom={handleBranchFrom}
          onCreateArtifactFromMessage={handleCreateArtifactFromMessage}
          onSpeakMessage={(content) => void handleSpeakMessage(content)}
          onCopyMessage={handleCopyMessage}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          activeSkillIds={lastTurnActiveSkills}
          recommendedSkillIds={lastTurnRecommendedSkills}
          onToggleSkillOverride={handleToggleSkillManualOverride}
        />
      </div>

      {/* Knowledge picker dialog */}
      <Dialog open={showKnowledgePicker && currentSessionId !== null} onOpenChange={(v) => !v && setShowKnowledgePicker(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Knowledge Sources</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select documents for retrieval. If none selected, all documents are used.
          </p>
          <ScrollArea className="max-h-64 mt-2">
            {knowledgeDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No knowledge documents. Add documents on the Knowledge page.</p>
            ) : (
              <div className="space-y-2 pr-2">
                {knowledgeDocs.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      className="rounded border-border accent-primary"
                      checked={selectedKnowledgeDocIds.includes(doc.id)}
                      onChange={(e) =>
                        setSelectedKnowledgeDocIds((prev) =>
                          e.target.checked ? [...prev, doc.id] : prev.filter((id) => id !== doc.id)
                        )
                      }
                    />
                    <span className="text-sm">
                      {doc.title}{" "}
                      <span className="text-muted-foreground text-xs">({doc.chunk_count} chunks)</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKnowledgePicker(false)}>Cancel</Button>
            <Button onClick={() => void handleSaveKnowledgePicker()}>Save sources</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Artifact panel dialog */}
      <Dialog open={showArtifactPanel && currentSessionId !== null} onOpenChange={(v) => !v && setShowArtifactPanel(false)}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Artifact Panel</DialogTitle>
          </DialogHeader>
          <ArtifactPanel artifacts={artifacts} onDelete={handleDeleteArtifact} />
          <DialogFooter>
            <Button onClick={() => setShowArtifactPanel(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trace panel dialog */}
      <Dialog open={showTracePanel && currentSessionId !== null} onOpenChange={(v) => !v && setShowTracePanel(false)}>
        <DialogContent className="max-w-3xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Execution Traces</DialogTitle>
          </DialogHeader>
          <ExecutionTracePanel traces={executionTraces} onClear={() => void handleClearExecutionTraces()} />
          <DialogFooter>
            <Button onClick={() => setShowTracePanel(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image generation dialog */}
      <Dialog open={showImageGenModal && currentSessionId !== null} onOpenChange={(v) => !v && setShowImageGenModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={5}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Describe the image you want to generate…"
              className="resize-none"
            />
            <Select
              value={imageSize}
              onValueChange={(v) => setImageSize(v as "1024x1024" | "1024x1792" | "1792x1024")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1024x1024">1024×1024 (square)</SelectItem>
                <SelectItem value="1024x1792">1024×1792 (portrait)</SelectItem>
                <SelectItem value="1792x1024">1792×1024 (landscape)</SelectItem>
              </SelectContent>
            </Select>
            {imageGenError && (
              <p className="text-xs text-destructive">{imageGenError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageGenModal(false)} disabled={imageGenBusy}>Cancel</Button>
            <Button onClick={() => void handleGenerateImage()} disabled={imageGenBusy || !imagePrompt.trim()}>
              {imageGenBusy ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
