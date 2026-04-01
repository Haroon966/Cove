import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveWorkspace, setActiveWorkspace } from "./workspaces";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));
import { invoke } from "../../api/tauri";

describe("workspaces service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves workspace and sets active workspace", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ workspaces: [] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ active_workspace_id: null })
      .mockResolvedValueOnce(undefined);

    await saveWorkspace({
      id: "proj-a",
      name: "Project A",
      root_path: "/tmp/project-a",
    });
    await setActiveWorkspace("proj-a");

    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          workspaces: expect.arrayContaining([expect.objectContaining({ id: "proj-a" })]),
        }),
      })
    );
  });
});

