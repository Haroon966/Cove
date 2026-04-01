import { invoke, isTauriDesktop } from "../api/tauri";
import { addBackendAuditLog } from "../features/logging/backendAuditLog";

export interface ParsedDeepLink {
  route: string;
  query?: Record<string, string>;
}

export function parseDeepLinkUrl(url: string): ParsedDeepLink | null {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    const routeMap: Record<string, string> = {
      chat: "/chat",
      agents: "/agents",
      knowledge: "/knowledge",
      discover: "/discover",
      openwebui: "/open-webui",
      "open-webui": "/open-webui",
    };
    const route = routeMap[host];
    if (!route) return null;
    const query: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    return { route, query };
  } catch {
    return null;
  }
}

export async function consumePendingDeepLinks(): Promise<string[]> {
  if (!isTauriDesktop()) return [];
  try {
    const links = await invoke<string[]>("deep_link_consume_pending");
    if (links.length > 0) {
      void addBackendAuditLog("info", "deep_link_consume_pending", { count: links.length });
    }
    return links;
  } catch {
    void addBackendAuditLog("error", "deep_link_consume_failed", {});
    return [];
  }
}

