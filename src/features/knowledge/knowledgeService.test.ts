import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listSessionKnowledgeSources,
  retrieveKnowledge,
  setSessionKnowledgeSources,
} from "./knowledgeService";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "../../api/tauri";

describe("knowledgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves knowledge snippets with session scope", async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        doc_id: 1,
        doc_title: "Guide",
        chunk_index: 0,
        snippet: "hello",
        score: -1.2,
      },
    ]);
    const result = await retrieveKnowledge("hello", { limit: 3, sessionId: 7 });
    expect(result).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("knowledge_retrieve", {
      query: "hello",
      limit: 3,
      session_id: 7,
    });
  });

  it("sets and lists linked knowledge sources per session", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined).mockResolvedValueOnce([2, 3]);
    await setSessionKnowledgeSources(11, [2, 3]);
    const linked = await listSessionKnowledgeSources(11);
    expect(linked).toEqual([2, 3]);
    expect(invoke).toHaveBeenNthCalledWith(1, "knowledge_session_sources_set", {
      session_id: 11,
      doc_ids: [2, 3],
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "knowledge_session_sources_list", {
      session_id: 11,
    });
  });
});

