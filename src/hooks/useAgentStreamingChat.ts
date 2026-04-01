import { useCallback, useRef, useState } from "react";
import type { Message } from "../types";
import type { AppConfig } from "../types";
import type { AgentToolCall, AgentToolResult } from "../types";
import { getEffectiveApiKey, getEffectiveBaseUrl, isFeatureEnabled, resolveRuntimeToolPolicy } from "../configHelpers";
import { streamOllamaChatWithTools } from "../api/ollama";
import { streamOpenAIChatWithTools } from "../api/openai";
import { streamOpenWebUIChatWithTools } from "../api/openwebui";
import type { OpenAIMessage, OpenAIToolDef, ParsedToolCall } from "../api/openai";
import type { OllamaMessage, OllamaToolDef } from "../api/ollama";
import { executeTool, getAgentToolsByNames } from "../agent/tools";
import { logger } from "../logging/logger";
import {
  buildCapabilityAwareExecutionPlan,
  buildExecutionPlan,
  type PlannerStep,
} from "../agent/runtime/planner";
import { toDisplayError } from "../errors/taxonomy";

/** Convert Message[] to OpenAI format (including tool messages and assistant tool_calls). */
function messagesToOpenAI(messages: Message[], systemPrompt: string): OpenAIMessage[] {
  const list = messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.tool_call_id ?? undefined,
      };
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant" as const,
        content: m.content,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    };
  });
  if (systemPrompt) {
    return [{ role: "system", content: systemPrompt }, ...list];
  }
  return list;
}

/** Convert Message[] to Ollama format (Ollama uses tool_name and assistant tool_calls). */
function messagesToOllama(messages: Message[], systemPrompt: string): OllamaMessage[] {
  const list = messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        ...(m.tool_name ? { tool_name: m.tool_name } : {}),
      };
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant" as const,
        content: m.content,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    };
  });
  if (systemPrompt) {
    return [{ role: "system", content: systemPrompt }, ...list];
  }
  return list;
}

function toOpenAITools(toolNames?: string[] | null): OpenAIToolDef[] {
  return getAgentToolsByNames(toolNames).map((t) => ({
    type: "function",
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as Record<string, unknown>,
    },
  }));
}

function toOllamaTools(toolNames?: string[] | null): OllamaToolDef[] {
  return getAgentToolsByNames(toolNames).map((t) => ({
    type: "function",
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as Record<string, unknown>,
    },
  }));
}

export interface AgentSendOptions {
  lastMessageImages?: { base64: string; mimeType?: string }[];
  /** Called when the model requests tool calls; parent should persist assistant + tool messages and return updated messages. */
  onToolTurn?: (
    assistantContent: string,
    toolCalls: AgentToolCall[],
    toolResults: AgentToolResult[]
  ) => Promise<Message[]>;
  /** When set, run_shell_command will ask for approval before executing. Return true to run, false to skip. */
  onShellApprove?: (command: string) => Promise<boolean>;
  /** Hard limit for recursive tool turns to avoid runaway loops. */
  maxToolTurns?: number;
  /** Additional system context (e.g. knowledge retrieval snippets). */
  extraSystemPrompt?: string;
  /** Tool policy controls for allow/deny/confirm behavior. */
  toolPolicy?: {
    role: "owner" | "trusted" | "restricted";
    mode: "allow_all" | "confirm_all" | "allow_list" | "deny_all";
    allowed_tools?: string[] | null;
    denied_tools?: string[] | null;
    require_confirmation_for?: string[] | null;
  } | null;
  planner?: {
    enabled: boolean;
    maxSteps?: number;
  };
  onPlannerEvent?: (event: {
    type: "plan_created" | "step_started" | "step_completed";
    plan?: PlannerStep[];
    step?: PlannerStep;
    stepIndex?: number;
    stepOutputPreview?: string;
  }) => Promise<void> | void;
  skillContext?: {
    selectedSkillIds: string[];
    toolPolicy: {
      allowed_tools: string[] | null;
      denied_tools: string[] | null;
      require_confirmation_for: string[] | null;
    };
  };
  toolExecution?: {
    timeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
    maxParallelTools?: number;
    forceSequentialTools?: boolean;
  };
  recentToolFailures?: string[];
}

function isMutationTool(toolName: string): boolean {
  return toolName === "write_file" || toolName === "run_shell_command" || toolName === "mcp_call_tool";
}

async function runToolCallsWithStrategy(
  toolCalls: ParsedToolCall[],
  executeOne: (call: ParsedToolCall) => Promise<AgentToolResult>,
  maxParallelTools: number,
  forceSequential = false
): Promise<AgentToolResult[]> {
  const shouldSequential =
    forceSequential ||
    toolCalls.length <= 1 ||
    toolCalls.some((call) => isMutationTool(call.name)) ||
    new Set(toolCalls.map((call) => call.name)).size !== toolCalls.length;
  if (shouldSequential) {
    const out: AgentToolResult[] = [];
    for (const call of toolCalls) {
      // Preserve tool execution order for dependent operations.
      out.push(await executeOne(call));
    }
    return out;
  }
  const concurrency = Math.max(1, Math.min(maxParallelTools, toolCalls.length));
  const results: AgentToolResult[] = new Array(toolCalls.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= toolCalls.length) break;
      results[index] = await executeOne(toolCalls[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function useAgentStreamingChat(config: AppConfig | null) {
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (
      sessionId: number,
      messages: Message[],
      appendAssistantChunk: (chunk: string) => void,
      finalizeAssistant: (fullContent: string) => void,
      sessionOverride?: { model?: string | null; backend_type?: string | null },
      options?: AgentSendOptions
    ) => {
      if (!config) {
        setError(toDisplayError("No configuration."));
        return;
      }
      const baseUrl = getEffectiveBaseUrl(config);
      if (!baseUrl) {
        setError(toDisplayError("Set base URL in Settings."));
        return;
      }
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const modelRaw = sessionOverride?.model ?? config.model ?? "";
      const model = modelRaw.trim() || "llama2";
      const backendRaw = sessionOverride?.backend_type ?? config.backend_type ?? "";
      const backend =
        backendRaw === "ollama" ? "ollama" : backendRaw === "open_webui" ? "open_webui" : "openai";
      setError(null);
      setStreaming(true);

      const systemPrompt = [config.system_prompt?.trim(), options?.extraSystemPrompt?.trim()]
        .filter((v): v is string => !!v)
        .join("\n\n");
      const temperature = config.temperature ?? undefined;
      const maxTokens = config.max_tokens ?? undefined;
      const lastMessageImages = options?.lastMessageImages;
      const onToolTurn = options?.onToolTurn;
      const onShellApprove = options?.onShellApprove;
      const maxToolTurns = Math.max(1, options?.maxToolTurns ?? 8);
      const skillContext = options?.skillContext;
      const resolvedToolPolicy = resolveRuntimeToolPolicy(
        options?.toolPolicy ?? null,
        skillContext?.toolPolicy ?? null,
        false
      );
      const maxParallelTools = Math.max(1, options?.toolExecution?.maxParallelTools ?? 2);
      const forceSequentialTools = options?.toolExecution?.forceSequentialTools ?? false;
      const agentToolsOpenAI = toOpenAITools(skillContext?.toolPolicy.allowed_tools ?? null);
      const agentToolsOllama = toOllamaTools(skillContext?.toolPolicy.allowed_tools ?? null);

      let currentMessages: Message[] = [...messages];
      let toolTurnCount = 0;

      const runOne = (): Promise<string> => {
        return new Promise((resolve, reject) => {
          let partialContent = "";
          let toolCallsReceived: ParsedToolCall[] | null = null;

          const onDone = () => {
            if (toolCallsReceived && toolCallsReceived.length > 0) {
              (async () => {
                try {
                  toolTurnCount += 1;
                  if (toolTurnCount > maxToolTurns) {
                    throw new Error(
                      `Agent stopped after ${maxToolTurns} tool turns to prevent runaway execution.`
                    );
                  }
                  const execOpts = onShellApprove ? { onShellApprove } : undefined;
                  const runOneTool = (c: ParsedToolCall) =>
                    executeTool(
                      { id: c.id, name: c.name, arguments: c.arguments },
                      {
                        ...(execOpts ?? {}),
                        toolPolicy: resolvedToolPolicy,
                        skillToolPolicy: skillContext?.toolPolicy ?? null,
                        execution: {
                          timeoutMs: options?.toolExecution?.timeoutMs,
                          maxRetries: options?.toolExecution?.maxRetries,
                          retryBackoffMs: options?.toolExecution?.retryBackoffMs,
                        },
                      }
                    );
                  const useRuntimeV2 = isFeatureEnabled(config, "agent.runtimeV2.enabled", true);
                  const results = useRuntimeV2
                    ? await runToolCallsWithStrategy(
                        toolCallsReceived!,
                        runOneTool,
                        maxParallelTools,
                        forceSequentialTools
                      )
                    : await Promise.all(toolCallsReceived!.map((call) => runOneTool(call)));
                  const assistantContent = partialContent;
                  partialContent = "";

                  if (onToolTurn) {
                    const updated = await onToolTurn(
                      assistantContent,
                      toolCallsReceived!,
                      results
                    );
                    currentMessages = updated;
                  } else {
                    const assistantMsg: Message = {
                      id: -1,
                      session_id: sessionId,
                      role: "assistant",
                      content: assistantContent,
                      created_at: 0,
                      tool_calls: toolCallsReceived!,
                    };
                    const toolMsgs: Message[] = results.map((r, i) => ({
                      id: -1,
                      session_id: sessionId,
                      role: "tool",
                      content: r.content,
                      created_at: 0,
                      tool_call_id: r.tool_call_id,
                      tool_name: toolCallsReceived![i]?.name,
                    }));
                    currentMessages = [...currentMessages, assistantMsg, ...toolMsgs];
                  }

                  const nextContent = await runOne();
                  resolve(nextContent);
                } catch (e) {
                  setError(toDisplayError(e instanceof Error ? e : String(e)));
                  setStreaming(false);
                  abortRef.current = null;
                  reject(e);
                }
              })();
            } else {
              resolve(partialContent);
            }
          };

          if (backend === "ollama") {
            streamOllamaChatWithTools(
              baseUrl,
              model,
              messagesToOllama(currentMessages, systemPrompt),
              {
                tools: agentToolsOllama,
                onChunk: (chunk) => {
                  partialContent += chunk;
                  appendAssistantChunk(chunk);
                },
                onToolCalls: (calls) => {
                  toolCallsReceived = calls;
                },
                onDone,
                onError: (err) => {
                  logger.error("agent_stream_ollama_error", { message: err.message });
                  setError(toDisplayError(err));
                  setStreaming(false);
                  abortRef.current = null;
                  reject(err);
                },
                signal,
                temperature,
                maxTokens,
                lastMessageImages: lastMessageImages?.map((i) => i.base64),
              }
            ).catch(reject);
          } else if (backend === "open_webui") {
            streamOpenWebUIChatWithTools(
              baseUrl,
              model,
              messagesToOpenAI(currentMessages, systemPrompt),
              getEffectiveApiKey(config),
              {
                tools: agentToolsOpenAI,
                onChunk: (chunk) => {
                  partialContent += chunk;
                  appendAssistantChunk(chunk);
                },
                onToolCalls: (calls) => {
                  toolCallsReceived = calls;
                },
                onDone,
                onError: (err) => {
                  logger.error("agent_stream_openwebui_error", { message: err.message });
                  setError(toDisplayError(err));
                  setStreaming(false);
                  abortRef.current = null;
                  reject(err);
                },
                signal,
                temperature,
                maxTokens,
                lastMessageImages,
                apiPath: config.openwebui_api_path,
              }
            ).catch(reject);
          } else {
            streamOpenAIChatWithTools(
              baseUrl,
              model,
              messagesToOpenAI(currentMessages, systemPrompt),
              getEffectiveApiKey(config),
              {
                tools: agentToolsOpenAI,
                onChunk: (chunk) => {
                  partialContent += chunk;
                  appendAssistantChunk(chunk);
                },
                onToolCalls: (calls) => {
                  toolCallsReceived = calls;
                },
                onDone,
                onError: (err) => {
                  logger.error("agent_stream_openai_error", { message: err.message });
                  setError(toDisplayError(err));
                  setStreaming(false);
                  abortRef.current = null;
                  reject(err);
                },
                signal,
                temperature,
                maxTokens,
                lastMessageImages,
              }
            ).catch(reject);
          }
        });
      };

      try {
        const plannerEnabled = options?.planner?.enabled ?? false;
        if (plannerEnabled) {
          const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
          const useCapabilityPlanner = isFeatureEnabled(config, "agent.planner.capabilityAware", true);
          const availableTools = (skillContext?.toolPolicy.allowed_tools?.length
            ? skillContext.toolPolicy.allowed_tools
            : getAgentToolsByNames().map((tool) => tool.function.name)) ?? [];
          const plan = useCapabilityPlanner
            ? buildCapabilityAwareExecutionPlan(
                lastUser,
                Math.max(1, options?.planner?.maxSteps ?? 5),
                availableTools,
                options?.recentToolFailures ?? []
              )
            : buildExecutionPlan(lastUser, Math.max(1, options?.planner?.maxSteps ?? 5));
          if (plan.length) {
            await options?.onPlannerEvent?.({
              type: "plan_created",
              plan,
            });
            for (let i = 0; i < plan.length; i += 1) {
              const step = plan[i];
              await options?.onPlannerEvent?.({
                type: "step_started",
                step,
                stepIndex: i,
              });
              currentMessages = [
                ...currentMessages,
                {
                  id: -1,
                  session_id: sessionId,
                  role: "user",
                  content: `Execute step ${i + 1}/${plan.length}: ${step.title}. Use tools if required.`,
                  created_at: 0,
                },
              ];
              const stepOutput = await runOne();
              currentMessages = [
                ...currentMessages,
                {
                  id: -1,
                  session_id: sessionId,
                  role: "assistant",
                  content: stepOutput,
                  created_at: 0,
                },
              ];
              await options?.onPlannerEvent?.({
                type: "step_completed",
                step,
                stepIndex: i,
                stepOutputPreview: stepOutput.slice(0, 200),
              });
            }
            currentMessages = [
              ...currentMessages,
              {
                id: -1,
                session_id: sessionId,
                role: "user",
                content:
                  "All planned steps are complete. Provide the final consolidated answer for the user.",
                created_at: 0,
              },
            ];
          }
        }
        const finalContent = await runOne();
        setStreaming(false);
        abortRef.current = null;
        finalizeAssistant(finalContent);
      } catch {
        // errors are usually handled in stream callbacks; keep state safe.
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [config]
  );

  return { send, stop, error, streaming, setError };
}
