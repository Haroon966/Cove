/**
 * Agent tool definitions (OpenAI function format) and executor.
 * In Tauri: runs real commands; in browser: returns "not available" stubs.
 */

import { invoke } from "../api/tauri";
import type { AgentToolCall, AgentToolResult } from "../types";
import type { AppConfig } from "../types";
import { dispatchMcpTool } from "../features/mcp/mcpRuntime";
import { runBrowserShellCommand } from "../api/browserCommandBridge";

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
}

export type { AgentToolCall as ToolCall, AgentToolResult as ToolResult };

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const BROWSER_MSG = "Not available in browser. Use the desktop app for agent tools.";
const MAX_SHELL_OUTPUT_CHARS = 16000;
const MAX_FILE_READ_CHARS = 200000;
const MAX_FILE_WRITE_CHARS = 200000;
const MAX_DIR_LIST_ENTRIES = 1000;
const DEFAULT_TOOL_TIMEOUT_MS = 25000;
const DEFAULT_TOOL_MAX_RETRIES = 1;
const DEFAULT_TOOL_RETRY_BACKOFF_MS = 600;

function expectedArgumentsHint(toolName: string): string {
  switch (toolName) {
    case "run_shell_command":
      return `Expected JSON: {"command":"..."}`;
    case "read_file":
    case "list_dir":
      return `Expected JSON: {"path":"..."}`;
    case "write_file":
      return `Expected JSON: {"path":"...","contents":"..."}`;
    case "mcp_call_tool":
      return `Expected JSON: {"server_id":"...","tool_name":"...","arguments":"{...}"}`;
    default:
      return "Expected a valid JSON object.";
  }
}

function tryRepairToolArguments(raw: string): string {
  let candidate = raw.trim();
  if (!candidate) return "{}";
  if (candidate.endsWith(",")) candidate = candidate.slice(0, -1);
  const openCurly = (candidate.match(/\{/g) ?? []).length;
  const closeCurly = (candidate.match(/\}/g) ?? []).length;
  if (openCurly > closeCurly) candidate += "}".repeat(openCurly - closeCurly);
  const openSquare = (candidate.match(/\[/g) ?? []).length;
  const closeSquare = (candidate.match(/\]/g) ?? []).length;
  if (openSquare > closeSquare) candidate += "]".repeat(openSquare - closeSquare);
  return candidate;
}

export const AGENT_TOOLS: OpenAITool[] = [
  {
    type: "function",
    function: {
      name: "run_shell_command",
      description: "Run a shell command. Use for executing terminal commands (e.g. bash, sh).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to run" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file. Path is relative to the agent workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file relative to workspace" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write contents to a file. Path is relative to the agent workspace. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file relative to workspace" },
          contents: { type: "string", description: "Content to write" },
        },
        required: ["path", "contents"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List directory contents. Path is relative to the agent workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the directory relative to workspace" },
          recursive: { type: "boolean", description: "If true, list recursively" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mcp_list_servers",
      description: "List configured MCP servers and whether they are enabled.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mcp_call_tool",
      description: "Call a tool exposed by a configured MCP server.",
      parameters: {
        type: "object",
        properties: {
          server_id: { type: "string", description: "Configured MCP server id" },
          tool_name: { type: "string", description: "Tool name to invoke on MCP server" },
          arguments: { type: "string", description: "JSON string arguments for the MCP tool" },
        },
        required: ["server_id", "tool_name"],
      },
    },
  },
];

export interface ExecuteToolOptions {
  /** When set, run_shell_command will call this before executing; if it returns false, the command is not run. */
  onShellApprove?: (command: string) => Promise<boolean>;
  toolPolicy?: {
    role: "owner" | "trusted" | "restricted";
    mode: "allow_all" | "confirm_all" | "allow_list" | "deny_all";
    allowed_tools?: string[] | null;
    denied_tools?: string[] | null;
    require_confirmation_for?: string[] | null;
  } | null;
  skillToolPolicy?: {
    allowed_tools?: string[] | null;
    denied_tools?: string[] | null;
    require_confirmation_for?: string[] | null;
  } | null;
  execution?: {
    timeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
  };
}

export function getAgentToolsByNames(toolNames?: string[] | null): OpenAITool[] {
  if (!toolNames?.length) return AGENT_TOOLS;
  const allowed = new Set(toolNames);
  return AGENT_TOOLS.filter((tool) => allowed.has(tool.function.name));
}

export function evaluateToolPolicy(
  toolName: string,
  policy?: ExecuteToolOptions["toolPolicy"]
): { allowed: boolean; requireConfirm: boolean; reason?: string } {
  const normalized = policy ?? {
    role: "owner",
    mode: "confirm_all",
    allowed_tools: null,
    denied_tools: null,
    require_confirmation_for: ["run_shell_command"],
  };
  if (normalized.role === "restricted" && toolName === "run_shell_command") {
    return { allowed: false, requireConfirm: false, reason: "restricted role blocks shell commands" };
  }
  if ((normalized.denied_tools ?? []).includes(toolName)) {
    return { allowed: false, requireConfirm: false, reason: "tool is explicitly denied by policy" };
  }
  if (normalized.mode === "deny_all") {
    return { allowed: false, requireConfirm: false, reason: "policy mode deny_all" };
  }
  if (normalized.mode === "allow_list") {
    const allow = normalized.allowed_tools ?? [];
    if (!allow.includes(toolName)) {
      return { allowed: false, requireConfirm: false, reason: "tool not in allow_list" };
    }
    return { allowed: true, requireConfirm: false };
  }
  if (normalized.mode === "confirm_all") {
    return { allowed: true, requireConfirm: true };
  }
  return {
    allowed: true,
    requireConfirm: (normalized.require_confirmation_for ?? []).includes(toolName),
  };
}

function evaluateSkillToolPolicy(
  toolName: string,
  policy?: ExecuteToolOptions["skillToolPolicy"]
): { allowed: boolean; requireConfirm: boolean; reason?: string } {
  if (!policy) return { allowed: true, requireConfirm: false };
  if ((policy.denied_tools ?? []).includes(toolName)) {
    return { allowed: false, requireConfirm: false, reason: "blocked by active skill policy" };
  }
  const allowed = policy.allowed_tools ?? [];
  if (allowed.length > 0 && !allowed.includes(toolName)) {
    return { allowed: false, requireConfirm: false, reason: "tool not enabled by active skills" };
  }
  return {
    allowed: true,
    requireConfirm: (policy.require_confirmation_for ?? []).includes(toolName),
  };
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TOOL_TIMEOUT:${label}:${timeoutMs}`)), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function getRequiredParams(toolName: string): string[] {
  const tool = AGENT_TOOLS.find((t) => t.function.name === toolName);
  return tool?.function.parameters.required ?? [];
}

function validateToolArgs(toolName: string, parsed: Record<string, unknown>): string | null {
  for (const required of getRequiredParams(toolName)) {
    if (!(required in parsed)) {
      return `Missing required argument "${required}". ${expectedArgumentsHint(toolName)}`;
    }
  }
  switch (toolName) {
    case "run_shell_command":
      if (typeof parsed.command !== "string" || !parsed.command.trim()) {
        return `Invalid "command" argument. ${expectedArgumentsHint(toolName)}`;
      }
      return null;
    case "read_file":
    case "list_dir":
      if (typeof parsed.path !== "string" || !parsed.path.trim()) {
        return `Invalid "path" argument. ${expectedArgumentsHint(toolName)}`;
      }
      return null;
    case "write_file":
      if (typeof parsed.path !== "string" || !parsed.path.trim()) {
        return `Invalid "path" argument. ${expectedArgumentsHint(toolName)}`;
      }
      if (typeof parsed.contents !== "string") {
        return `Invalid "contents" argument. ${expectedArgumentsHint(toolName)}`;
      }
      if (parsed.contents.length > MAX_FILE_WRITE_CHARS) {
        return `Refusing to write more than ${MAX_FILE_WRITE_CHARS} characters in one tool call.`;
      }
      return null;
    case "mcp_call_tool":
      if (typeof parsed.server_id !== "string" || !parsed.server_id.trim()) {
        return `Invalid "server_id" argument. ${expectedArgumentsHint(toolName)}`;
      }
      if (typeof parsed.tool_name !== "string" || !parsed.tool_name.trim()) {
        return `Invalid "tool_name" argument. ${expectedArgumentsHint(toolName)}`;
      }
      return null;
    default:
      return null;
  }
}

function shouldRetryTool(name: string, errorMessage: string): boolean {
  if (name === "read_file" || name === "write_file") return false;
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("temporary") ||
    lower.includes("429") ||
    lower.includes("503")
  );
}

function classifyError(errorMessage: string): "validation" | "policy" | "timeout" | "runtime" {
  if (errorMessage.startsWith("TOOL_TIMEOUT:")) return "timeout";
  if (errorMessage.includes("Invalid") || errorMessage.includes("Missing required")) return "validation";
  if (errorMessage.includes("Blocked by")) return "policy";
  return "runtime";
}

export async function executeTool(
  call: AgentToolCall,
  options?: ExecuteToolOptions
): Promise<AgentToolResult> {
  const { id, name, arguments: argsStr } = call;
  let content: string;
  let is_error = false;
  const runningInTauri = isTauri();
  const startedAt = Date.now();
  const timeoutMs = Math.max(1000, options?.execution?.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS);
  const maxRetries = Math.max(0, options?.execution?.maxRetries ?? DEFAULT_TOOL_MAX_RETRIES);
  const retryBackoffMs = Math.max(0, options?.execution?.retryBackoffMs ?? DEFAULT_TOOL_RETRY_BACKOFF_MS);
  let attempts = 0;
  let retries = 0;
  let timedOut = false;
  let errorCategory: "validation" | "policy" | "timeout" | "runtime" | undefined;

  try {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(argsStr || "{}") as Record<string, unknown>;
    } catch {
      try {
        parsed = JSON.parse(tryRepairToolArguments(argsStr || "{}")) as Record<string, unknown>;
      } catch {
        const preview = (argsStr || "").slice(0, 180);
        content = `Invalid JSON arguments for tool "${name}". ${expectedArgumentsHint(name)} Received: ${preview || "(empty)"}`;
        return {
          tool_call_id: id,
          content,
          is_error: true,
          meta: {
            tool_name: name,
            duration_ms: Date.now() - startedAt,
            attempts: 1,
            retries: 0,
            error_category: "validation",
            status: "error",
          },
        };
      }
    }
    const validationError = validateToolArgs(name, parsed);
    if (validationError) {
      return {
        tool_call_id: id,
        content: validationError,
        is_error: true,
        meta: {
          tool_name: name,
          duration_ms: Date.now() - startedAt,
          attempts: 1,
          retries: 0,
          error_category: "validation",
          status: "error",
        },
      };
    }

    const skillGate = evaluateSkillToolPolicy(name, options?.skillToolPolicy);
    if (!skillGate.allowed) {
      content = `Blocked by skill policy: ${skillGate.reason ?? "not allowed"}.`;
      return {
        tool_call_id: id,
        content,
        is_error: true,
        meta: {
          tool_name: name,
          duration_ms: Date.now() - startedAt,
          attempts: 1,
          retries: 0,
          error_category: "policy",
          status: "error",
        },
      };
    }
    if (skillGate.requireConfirm && name !== "run_shell_command") {
      if (!options?.onShellApprove) {
        content = "Blocked by skill policy: confirmation callback unavailable.";
        return {
          tool_call_id: id,
          content,
          is_error: true,
          meta: {
            tool_name: name,
            duration_ms: Date.now() - startedAt,
            attempts: 1,
            retries: 0,
            error_category: "policy",
            status: "error",
          },
        };
      }
      const approved = await options.onShellApprove(
        `Approve skill-restricted tool call ${name} with args: ${JSON.stringify(parsed)}`
      );
      if (!approved) {
        content = "Tool call not approved by user.";
        return {
          tool_call_id: id,
          content,
          is_error: true,
          meta: {
            tool_name: name,
            duration_ms: Date.now() - startedAt,
            attempts: 1,
            retries: 0,
            error_category: "policy",
            status: "error",
          },
        };
      }
    }

    const policyGate = evaluateToolPolicy(name, options?.toolPolicy);
    if (!policyGate.allowed) {
      content = `Blocked by tool policy: ${policyGate.reason ?? "not allowed"}.`;
      return {
        tool_call_id: id,
        content,
        is_error: true,
        meta: {
          tool_name: name,
          duration_ms: Date.now() - startedAt,
          attempts: 1,
          retries: 0,
          error_category: "policy",
          status: "error",
        },
      };
    }
    if (policyGate.requireConfirm && name !== "run_shell_command") {
      if (!options?.onShellApprove) {
        content = "Blocked by tool policy: confirmation callback unavailable.";
        return {
          tool_call_id: id,
          content,
          is_error: true,
          meta: {
            tool_name: name,
            duration_ms: Date.now() - startedAt,
            attempts: 1,
            retries: 0,
            error_category: "policy",
            status: "error",
          },
        };
      }
      const approved = await options.onShellApprove(
        `Approve tool call ${name} with args: ${JSON.stringify(parsed)}`
      );
      if (!approved) {
        content = "Tool call not approved by user.";
        return {
          tool_call_id: id,
          content,
          is_error: true,
          meta: {
            tool_name: name,
            duration_ms: Date.now() - startedAt,
            attempts: 1,
            retries: 0,
            error_category: "policy",
            status: "error",
          },
        };
      }
    }

    const runOnce = async (): Promise<string> => {
      switch (name) {
        case "run_shell_command": {
          const command = parsed.command as string;
          if (policyGate.requireConfirm && options?.onShellApprove) {
            const approved = await options.onShellApprove(command);
            if (!approved) throw new Error("Command not approved by user.");
          }
          const result = runningInTauri
            ? await invoke<{ stdout: string; stderr: string; exit_code: number | null }>("run_shell_command", { command })
            : await runBrowserShellCommand(command, await invoke<AppConfig>("config_load").catch(() => null));
          const parts: string[] = [];
          if (result.stdout) parts.push(`stdout:\n${truncateText(result.stdout, MAX_SHELL_OUTPUT_CHARS)}`);
          if (result.stderr) parts.push(`stderr:\n${truncateText(result.stderr, MAX_SHELL_OUTPUT_CHARS)}`);
          if (result.exit_code != null) parts.push(`exit_code: ${result.exit_code}`);
          return parts.length ? parts.join("\n") : "(no output)";
        }
        case "read_file": {
          if (!runningInTauri) throw new Error(`${BROWSER_MSG} (tool: read_file)`);
          const path = parsed.path as string;
          const text = await invoke<string>("agent_read_file", { path });
          return truncateText(text, MAX_FILE_READ_CHARS);
        }
        case "write_file": {
          if (!runningInTauri) throw new Error(`${BROWSER_MSG} (tool: write_file)`);
          const path = parsed.path as string;
          const contents = parsed.contents as string;
          await invoke("agent_write_file", { path, contents });
          return "Written successfully.";
        }
        case "list_dir": {
          if (!runningInTauri) throw new Error(`${BROWSER_MSG} (tool: list_dir)`);
          const path = parsed.path as string;
          const recursive = Boolean(parsed.recursive);
          const entries = await invoke<Array<{ name: string; is_dir: boolean }>>("agent_list_dir", { path, recursive });
          const lines = entries
            .slice(0, MAX_DIR_LIST_ENTRIES)
            .map((e) => (e.is_dir ? `${e.name}/` : e.name));
          const suffix =
            entries.length > MAX_DIR_LIST_ENTRIES
              ? `\n... truncated ${entries.length - MAX_DIR_LIST_ENTRIES} entries`
              : "";
          return (lines.join("\n") || "(empty)") + suffix;
        }
        case "mcp_list_servers": {
          const cfg = await invoke<AppConfig>("config_load");
          const servers = cfg.mcp_servers ?? [];
          if (!servers.length) return "No MCP servers configured.";
          return servers
            .map((s) => `${s.id} (${s.transport}) ${s.enabled ? "enabled" : "disabled"} -> ${s.endpoint}`)
            .join("\n");
        }
        case "mcp_call_tool": {
          const cfg = await invoke<AppConfig>("config_load");
          const serverId = parsed.server_id as string;
          const toolName = parsed.tool_name as string;
          const rawArgs =
            typeof parsed.arguments === "string" ? parsed.arguments : JSON.stringify(parsed.arguments ?? {});
          let argsObject: Record<string, unknown> = {};
          try {
            argsObject = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
          } catch {
            throw new Error("Invalid JSON for arguments.");
          }
          const out = await dispatchMcpTool(cfg, {
            serverId,
            toolName,
            argumentsObject: argsObject,
          });
          return out || "(empty response)";
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    };

    for (;;) {
      attempts += 1;
      try {
        content = await withTimeout(runOnce(), timeoutMs, name);
        is_error = false;
        break;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.startsWith("TOOL_TIMEOUT:")) timedOut = true;
        if (attempts <= maxRetries && shouldRetryTool(name, errorMessage)) {
          retries += 1;
          await new Promise((resolve) => setTimeout(resolve, retryBackoffMs * retries));
          continue;
        }
        content = errorMessage;
        is_error = true;
        errorCategory = classifyError(errorMessage);
        break;
      }
    }
  } catch (e) {
    content = e instanceof Error ? e.message : String(e);
    is_error = true;
    if (content.startsWith("TOOL_TIMEOUT:")) timedOut = true;
    errorCategory = classifyError(content);
  }

  return {
    tool_call_id: id,
    content,
    is_error,
    meta: {
      tool_name: name,
      duration_ms: Date.now() - startedAt,
      attempts: Math.max(1, attempts),
      retries,
      ...(timedOut ? { timed_out: true } : {}),
      ...(is_error ? { error_category: errorCategory ?? "runtime" } : {}),
      status: is_error ? "error" : "success",
    },
  };
}
