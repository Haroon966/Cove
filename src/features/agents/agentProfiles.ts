import { invoke } from "../../api/tauri";
import type { AppConfig, BackendType } from "../../types";

export interface AgentProfile {
  id: string;
  name: string;
  description?: string | null;
  system_prompt: string;
  preferred_model?: string | null;
  preferred_backend?: BackendType | null;
  tools_enabled?: boolean | null;
}

export async function listAgentProfiles(): Promise<AgentProfile[]> {
  const config = await invoke<AppConfig>("config_load");
  return config.agent_profiles ?? [];
}

export async function saveAgentProfile(profile: AgentProfile): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const current = config.agent_profiles ?? [];
  const idx = current.findIndex((p) => p.id === profile.id);
  const next = idx >= 0 ? current.map((p, i) => (i === idx ? profile : p)) : [...current, profile];
  await invoke("config_save", {
    config: {
      ...config,
      agent_profiles: next,
    },
  });
}

export async function deleteAgentProfile(profileId: string): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const next = (config.agent_profiles ?? []).filter((p) => p.id !== profileId);
  await invoke("config_save", {
    config: {
      ...config,
      agent_profiles: next,
      active_agent_profile_id:
        config.active_agent_profile_id === profileId ? null : config.active_agent_profile_id ?? null,
    },
  });
}

export async function setActiveAgentProfile(profileId: string | null): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  await invoke("config_save", {
    config: {
      ...config,
      active_agent_profile_id: profileId,
    },
  });
}

