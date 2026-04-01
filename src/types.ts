export interface Session {
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

export interface Message {
  id: number;
  session_id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: number;
  parent_message_id?: number | null;
  branch_id?: string | null;
  event_type?: "message" | "tool_call" | "tool_result" | "artifact" | null;
  /** For role "tool": the tool call id from the model. */
  tool_call_id?: string | null;
  /** For role "tool": the tool name (for Ollama API). */
  tool_name?: string | null;
  /** For role "assistant": tool calls made in this turn (for API replay). */
  tool_calls?: AgentToolCall[] | null;
}

export interface SearchResult {
  session_id: number;
  title: string;
  snippet: string;
}

export interface Artifact {
  id: number;
  session_id: number;
  message_id?: number | null;
  artifact_type: string;
  title?: string | null;
  payload: string;
  created_at: number;
}

export interface ExecutionTrace {
  id: number;
  session_id: number;
  message_id?: number | null;
  trace_type: string;
  trace_payload: string;
  created_at: number;
}

export interface AppConfig {
  backend_type: string | null;
  base_url: string | null;
  model: string | null;
  /** Legacy: used for custom OpenAI-compatible backend. */
  api_key: string | null;
  /** Named API keys per provider: openai, gemini, groq, etc. */
  api_keys?: Record<string, string> | null;
  system_prompt?: string | null;
  theme?: string | null;
  primary_color?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  /** Optional workspace root for agent file tools. Empty = disabled. */
  agent_workspace_path?: string | null;
  /** Open WebUI specific: API endpoint override (defaults to /api). */
  openwebui_api_path?: string | null;
  /** Open WebUI specific: whether tools are enabled by default in UI flows. */
  openwebui_enable_tools?: boolean | null;
  /** Open WebUI specific: whether retrieval-style context is enabled in prompts. */
  openwebui_enable_rag?: boolean | null;
  /** Open WebUI specific: workspace label for multi-workspace setups. */
  openwebui_workspace?: string | null;
  /** Feature flags for phased parity rollout. */
  feature_flags?: Record<string, boolean> | null;
  /** Local runtime profile name. */
  runtime_profile?: string | null;
  /** Knowledge index mode for local-first retrieval. */
  knowledge_index_mode?: "sqlite_fts" | "sqlite_vec" | "sidecar" | null;
  /** Configured MCP servers for tool extensions. */
  mcp_servers?: {
    id: string;
    label: string;
    transport: "stdio" | "http";
    endpoint: string;
    enabled: boolean;
  }[] | null;
  /** Agent tool policy controls (single-user local runtime). */
  tool_policy?: {
    role: "owner" | "trusted" | "restricted";
    mode: "allow_all" | "confirm_all" | "allow_list" | "deny_all";
    allowed_tools?: string[] | null;
    denied_tools?: string[] | null;
    require_confirmation_for?: string[] | null;
  } | null;
  /** Enabled built-in skills by id. */
  enabled_skills?: string[] | null;
  /** Whether skills should be auto-recommended per prompt. */
  skill_auto_recommend?: boolean | null;
  /** Per-skill trust mode for auto recommendations. */
  skill_trust_modes?: Record<string, "auto" | "ask"> | null;
  agent_templates?: {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    tags?: string[] | null;
  }[] | null;
  agent_profiles?: {
    id: string;
    name: string;
    description?: string | null;
    system_prompt: string;
    preferred_model?: string | null;
    preferred_backend?: BackendType | null;
    tools_enabled?: boolean | null;
  }[] | null;
  active_agent_profile_id?: string | null;
  agent_groups?: {
    id: string;
    name: string;
    member_profile_ids: string[];
  }[] | null;
  active_agent_group_id?: string | null;
  workspaces?: {
    id: string;
    name: string;
    description?: string | null;
    root_path?: string | null;
  }[] | null;
  active_workspace_id?: string | null;
  scheduled_tasks?: {
    id: string;
    name: string;
    prompt: string;
    interval_minutes: number;
    enabled: boolean;
    next_run_at?: number | null;
  }[] | null;
  /** Browser-only shell command bridge settings (used outside Tauri). */
  browser_command_bridge_enabled?: boolean | null;
  browser_command_bridge_url?: string | null;
  browser_command_bridge_token?: string | null;
  theme_tokens?: {
    surface_bg?: string | null;
    panel_bg?: string | null;
    text_primary?: string | null;
    text_muted?: string | null;
    border?: string | null;
    radius_scale?: "sm" | "md" | "lg" | null;
    density?: "comfortable" | "compact" | null;
  } | null;
}

export type BackendType = "ollama" | "openai" | "groq" | "openai_compatible" | "open_webui";

export interface TextAttachment {
  type: "text";
  name: string;
  content: string;
}

export interface ImageAttachment {
  type: "image";
  name: string;
  dataBase64: string;
  mimeType: string;
}

export type Attachment = TextAttachment | ImageAttachment;

/** Agent tool call from the model (same shape for OpenAI and Ollama). */
export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentToolExecutionMeta {
  tool_name: string;
  duration_ms: number;
  attempts: number;
  retries: number;
  timed_out?: boolean;
  error_category?: "validation" | "policy" | "timeout" | "runtime";
  status: "success" | "error";
}

/** Agent tool result to send back to the model. */
export interface AgentToolResult {
  tool_call_id: string;
  content: string;
  is_error?: boolean;
  meta?: AgentToolExecutionMeta;
}
