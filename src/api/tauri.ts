/**
 * Safe invoke that works in both Tauri (desktop) and browser (mock).
 * Always uses window.__TAURI__.core.invoke so the browser mock is used when not in Tauri.
 */

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

export function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const api = typeof window !== "undefined" ? window.__TAURI__?.core : undefined;
  if (!api?.invoke) {
    return Promise.reject(
      new Error("Tauri API not available. Ensure the app is running in Tauri or the browser mock is loaded.")
    );
  }
  return api.invoke(cmd, args) as Promise<T>;
}
