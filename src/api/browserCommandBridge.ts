import type { AppConfig } from "../types";

export interface ShellCommandResult {
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:4317";
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeBridgeBaseUrl(url?: string | null): string {
  const raw = (url ?? "").trim();
  return (raw || DEFAULT_BRIDGE_URL).replace(/\/$/, "");
}

export function isBrowserCommandBridgeEnabled(config?: AppConfig | null): boolean {
  return !!config?.browser_command_bridge_enabled;
}

function buildHeaders(config?: AppConfig | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = config?.browser_command_bridge_token?.trim();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function runBrowserShellCommand(
  command: string,
  config?: AppConfig | null
): Promise<ShellCommandResult> {
  if (!isBrowserCommandBridgeEnabled(config)) {
    throw new Error(
      "Browser command bridge is disabled. Enable it in Settings to run shell commands in browser mode."
    );
  }
  const baseUrl = normalizeBridgeBaseUrl(config?.browser_command_bridge_url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({ command }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Bridge request failed (${res.status}): ${text || "No error body returned by bridge."}`
      );
    }
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Bridge returned non-JSON response.");
    }
    const obj = (parsed ?? {}) as Partial<ShellCommandResult>;
    return {
      stdout: typeof obj.stdout === "string" ? obj.stdout : "",
      stderr: typeof obj.stderr === "string" ? obj.stderr : "",
      exit_code: typeof obj.exit_code === "number" ? obj.exit_code : null,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Bridge request timed out while running command.");
    }
    if (e instanceof TypeError) {
      throw new Error(
        `Could not reach browser command bridge at ${baseUrl}. Ensure the local bridge service is running.`
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timeout);
  }
}

