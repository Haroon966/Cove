/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { installTauriMock } from "../tauri-mock";
import { invoke } from "../api/tauri";

function setupMockDesktop() {
  localStorage.clear();
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_MOCK__?: boolean;
  };
  delete w.__TAURI__;
  delete w.__TAURI_MOCK__;
  installTauriMock();
}

describe("parity critical e2e scenarios", () => {
  beforeEach(() => {
    setupMockDesktop();
  });

  it("completes chat -> artifact -> trace flow with persistence", async () => {
    const sessionId = await invoke<number>("session_create", { title: "E2E Session" });
    const userId = await invoke<number>("message_save", {
      session_id: sessionId,
      role: "user",
      content: "Create an architecture plan",
      parent_message_id: null,
      branch_id: null,
      event_type: "user_message",
      tool_call_id: null,
      tool_name: null,
      tool_calls: null,
    });
    const assistantId = await invoke<number>("message_save", {
      session_id: sessionId,
      role: "assistant",
      content: "Here is a phased architecture plan.",
      parent_message_id: userId,
      branch_id: null,
      event_type: "assistant_message",
      tool_call_id: null,
      tool_name: null,
      tool_calls: null,
    });

    const artifactId = await invoke<number>("artifact_create", {
      session_id: sessionId,
      message_id: assistantId,
      artifact_type: "note",
      title: "Architecture Draft",
      payload: JSON.stringify({ body: "v1" }),
    });
    expect(artifactId).toBeGreaterThan(0);

    await invoke("execution_trace_add", {
      session_id: sessionId,
      message_id: assistantId,
      trace_type: "assistant_final",
      trace_payload: JSON.stringify({ ok: true }),
    });

    const sessions = await invoke<Array<{ id: number }>>("session_list");
    expect(sessions.some((s) => s.id === sessionId)).toBe(true);

    const messages = await invoke<Array<{ id: number; role: string }>>("messages_load", {
      session_id: sessionId,
    });
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    const artifacts = await invoke<Array<{ id: number; title: string }>>("artifact_list", {
      session_id: sessionId,
    });
    expect(artifacts[0]?.title).toBe("Architecture Draft");

    const traces = await invoke<Array<{ trace_type: string }>>("execution_trace_list", {
      session_id: sessionId,
    });
    expect(traces.some((t) => t.trace_type === "assistant_final")).toBe(true);
  });

  it("completes knowledge ingest -> link -> retrieve flow", async () => {
    const sessionId = await invoke<number>("session_create", { title: "Knowledge Session" });
    const docId = await invoke<number>("knowledge_doc_create", {
      title: "Runbook",
      source_path: "/tmp/runbook.md",
      mime_type: "text/markdown",
      content: "Incident response requires triage, rollback, and postmortem.",
      chunk_count: 0,
    });
    await invoke("knowledge_session_sources_set", {
      session_id: sessionId,
      doc_ids: [docId],
    });
    const snippets = await invoke<Array<{ doc_id: number; snippet: string }>>("knowledge_retrieve", {
      query: "rollback",
      limit: 5,
      session_id: sessionId,
    });
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets[0]?.doc_id).toBe(docId);
  });

  it("persists config and keeps it in backup/restore flow", async () => {
    await invoke("config_save", {
      config: {
        backend_type: "open_webui",
        base_url: "http://127.0.0.1:8080",
        model: "qwen2.5",
        openwebui_api_path: "/api",
        openwebui_enable_tools: true,
        browser_command_bridge_enabled: true,
        browser_command_bridge_url: "http://127.0.0.1:4317",
      },
    });

    const loaded = await invoke<Record<string, unknown>>("config_load");
    expect(loaded.backend_type).toBe("open_webui");
    expect(loaded.browser_command_bridge_enabled).toBe(true);

    const backupJson = await invoke<string>("export_all_data");
    const backup = JSON.parse(backupJson) as {
      config?: { backend_type?: string; browser_command_bridge_enabled?: boolean };
    };
    expect(backup.config?.backend_type).toBe("open_webui");
    expect(backup.config?.browser_command_bridge_enabled).toBe(true);

    await invoke("config_save", {
      config: { backend_type: "ollama", base_url: "http://localhost:11434", model: "llama2" },
    });
    await invoke("import_backup", { json: backupJson, mode: "merge" });

    const restored = await invoke<Record<string, unknown>>("config_load");
    expect(restored.backend_type).toBe("open_webui");
    expect(restored.browser_command_bridge_enabled).toBe(true);
  });
});

