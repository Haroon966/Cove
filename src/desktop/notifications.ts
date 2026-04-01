import { isTauriDesktop } from "../api/tauri";
import { addBackendAuditLog } from "../features/logging/backendAuditLog";

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!title.trim() && !body.trim()) return;
  if (isTauriDesktop()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      const permission = await mod.isPermissionGranted();
      const granted = permission || (await mod.requestPermission()) === "granted";
      if (!granted) return;
      await mod.sendNotification({
        title: title.trim() || "Cove",
        body: body.trim(),
      });
      void addBackendAuditLog("info", "desktop_notification_sent", {
        title: title.trim() || "Cove",
      });
      return;
    } catch {
      void addBackendAuditLog("warn", "desktop_notification_plugin_failed", {});
      // fallback below
    }
  }
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "granted") {
        new Notification(title.trim() || "Cove", { body: body.trim() });
        void addBackendAuditLog("info", "web_notification_sent", {
          title: title.trim() || "Cove",
        });
      }
    } catch {
      void addBackendAuditLog("warn", "web_notification_failed", {});
      // ignore
    }
  }
}

