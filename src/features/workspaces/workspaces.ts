import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export interface WorkspaceRecord {
  id: string;
  name: string;
  description?: string | null;
  root_path?: string | null;
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  const config = await invoke<AppConfig>("config_load");
  return config.workspaces ?? [];
}

export async function saveWorkspace(workspace: WorkspaceRecord): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const current = config.workspaces ?? [];
  const idx = current.findIndex((w) => w.id === workspace.id);
  const next = idx >= 0 ? current.map((w, i) => (i === idx ? workspace : w)) : [...current, workspace];
  await invoke("config_save", { config: { ...config, workspaces: next } });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const next = (config.workspaces ?? []).filter((w) => w.id !== workspaceId);
  await invoke("config_save", {
    config: {
      ...config,
      workspaces: next,
      active_workspace_id: config.active_workspace_id === workspaceId ? null : config.active_workspace_id ?? null,
    },
  });
}

export async function setActiveWorkspace(workspaceId: string | null): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  await invoke("config_save", { config: { ...config, active_workspace_id: workspaceId } });
}

