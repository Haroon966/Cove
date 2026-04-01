import { describe, expect, it } from "vitest";
import { evaluateToolPolicy, getAgentToolsByNames } from "./tools";

describe("tool policy evaluation", () => {
  it("blocks shell for restricted role", () => {
    const gate = evaluateToolPolicy("run_shell_command", {
      role: "restricted",
      mode: "allow_all",
    });
    expect(gate.allowed).toBe(false);
  });

  it("enforces allow list", () => {
    const gate = evaluateToolPolicy("read_file", {
      role: "owner",
      mode: "allow_list",
      allowed_tools: ["list_dir"],
    });
    expect(gate.allowed).toBe(false);
  });

  it("requires confirmation in confirm_all mode", () => {
    const gate = evaluateToolPolicy("read_file", {
      role: "owner",
      mode: "confirm_all",
    });
    expect(gate.allowed).toBe(true);
    expect(gate.requireConfirm).toBe(true);
  });

  it("filters advertised tools by allow list", () => {
    const tools = getAgentToolsByNames(["read_file", "list_dir"]);
    const names = tools.map((tool) => tool.function.name);
    expect(names).toEqual(["read_file", "list_dir"]);
  });
});

