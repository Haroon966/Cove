import { invoke } from "../../api/tauri";
import type { ExecutionTrace } from "../../types";

export async function addExecutionTrace(input: {
  sessionId: number;
  messageId?: number | null;
  traceType: string;
  tracePayload: string;
}): Promise<number> {
  return invoke<number>("execution_trace_add", {
    session_id: input.sessionId,
    message_id: input.messageId ?? null,
    trace_type: input.traceType,
    trace_payload: input.tracePayload,
  });
}

export async function listExecutionTraces(sessionId: number): Promise<ExecutionTrace[]> {
  return invoke<ExecutionTrace[]>("execution_trace_list", { session_id: sessionId });
}

export async function clearExecutionTraces(sessionId: number): Promise<void> {
  await invoke("execution_trace_clear", { session_id: sessionId });
}

