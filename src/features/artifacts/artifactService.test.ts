import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArtifact, deleteArtifact, listArtifacts } from "./artifactService";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "../../api/tauri";

describe("artifactService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates artifacts via tauri command", async () => {
    vi.mocked(invoke).mockResolvedValue(9);
    const id = await createArtifact({
      sessionId: 4,
      messageId: 12,
      artifactType: "markdown",
      title: "Result",
      payload: "{\"content\":\"hello\"}",
    });
    expect(id).toBe(9);
    expect(invoke).toHaveBeenCalledWith("artifact_create", {
      session_id: 4,
      message_id: 12,
      artifact_type: "markdown",
      title: "Result",
      payload: "{\"content\":\"hello\"}",
    });
  });

  it("lists and deletes artifacts", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([
        {
          id: 1,
          session_id: 3,
          artifact_type: "text",
          title: "A",
          payload: "x",
          created_at: 1,
        },
      ])
      .mockResolvedValueOnce(undefined);
    const items = await listArtifacts(3);
    expect(items).toHaveLength(1);
    await deleteArtifact(1);
    expect(invoke).toHaveBeenNthCalledWith(1, "artifact_list", { session_id: 3 });
    expect(invoke).toHaveBeenNthCalledWith(2, "artifact_delete", { artifact_id: 1 });
  });
});

