import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBackendAuditLog } from "./backendAuditLog";

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(),
  isTauriDesktop: vi.fn(() => true),
}));

import { invoke } from "../../api/tauri";

describe("backendAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds backend audit log through tauri command", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await addBackendAuditLog("info", "test_event", { ok: true });
    expect(invoke).toHaveBeenCalledWith(
      "backend_audit_log_add",
      expect.objectContaining({
        level: "info",
        event: "test_event",
      })
    );
  });
});

