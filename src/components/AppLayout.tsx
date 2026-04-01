import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";
import { invoke } from "../api/tauri";
import type { AppConfig } from "../types";
import { AppNav } from "./AppNav";
import { Settings } from "./Settings";
import { applyThemeTokens } from "../theme/tokens";
export interface AppLayoutContext {
  onOpenSettings: () => void;
  configVersion: number;
  savedConfig: AppConfig | null;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Convert hex color to HSL string for CSS variables */
function hexToHsl(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 0xff) / 255;
  let g = ((n >> 8) & 0xff) / 255;
  let b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyTheme(config: AppConfig | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = config?.theme ?? "light";
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  root.setAttribute("data-theme", resolved);
  root.classList.toggle("dark", resolved === "dark");

  const primary = config?.primary_color?.trim();
  if (primary && primary.startsWith("#") && primary.length >= 7) {
    const hsl = hexToHsl(primary);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--primary-hex", primary);
    root.style.setProperty("--primary-hover", primary);
    root.style.setProperty("--primary-light", hexToRgba(primary, 0.1));
    root.style.setProperty("--primary-border", hexToRgba(primary, 0.2));
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--primary-hex");
    root.style.removeProperty("--primary-hover");
    root.style.removeProperty("--primary-light");
    root.style.removeProperty("--primary-border");
  }
  applyThemeTokens(config);
}

export default function AppLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const [savedConfig, setSavedConfig] = useState<AppConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<AppConfig | null>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const configToApplyRef = useRef<AppConfig | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const c = await invoke<AppConfig>("config_load");
      setSavedConfig(c);
    } catch {
      /* keep null */
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const toApply = showSettings && draftConfig !== null ? draftConfig : savedConfig;
    configToApplyRef.current = toApply;
    applyTheme(toApply);
    if (toApply?.theme === "system") {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme(configToApplyRef.current);
      m.addEventListener("change", listener);
      return () => m.removeEventListener("change", listener);
    }
  }, [showSettings, draftConfig, savedConfig]);

  const onOpenSettings = useCallback(() => setShowSettings(true), []);

  const ctx: AppLayoutContext = { onOpenSettings, configVersion, savedConfig };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppNav onOpenSettings={onOpenSettings} />
      <div className="flex flex-1 overflow-hidden">
        <Outlet context={ctx} />
      </div>
      <Settings
        open={showSettings}
        savedConfig={savedConfig}
        onDraftChange={setDraftConfig}
        onClose={() => {
          setShowSettings(false);
          setDraftConfig(null);
        }}
        onSaved={(c) => {
          setSavedConfig(c);
          setShowSettings(false);
          setDraftConfig(null);
          setConfigVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
