export type RuntimeEventType =
  | "message_started"
  | "message_chunk"
  | "message_completed"
  | "tool_call_requested"
  | "tool_call_completed"
  | "artifact_emitted"
  | "error";

export interface RuntimeEvent {
  type: RuntimeEventType;
  sessionId: number;
  createdAt: number;
  payload?: Record<string, unknown>;
}

export function nowRuntimeEvent(
  type: RuntimeEventType,
  sessionId: number,
  payload?: Record<string, unknown>
): RuntimeEvent {
  return {
    type,
    sessionId,
    createdAt: Date.now(),
    payload,
  };
}

