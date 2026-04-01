import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export interface ScheduledTaskRecord {
  id: string;
  name: string;
  prompt: string;
  interval_minutes: number;
  enabled: boolean;
  next_run_at?: number | null;
}

export async function listScheduledTasks(): Promise<ScheduledTaskRecord[]> {
  const config = await invoke<AppConfig>("config_load");
  return config.scheduled_tasks ?? [];
}

export async function saveScheduledTask(task: ScheduledTaskRecord): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const current = config.scheduled_tasks ?? [];
  const idx = current.findIndex((t) => t.id === task.id);
  const next = idx >= 0 ? current.map((t, i) => (i === idx ? task : t)) : [...current, task];
  await invoke("config_save", { config: { ...config, scheduled_tasks: next } });
}

export async function deleteScheduledTask(taskId: string): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const next = (config.scheduled_tasks ?? []).filter((t) => t.id !== taskId);
  await invoke("config_save", { config: { ...config, scheduled_tasks: next } });
}

