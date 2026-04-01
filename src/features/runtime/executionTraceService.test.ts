import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addExecutionTrace,
  clearExecutionTraces,
  listExecutionTraces,
} from "./executionTraceService";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "../../api/tauri";

describe("executionTraceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds execution traces", async () => {
    vi.mocked(invoke).mockResolvedValue(5);
    const id = await addExecutionTrace({
      sessionId: 9,
      traceType: "tool_call_turn",
      tracePayload: "{\"x\":1}",
    });
    expect(id).toBe(5);
    expect(invoke).toHaveBeenCalledWith("execution_trace_add", {
      session_id: 9,
      message_id: null,
      trace_type: "tool_call_turn",
      trace_payload: "{\"x\":1}",
    });
  });

  it("lists and clears execution traces", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);
    const traces = await listExecutionTraces(2);
    expect(traces).toEqual([]);
    await clearExecutionTraces(2);
    expect(invoke).toHaveBeenNthCalledWith(1, "execution_trace_list", { session_id: 2 });
    expect(invoke).toHaveBeenNthCalledWith(2, "execution_trace_clear", { session_id: 2 });
  });
});

