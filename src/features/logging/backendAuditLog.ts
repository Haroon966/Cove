import { invoke, isTauriDesktop } from "../../api/tauri";

export interface BackendAuditLogRecord {
  id: number;
  level: string;
  event: string;
  payload: string;
  created_at: number;
}

export async function addBackendAuditLog(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!isTauriDesktop()) return;
  try {
    await invoke("backend_audit_log_add", {
      level,
      event,
      payload: JSON.stringify(payload ?? {}),
    });
  } catch {
    // do not break UI flows on telemetry errors
  }
}

export async function listBackendAuditLogs(limit = 200): Promise<BackendAuditLogRecord[]> {
  return invoke<BackendAuditLogRecord[]>("backend_audit_log_list", { limit });
}

export async function clearBackendAuditLogs(): Promise<void> {
  await invoke("backend_audit_log_clear");
}

