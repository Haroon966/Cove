import { describe, expect, it } from "vitest";
import { isFeatureEnabled, resolveRuntimeToolPolicy } from "./configHelpers";

describe("configHelpers", () => {
  it("resolves feature flags with fallback", () => {
    expect(isFeatureEnabled(null, "missing.flag", true)).toBe(true);
    expect(isFeatureEnabled({ feature_flags: { "a.b": false } } as never, "a.b", true)).toBe(false);
  });

  it("merges global and skill tool policy", () => {
    const merged = resolveRuntimeToolPolicy(
      {
        role: "owner",
        mode: "allow_list",
        allowed_tools: ["read_file", "write_file", "run_shell_command"],
        denied_tools: ["mcp_call_tool"],
        require_confirmation_for: ["run_shell_command"],
      },
      {
        allowed_tools: ["read_file", "write_file"],
        denied_tools: ["write_file"],
        require_confirmation_for: ["write_file"],
      },
      false
    );
    expect(merged.allowed_tools).toEqual(["read_file", "write_file"]);
    expect(merged.denied_tools).toContain("write_file");
    expect(merged.require_confirmation_for).toContain("run_shell_command");
    expect(merged.require_confirmation_for).toContain("write_file");
  });
});
