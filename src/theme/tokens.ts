import type { AppConfig } from "../types";

export function applyThemeTokens(config: AppConfig | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const tokens = config?.theme_tokens;
  const apply = (name: string, value?: string | null) => {
    if (value && value.trim()) root.style.setProperty(name, value.trim());
    else root.style.removeProperty(name);
  };
  apply("--surface-bg", tokens?.surface_bg);
  apply("--panel-bg", tokens?.panel_bg);
  apply("--text-primary", tokens?.text_primary);
  apply("--text-muted-custom", tokens?.text_muted);
  apply("--border-custom", tokens?.border);
  // Map advanced tokens into app-wide theme variables.
  apply("--bg-main", tokens?.surface_bg);
  apply("--bg-sidebar", tokens?.panel_bg);
  apply("--bg-header", tokens?.panel_bg);
  apply("--text", tokens?.text_primary);
  apply("--text-muted", tokens?.text_muted);
  apply("--border", tokens?.border);

  const radiusScale = tokens?.radius_scale ?? null;
  if (radiusScale === "sm") root.style.setProperty("--radius-scale", "0.85");
  else if (radiusScale === "lg") root.style.setProperty("--radius-scale", "1.2");
  else root.style.removeProperty("--radius-scale");

  const density = tokens?.density ?? null;
  if (density === "compact") root.style.setProperty("--density-multiplier", "0.9");
  else root.style.removeProperty("--density-multiplier");
}

