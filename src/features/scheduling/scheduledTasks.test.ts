import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveScheduledTask } from "./scheduledTasks";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
}));
import { invoke } from "../../api/tauri";

describe("scheduled tasks service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves scheduled task in config", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ scheduled_tasks: [] })
      .mockResolvedValueOnce(undefined);

    await saveScheduledTask({
      id: "daily-summary",
      name: "Daily Summary",
      prompt: "Summarize daily progress",
      interval_minutes: 1440,
      enabled: true,
      next_run_at: 123,
    });

    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "config_save",
      expect.objectContaining({
        config: expect.objectContaining({
          scheduled_tasks: expect.arrayContaining([expect.objectContaining({ id: "daily-summary" })]),
        }),
      })
    );
  });
});

