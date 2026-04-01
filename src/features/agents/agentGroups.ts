import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export interface AgentGroup {
  id: string;
  name: string;
  member_profile_ids: string[];
}

export async function listAgentGroups(): Promise<AgentGroup[]> {
  const config = await invoke<AppConfig>("config_load");
  return config.agent_groups ?? [];
}

export async function saveAgentGroup(group: AgentGroup): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const current = config.agent_groups ?? [];
  const idx = current.findIndex((g) => g.id === group.id);
  const next = idx >= 0 ? current.map((g, i) => (i === idx ? group : g)) : [...current, group];
  await invoke("config_save", { config: { ...config, agent_groups: next } });
}

export async function deleteAgentGroup(groupId: string): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const next = (config.agent_groups ?? []).filter((g) => g.id !== groupId);
  await invoke("config_save", {
    config: {
      ...config,
      agent_groups: next,
      active_agent_group_id:
        config.active_agent_group_id === groupId ? null : config.active_agent_group_id ?? null,
    },
  });
}

export async function setActiveAgentGroup(groupId: string | null): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  await invoke("config_save", { config: { ...config, active_agent_group_id: groupId } });
}

