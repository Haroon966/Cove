import { useState, useEffect, useCallback } from "react";
import { invoke } from "../api/tauri";
import type { AppConfig, BackendType } from "../types";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { getModelLogoPath, MODEL_LOGO_BASE } from "../modelLogos";
import { ChevronDown, List, Loader2, Palette, Radar, Save, Settings as SettingsIcon, Sparkles, X } from "./Icons";

interface SettingsProps {
  savedConfig: AppConfig | null;
  onDraftChange: (config: AppConfig) => void;
  onClose: () => void;
  onSaved: (config: AppConfig) => void;
}

const COMMON_OLLAMA_URL = "http://localhost:11434";
const COMMON_OPENAI_URLS = [
  "http://localhost:1234",
  "http://localhost:8080",
  "http://127.0.0.1:1234",
  "http://127.0.0.1:8080",
];

const THEME_OPTIONS = ["light", "dark", "system"] as const;
const BRAND_COLORS = [
  "#135bec",
  "#5f4a8b",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#6366f1",
  "#1e293b",
];

async function detectOllama(url: string): Promise<boolean> {
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/api/tags", { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}

async function detectOpenAI(url: string): Promise<boolean> {
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/v1/models", { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}

function hasUnsavedChanges(draft: AppConfig, saved: AppConfig | null): boolean {
  if (!saved) return true;
  return (
    (draft.backend_type ?? "ollama") !== (saved.backend_type ?? "ollama") ||
    (draft.base_url ?? "") !== (saved.base_url ?? "") ||
    (draft.model ?? "") !== (saved.model ?? "") ||
    (draft.api_key ?? "") !== (saved.api_key ?? "") ||
    (draft.system_prompt ?? "") !== (saved.system_prompt ?? "") ||
    (draft.theme ?? "light") !== (saved.theme ?? "light") ||
    (draft.primary_color ?? "") !== (saved.primary_color ?? "")
  );
}

const defaultConfig: AppConfig = {
  backend_type: "ollama",
  base_url: COMMON_OLLAMA_URL,
  model: "llama2",
  api_key: null,
  system_prompt: null,
  theme: "light",
  primary_color: null,
};

export function Settings({ savedConfig, onDraftChange, onClose, onSaved }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig>(() => ({
    ...defaultConfig,
    ...(savedConfig ?? {}),
  }));
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState<Set<string>>(new Set());

  useEffect(() => {
    onDraftChange(config);
  }, [config, onDraftChange]);

  useEffect(() => {
    (async () => {
      try {
        const c = await invoke<AppConfig>("config_load");
        setConfig({
          backend_type: c.backend_type ?? "ollama",
          base_url: c.base_url ?? COMMON_OLLAMA_URL,
          model: c.model ?? "llama2",
          api_key: c.api_key ?? null,
          system_prompt: c.system_prompt ?? null,
          theme: c.theme ?? "light",
          primary_color: c.primary_color ?? null,
        });
      } catch {
        // use defaults
      }
    })();
  }, []);

  const fetchModels = useCallback(() => {
    if (!config.base_url?.trim()) {
      setModels([]);
      return;
    }
    const url = config.base_url.trim();
    setLoadingModels(true);
    if (config.backend_type === "ollama") {
      fetchOllamaModels(url)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, config.api_key)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [config.backend_type, config.base_url, config.api_key]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      const ollamaOk = await detectOllama(COMMON_OLLAMA_URL);
      if (ollamaOk) {
        const list = await fetchOllamaModels(COMMON_OLLAMA_URL);
        setModels(list);
        setConfig((c) => ({
          ...c,
          backend_type: "ollama",
          base_url: COMMON_OLLAMA_URL,
          model: list.length > 0 ? list[0] : (c.model ?? "llama2"),
        }));
        setDetecting(false);
        return;
      }
      for (const baseUrl of COMMON_OPENAI_URLS) {
        const ok = await detectOpenAI(baseUrl);
        if (ok) {
          const list = await fetchOpenAIModels(baseUrl, null);
          setModels(list);
          setConfig((c) => ({
            ...c,
            backend_type: "openai",
            base_url: baseUrl,
            model: list.length > 0 ? list[0] : c.model,
          }));
          setDetecting(false);
          return;
        }
      }
      setModels([]);
    } catch {
      setModels([]);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    try {
      await invoke("config_save", { config });
      onSaved(config);
      setShowCloseConfirm(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseOrDiscard = () => {
    if (hasUnsavedChanges(config, savedConfig)) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const handleRevert = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  const currentTheme = config.theme ?? "light";

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <div className="settings-header-text">
            <h1 className="settings-title">AI Chatbot Configuration</h1>
            <p className="settings-subtitle">Manage your chatbot's intelligence and visual identity.</p>
          </div>
          <button type="button" className="btn-close" onClick={handleCloseOrDiscard} aria-label="Close">
            <X size={24} strokeWidth={2} />
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-column settings-column-general">
            <div className="settings-section-heading">
              <SettingsIcon size={20} strokeWidth={2} aria-hidden />
              <h2 className="settings-section-title">General AI Settings</h2>
            </div>
            <div className="settings-section-body">
              <div className="settings-field">
                <label className="settings-label">Model</label>
                <div className="settings-select-wrap">
                  {(config.backend_type === "ollama" || config.backend_type === "openai") && models.length > 0 ? (
                    <>
                      <select
                        className="settings-select"
                        value={config.model ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, model: e.target.value || null }))
                        }
                      >
                        {models.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} strokeWidth={2} className="settings-select-chevron" aria-hidden />
                    </>
                  ) : (
                    <input
                      type="text"
                      className="settings-input"
                      value={config.model ?? ""}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, model: e.target.value || null }))
                      }
                      placeholder="llama2 or model name"
                    />
                  )}
                </div>
                {(config.backend_type === "ollama" || config.backend_type === "openai") && loadingModels && (
                  <span className="settings-hint">Loading models…</span>
                )}
              </div>

              <div className="settings-field">
                <label className="settings-label">System Prompt</label>
                <textarea
                  className="settings-textarea"
                  value={config.system_prompt ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, system_prompt: e.target.value.trim() || null }))
                  }
                  placeholder="You are a helpful customer support assistant for a SaaS company..."
                  rows={5}
                />
                <p className="settings-hint">This defines the core personality and behavior constraints of your bot.</p>
              </div>

              <div className="settings-technical-row">
                <div className="settings-field">
                  <label className="settings-label">Base URL</label>
                  <div className="settings-input-row">
                    <input
                      type="url"
                      className="settings-input"
                      value={config.base_url ?? ""}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, base_url: e.target.value || null }))
                      }
                      placeholder="http://localhost:11434"
                    />
                    <button
                      type="button"
                      className="btn-detect"
                      onClick={handleAutoDetect}
                      disabled={detecting}
                      title="Detect local Ollama or OpenAI-compatible server"
                    >
                      {detecting ? (
                        <><Loader2 size={16} className="spin" aria-hidden /> Detecting…</>
                      ) : (
                        <><Radar size={16} strokeWidth={2} aria-hidden /> Auto-detect</>
                      )}
                    </button>
                  </div>
                </div>
                <div className="settings-field">
                  <label className="settings-label">Backend</label>
                  <select
                    className="settings-select"
                    value={config.backend_type ?? "ollama"}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        backend_type: e.target.value as BackendType,
                      }))
                    }
                  >
                    <option value="ollama">Ollama</option>
                    <option value="openai">OpenAI-compatible</option>
                  </select>
                </div>
              </div>

              {config.backend_type === "openai" && (
                <div className="settings-field">
                  <label className="settings-label">API key (optional)</label>
                  <input
                    type="password"
                    className="settings-input"
                    value={config.api_key ?? ""}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, api_key: e.target.value || null }))
                    }
                    placeholder="sk-…"
                  />
                </div>
              )}

              {models.length > 0 && (
                <div className="settings-models-block">
                  <span className="settings-models-title">
                    <List size={14} strokeWidth={2} className="settings-models-title-icon" aria-hidden />
                    Detected models ({models.length})
                  </span>
                  <ul className="settings-models-list">
                    {models.map((m) => {
                      const logoFile = getModelLogoPath(m);
                      const showLogo = logoFile && !logoLoadFailed.has(m);
                      return (
                        <li key={m} className={config.model === m ? "selected" : ""}>
                          <span className="settings-model-item">
                            {showLogo ? (
                              <img
                                src={`${MODEL_LOGO_BASE}/${logoFile}`}
                                alt=""
                                className="settings-model-logo"
                                onError={() => setLogoLoadFailed((prev) => new Set(prev).add(m))}
                              />
                            ) : (
                              <span className="settings-model-logo settings-model-logo-fallback" aria-hidden>
                                <Sparkles size={14} strokeWidth={2} />
                              </span>
                            )}
                            <span className="settings-model-name">{m}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="settings-column settings-column-appearance">
            <div className="settings-section-heading">
              <Palette size={20} strokeWidth={2} aria-hidden />
              <h2 className="settings-section-title">Appearance</h2>
            </div>
            <div className="settings-section-body">
              <div className="settings-field">
                <label className="settings-label">Interface Theme</label>
                <div className="settings-theme-toggle">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={"settings-theme-btn" + (currentTheme === t ? " active" : "")}
                      onClick={() => setConfig((c) => ({ ...c, theme: t }))}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field">
                <label className="settings-label">Brand Color</label>
                <div className="settings-color-swatches">
                  {BRAND_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={"settings-color-swatch" + (config.primary_color === hex ? " active" : "")}
                      style={{ background: hex }}
                      onClick={() => setConfig((c) => ({ ...c, primary_color: hex }))}
                      title={hex}
                      aria-label={`Set brand color to ${hex}`}
                    />
                  ))}
                </div>
                <div className="settings-color-custom">
                  <span className="settings-color-custom-label">Custom</span>
                  <div className="settings-color-custom-row">
                    <input
                      type="color"
                      className="settings-color-picker"
                      value={config.primary_color && /^#[0-9A-Fa-f]{6}$/.test(config.primary_color) ? config.primary_color : "#5f4a8b"}
                      onChange={(e) => setConfig((c) => ({ ...c, primary_color: e.target.value }))}
                      title="Pick custom color"
                    />
                    <input
                      type="text"
                      className="settings-input settings-color-hex"
                      value={config.primary_color ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v === "" || /^#[0-9A-Fa-f]{6}$/.test(v) || /^[0-9A-Fa-f]{6}$/.test(v)) {
                          setConfig((c) => ({ ...c, primary_color: v ? (v.startsWith("#") ? v : "#" + v) : null }));
                        }
                      }}
                      placeholder="#135BEC"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              <div className="settings-preview">
                <span className="settings-preview-label">Live Preview</span>
                <p className="settings-preview-hint">Updates as you change theme and brand color.</p>
                <div className="settings-preview-box">
                  <div className="settings-preview-mock">
                    <div className="settings-preview-avatar" />
                    <div className="settings-preview-line settings-preview-line-short" />
                    <div className="settings-preview-line settings-preview-line-medium" />
                    <div className="settings-preview-bubble" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" className="btn-secondary" onClick={handleCloseOrDiscard}>
            Discard
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            <Save size={18} strokeWidth={2} aria-hidden />
            Save Changes
          </button>
        </div>
      </div>

      {showCloseConfirm && (
        <div className="settings-confirm-overlay">
          <div className="settings-confirm-modal" role="alertdialog" aria-labelledby="settings-confirm-title" aria-describedby="settings-confirm-desc">
            <h3 id="settings-confirm-title" className="settings-confirm-title">Unsaved changes</h3>
            <p id="settings-confirm-desc" className="settings-confirm-desc">You have unsaved changes. Keep changes or revert?</p>
            <div className="settings-confirm-actions">
              <button type="button" className="btn-secondary" onClick={handleRevert}>
                Revert
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                <Save size={18} strokeWidth={2} aria-hidden />
                Keep changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
