import { describe, expect, it } from "vitest";
import { normalizeAppError } from "./taxonomy";

describe("normalizeAppError", () => {
  it("maps auth failures", () => {
    expect(normalizeAppError("HTTP 401 Unauthorized").code).toBe("AUTH_FAILURE");
  });

  it("maps policy failures", () => {
    expect(normalizeAppError("Blocked by tool policy").code).toBe("TOOL_POLICY_BLOCKED");
  });
});

