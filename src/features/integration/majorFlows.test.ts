import { beforeEach, describe, expect, it, vi } from "vitest";

let configState: Record<string, unknown> = {
  backend_type: "ollama",
  base_url: "http://localhost:11434",
  model: "llama3",
  api_key: null,
  enabled_skills: [],
  mcp_servers: [],
  agent_templates: [],
  agent_profiles: [],
  active_agent_profile_id: null,
  agent_groups: [],
  active_agent_group_id: null,
  workspaces: [],
  active_workspace_id: null,
  scheduled_tasks: [],
};

vi.mock("../../api/tauri", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === "config_load") return configState;
    if (cmd === "config_save") {
      configState = { ...(args?.config as Record<string, unknown>) };
      return;
    }
    return null;
  }),
  isTauriDesktop: vi.fn(() => true),
}));

import { installMarketplaceMcp, CURATED_MCP_MARKETPLACE } from "../mcp/marketplace";
import { setEnabledSkills } from "../skills/skillsCatalog";
import { installAgentTemplate } from "../agents/templateCatalog";
import { saveAgentProfile, setActiveAgentProfile } from "../agents/agentProfiles";
import { saveAgentGroup, setActiveAgentGroup } from "../agents/agentGroups";
import { saveWorkspace, setActiveWorkspace } from "../workspaces/workspaces";
import { saveScheduledTask } from "../scheduling/scheduledTasks";

describe("major integration flows", () => {
  beforeEach(() => {
    configState = {
      backend_type: "ollama",
      base_url: "http://localhost:11434",
      model: "llama3",
      api_key: null,
      enabled_skills: [],
      mcp_servers: [],
      agent_templates: [],
      agent_profiles: [],
      active_agent_profile_id: null,
      agent_groups: [],
      active_agent_group_id: null,
      workspaces: [],
      active_workspace_id: null,
      scheduled_tasks: [],
    };
  });

  it("provisions discover->agent->workspace->schedule flow", async () => {
    await setEnabledSkills(["reasoning_core"]);
    await installMarketplaceMcp(CURATED_MCP_MARKETPLACE[0].id);
    await installAgentTemplate("research-analyst");
    await saveAgentProfile({
      id: "p1",
      name: "Architect",
      system_prompt: "Plan carefully",
      preferred_backend: "openai",
      preferred_model: "gpt-4o-mini",
      tools_enabled: true,
    });
    await setActiveAgentProfile("p1");
    await saveAgentGroup({ id: "g1", name: "Core Team", member_profile_ids: ["p1"] });
    await setActiveAgentGroup("g1");
    await saveWorkspace({ id: "w1", name: "Main Repo", root_path: "/tmp/project" });
    await setActiveWorkspace("w1");
    await saveScheduledTask({
      id: "t1",
      name: "Daily check",
      prompt: "Summarize workspace status",
      interval_minutes: 60,
      enabled: true,
      next_run_at: Date.now() + 1000 * 60,
    });

    expect(configState.enabled_skills as string[]).toContain("reasoning_core");
    expect((configState.mcp_servers as unknown[])?.length).toBe(1);
    expect(configState.active_agent_profile_id).toBe("p1");
    expect(configState.active_agent_group_id).toBe("g1");
    expect(configState.active_workspace_id).toBe("w1");
    expect((configState.scheduled_tasks as unknown[])?.length).toBe(1);
  });
});

