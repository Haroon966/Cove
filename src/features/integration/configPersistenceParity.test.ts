/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { installTauriMock } from "../../tauri-mock";
import { invoke } from "../../api/tauri";
import { DEFAULT_APP_CONFIG } from "../../config/defaultAppConfig";

function resetMock() {
  localStorage.clear();
  const w = window as Window & { __TAURI__?: unknown; __TAURI_MOCK__?: boolean };
  delete w.__TAURI__;
  delete w.__TAURI_MOCK__;
  installTauriMock();
}

describe("config persistence parity", () => {
  beforeEach(() => {
    resetMock();
  });

  it("returns expected defaults for browser fallback", async () => {
    const cfg = await invoke<Record<string, unknown>>("config_load");
    expect(cfg.backend_type).toBe(DEFAULT_APP_CONFIG.backend_type);
    expect(cfg.base_url).toBe(DEFAULT_APP_CONFIG.base_url);
    expect(cfg.openwebui_api_path).toBe(DEFAULT_APP_CONFIG.openwebui_api_path);
    expect(cfg.browser_command_bridge_url).toBe(DEFAULT_APP_CONFIG.browser_command_bridge_url);
  });

  it("round-trips config fields without dropping values", async () => {
    await invoke("config_save", {
      config: {
        ...DEFAULT_APP_CONFIG,
        backend_type: "openai",
        base_url: "https://api.openai.com",
        model: "gpt-4o-mini",
        browser_command_bridge_enabled: true,
      },
    });

    const cfg = await invoke<Record<string, unknown>>("config_load");
    expect(cfg.backend_type).toBe("openai");
    expect(cfg.base_url).toBe("https://api.openai.com");
    expect(cfg.model).toBe("gpt-4o-mini");
    expect(cfg.browser_command_bridge_enabled).toBe(true);
  });

  it("keeps config load/save latency bounded for UI usage", async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) {
      await invoke("config_save", { config: { ...DEFAULT_APP_CONFIG, model: `model-${i}` } });
      await invoke("config_load");
    }
    const elapsed = performance.now() - start;
    // jsdom timing is noisy; this threshold mainly guards obvious regressions.
    expect(elapsed).toBeLessThan(2000);
  });
});
