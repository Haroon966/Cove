import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "../api/tauri";
import type { AppConfig, BackendType } from "../types";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { getModelLogoPath, MODEL_LOGO_BASE } from "../modelLogos";
import { ChevronDown, List, Loader2, Palette, Plus, Radar, Save, Settings as SettingsIcon, Sparkles, Trash2, X } from "./Icons";
import { DEFAULT_API_KEY_PROVIDERS, PROVIDER_PRESETS } from "../configHelpers";

interface SettingsProps {
  savedConfig: AppConfig | null;
  onDraftChange: (config: AppConfig) => void;
  onClose: () => void;
  onSaved: (config: AppConfig) => void;
  onBackupRestore?: () => void;
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
  const draftKeys = JSON.stringify(draft.api_keys ?? {});
  const savedKeys = JSON.stringify(saved.api_keys ?? {});
  return (
    (draft.backend_type ?? "ollama") !== (saved.backend_type ?? "ollama") ||
    (draft.base_url ?? "") !== (saved.base_url ?? "") ||
    (draft.model ?? "") !== (saved.model ?? "") ||
    (draft.api_key ?? "") !== (saved.api_key ?? "") ||
    draftKeys !== savedKeys ||
    (draft.system_prompt ?? "") !== (saved.system_prompt ?? "") ||
    (draft.theme ?? "light") !== (saved.theme ?? "light") ||
    (draft.primary_color ?? "") !== (saved.primary_color ?? "") ||
    (draft.temperature ?? null) !== (saved.temperature ?? null) ||
    (draft.max_tokens ?? null) !== (saved.max_tokens ?? null)
  );
}

const defaultConfig: AppConfig = {
  backend_type: "ollama",
  base_url: COMMON_OLLAMA_URL,
  model: "llama2",
  api_key: null,
  api_keys: null,
  system_prompt: null,
  theme: "light",
  primary_color: null,
  temperature: null,
  max_tokens: null,
};

export function Settings({ savedConfig, onDraftChange, onClose, onSaved, onBackupRestore }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig>(() => ({
    ...defaultConfig,
    ...(savedConfig ?? {}),
  }));
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState<Set<string>>(new Set());
  const [backupRestoreStatus, setBackupRestoreStatus] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreModeRef = useRef<"merge" | "replace">("merge");

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
          api_keys: c.api_keys ?? null,
          system_prompt: c.system_prompt ?? null,
          theme: c.theme ?? "light",
          primary_color: c.primary_color ?? null,
          temperature: c.temperature ?? null,
          max_tokens: c.max_tokens ?? null,
        });
      } catch {
        // use defaults
      }
    })();
  }, []);

  const fetchModels = useCallback(() => {
    const bt = config.backend_type ?? "ollama";
    const preset = bt in PROVIDER_PRESETS ? PROVIDER_PRESETS[bt as keyof typeof PROVIDER_PRESETS] : null;
    const url = preset ? preset.baseUrl : (config.base_url?.trim() ?? "");
    if (!url) {
      setModels([]);
      return;
    }
    const apiKey = preset ? (config.api_keys?.[bt] ?? null) : config.api_key;
    setLoadingModels(true);
    if (bt === "ollama") {
      fetchOllamaModels(url)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, apiKey)
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [config.backend_type, config.base_url, config.api_key, config.api_keys]);

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
            backend_type: "openai_compatible",
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
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2500);
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

  const handleBackup = async () => {
    setBackupRestoreStatus(null);
    try {
      const data = await invoke<string>("export_all_data");
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const path = await save({ defaultPath: `cove-backup-${Date.now()}.json` });
        if (path) {
          await writeTextFile(path, data);
          setBackupRestoreStatus("Backup saved.");
        }
      } catch {
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cove-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setBackupRestoreStatus("Backup downloaded.");
      }
    } catch (e) {
      setBackupRestoreStatus(e instanceof Error ? e.message : "Backup failed.");
    }
  };

  const handleRestoreClick = (mode: "replace" | "merge") => {
    restoreModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const handleRestoreFileChange = async () => {
    const input = fileInputRef.current;
    if (!input?.files?.length) return;
    const mode = restoreModeRef.current;
    setBackupRestoreStatus(null);
    try {
      const file = input.files[0];
      const text = await file.text();
      await invoke("import_backup", { json: text, mode });
      setBackupRestoreStatus("Restore complete.");
      input.value = "";
      onBackupRestore?.();
    } catch (e) {
      setBackupRestoreStatus(e instanceof Error ? e.message : "Restore failed.");
    }
  };

  const currentTheme = config.theme ?? "light";

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <div className="settings-header-text">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Configure your AI provider, model, and appearance.</p>
          </div>
          <div className="settings-header-actions">
            {savedMessage && (
              <span className="settings-saved-badge" role="status" aria-live="polite">Saved</span>
            )}
            <button type="button" className="btn-close" onClick={handleCloseOrDiscard} aria-label="Close settings">
              <X size={24} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="settings-content">
          <div className="settings-column settings-column-general">
            <div className="settings-section-heading">
              <SettingsIcon size={20} strokeWidth={2} aria-hidden />
              <h2 className="settings-section-title">AI &amp; connection</h2>
            </div>
            <div className="settings-section-body">
              {/* Connection: provider first, then URL and key */}
              <div className="settings-block">
                <h3 className="settings-block-title">Connection</h3>
                <p className="settings-block-desc">Choose where your chat requests are sent.</p>
              <div className="settings-field">
                <label className="settings-label" htmlFor="settings-provider">API provider</label>
                <div className="settings-select-wrap">
                  <select
                    id="settings-provider"
                    className="settings-select"
                    value={config.backend_type ?? "ollama"}
                    onChange={(e) => {
                      const v = e.target.value as BackendType;
                      const preset = v in PROVIDER_PRESETS ? PROVIDER_PRESETS[v as keyof typeof PROVIDER_PRESETS] : null;
                      setConfig((c) => ({
                        ...c,
                        backend_type: v,
                        base_url: preset ? preset.baseUrl : (c.base_url ?? ""),
                      }));
                    }}
                    aria-describedby="settings-provider-hint"
                  >
                    <option value="ollama">Ollama (local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="openai_compatible">Custom (OpenAI-compatible)</option>
                  </select>
                  <ChevronDown size={18} strokeWidth={2} className="settings-select-chevron" aria-hidden />
                </div>
                <p id="settings-provider-hint" className="settings-hint">Where to send chat requests. Cloud providers need an API key below.</p>
              </div>

              <div className="settings-field">
                <label className="settings-label" htmlFor="settings-base-url">Base URL</label>
                <div className="settings-input-row">
                  <input
                    id="settings-base-url"
                    type="url"
                    className={"settings-input" + (config.backend_type === "openai" || config.backend_type === "groq" ? " settings-input-readonly" : "")}
                    value={config.base_url ?? ""}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, base_url: e.target.value || null }))
                    }
                    placeholder="http://localhost:11434"
                    readOnly={config.backend_type === "openai" || config.backend_type === "groq"}
                    aria-readonly={config.backend_type === "openai" || config.backend_type === "groq"}
                  />
                  <button
                    type="button"
                    className="btn-detect"
                    onClick={handleAutoDetect}
                    disabled={detecting || config.backend_type === "openai" || config.backend_type === "groq"}
                    title="Detect local Ollama or OpenAI-compatible server"
                    aria-label="Auto-detect local server"
                  >
                    {detecting ? (
                      <><Loader2 size={16} className="spin" aria-hidden /> Detecting…</>
                    ) : (
                      <><Radar size={16} strokeWidth={2} aria-hidden /> Auto-detect</>
                    )}
                  </button>
                </div>
                {(config.backend_type === "openai" || config.backend_type === "groq") && (
                  <p className="settings-hint">URL is set automatically for this provider.</p>
                )}
              </div>

              {(config.backend_type === "openai" || config.backend_type === "groq") && (
                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-api-key-current">
                    API key ({PROVIDER_PRESETS[config.backend_type]?.label ?? config.backend_type})
                  </label>
                  <input
                    id="settings-api-key-current"
                    type="password"
                    className="settings-input"
                    value={config.api_keys?.[config.backend_type] ?? ""}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        api_keys: { ...(c.api_keys ?? {}), [c.backend_type!]: e.target.value || "" },
                      }))
                    }
                    placeholder="Paste your API key"
                    autoComplete="off"
                  />
                  <p className="settings-hint">Required for cloud API. Stored only on your device.</p>
                </div>
              )}
              {config.backend_type === "openai_compatible" && (
                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-api-key-custom">API key (optional)</label>
                  <input
                    id="settings-api-key-custom"
                    type="password"
                    className="settings-input"
                    value={config.api_key ?? ""}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, api_key: e.target.value || null }))
                    }
                    placeholder="sk-…"
                    autoComplete="off"
                  />
                </div>
              )}
              </div>

              {/* Model & behavior */}
              <div className="settings-block">
                <h3 className="settings-block-title">Model &amp; behavior</h3>
                <p className="settings-block-desc">Which model to use and how it should respond.</p>
              <div className="settings-field">
                <label className="settings-label" htmlFor="settings-model">Model</label>
                <div className="settings-select-wrap">
                  {config.backend_type !== "ollama" && models.length > 0 ? (
                    <>
                      <select
                        id="settings-model"
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
                      id="settings-model"
                      type="text"
                      className="settings-input"
                      value={config.model ?? ""}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, model: e.target.value || null }))
                      }
                      placeholder="e.g. llama2 or gpt-4o"
                    />
                  )}
                </div>
                {config.backend_type !== "ollama" && loadingModels && (
                  <span className="settings-hint" role="status">Loading models…</span>
                )}
              </div>

              <div className="settings-field">
                <label className="settings-label" htmlFor="settings-system-prompt">System prompt</label>
                <textarea
                  id="settings-system-prompt"
                  className="settings-textarea"
                  value={config.system_prompt ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, system_prompt: e.target.value.trim() || null }))
                  }
                  placeholder="You are a helpful assistant..."
                  rows={4}
                  aria-describedby="settings-system-prompt-hint"
                />
                <p id="settings-system-prompt-hint" className="settings-hint">Optional. Defines personality and rules for the AI.</p>
              </div>

              <div className="settings-technical-row">
                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-temperature">Temperature</label>
                  <input
                    id="settings-temperature"
                    type="number"
                    className="settings-input"
                    min={0}
                    max={2}
                    step={0.1}
                    value={config.temperature ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfig((c) => ({
                        ...c,
                        temperature: v === "" ? null : Math.max(0, Math.min(2, Number(v))),
                      }));
                    }}
                    placeholder="0.7"
                    aria-describedby="settings-temperature-hint"
                  />
                  <p id="settings-temperature-hint" className="settings-hint">Higher = more creative. Empty = provider default.</p>
                </div>
                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-max-tokens">Max tokens</label>
                  <input
                    id="settings-max-tokens"
                    type="number"
                    className="settings-input"
                    min={1}
                    step={1}
                    value={config.max_tokens ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfig((c) => ({
                        ...c,
                        max_tokens: v === "" ? null : Math.max(1, parseInt(v, 10) || 1),
                      }));
                    }}
                    placeholder="2048"
                    aria-describedby="settings-max-tokens-hint"
                  />
                  <p id="settings-max-tokens-hint" className="settings-hint">Max response length. Empty = default.</p>
                </div>
              </div>
              </div>

              {/* Stored API keys */}
              <div className="settings-block settings-block-keys">
                <h3 className="settings-block-title">Stored API keys</h3>
                <p className="settings-block-desc">Save keys for each provider. The key for your selected provider above is used when you chat.</p>
                <div className="settings-api-keys-list">
                  {DEFAULT_API_KEY_PROVIDERS.map((id) => (
                    <div key={id} className="settings-api-key-row">
                      <span className="settings-api-key-name">{id === "openai" ? "OpenAI" : id === "groq" ? "Groq" : "Gemini"}</span>
                      <input
                        type="password"
                        className="settings-input settings-api-key-input"
                        value={config.api_keys?.[id] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            api_keys: { ...(c.api_keys ?? {}), [id]: e.target.value },
                          }))
                        }
                        placeholder={`${id} API key`}
                      />
                    </div>
                  ))}
                  {Object.keys(config.api_keys ?? {}).filter((k) => !(DEFAULT_API_KEY_PROVIDERS as readonly string[]).includes(k)).map((id) => (
                    <div key={id} className="settings-api-key-row">
                      <span className="settings-api-key-name">{id}</span>
                      <input
                        type="password"
                        className="settings-input settings-api-key-input"
                        value={config.api_keys?.[id] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            api_keys: { ...(c.api_keys ?? {}), [id]: e.target.value },
                          }))
                        }
                        placeholder="API key"
                      />
                      <button
                        type="button"
                        className="btn-icon-small"
                        onClick={() =>
                          setConfig((c) => {
                            const next = { ...(c.api_keys ?? {}) };
                            delete next[id];
                            return { ...c, api_keys: Object.keys(next).length ? next : null };
                          })
                        }
                        aria-label={`Remove ${id} key`}
                        title={`Remove ${id}`}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  <div className="settings-add-provider-row">
                    <input
                      type="text"
                      className="settings-input settings-add-provider-input"
                      value={newProviderName}
                      onChange={(e) => setNewProviderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const name = newProviderName.trim();
                          if (name) {
                            const id = name.toLowerCase().replace(/\s+/g, "_");
                            setConfig((c) => ({
                              ...c,
                              api_keys: { ...(c.api_keys ?? {}), [id]: "" },
                            }));
                            setNewProviderName("");
                          }
                        }
                      }}
                      placeholder="New provider name (e.g. together)"
                      aria-label="New provider name"
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-add-provider"
                      onClick={() => {
                        const name = newProviderName.trim();
                        if (name) {
                          const id = name.toLowerCase().replace(/\s+/g, "_");
                          setConfig((c) => ({
                            ...c,
                            api_keys: { ...(c.api_keys ?? {}), [id]: "" },
                          }));
                          setNewProviderName("");
                        }
                      }}
                      disabled={!newProviderName.trim()}
                    >
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {models.length > 0 && (
                <div className="settings-block settings-models-block">
                  <h3 className="settings-block-title">
                    <List size={14} strokeWidth={2} className="settings-models-title-icon" aria-hidden />
                    Detected models ({models.length})
                  </h3>
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

              <div className="settings-block settings-backup">
                <h3 className="settings-block-title">Data</h3>
                <p className="settings-block-desc">Export or restore your sessions and messages.</p>
                <div className="settings-backup-actions">
                  <button type="button" className="btn-secondary" onClick={handleBackup}>
                    Backup all data
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="settings-file-input"
                    aria-label="Choose backup file"
                    onChange={handleRestoreFileChange}
                  />
                  <button type="button" className="btn-secondary" onClick={() => handleRestoreClick("merge")}>
                    Restore (merge)
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => handleRestoreClick("replace")}>
                    Restore (replace)
                  </button>
                </div>
                {backupRestoreStatus && (
                  <p className="settings-backup-status" role="status" aria-live="polite">{backupRestoreStatus}</p>
                )}
              </div>
            </div>
          </div>

          <div className="settings-column settings-column-appearance">
            <div className="settings-section-heading">
              <Palette size={20} strokeWidth={2} aria-hidden />
              <h2 className="settings-section-title">Appearance</h2>
            </div>
            <div className="settings-section-body">
              <div className="settings-field">
                <label className="settings-label" id="settings-theme-label">Theme</label>
                <div className="settings-theme-toggle" role="group" aria-labelledby="settings-theme-label">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={"settings-theme-btn" + (currentTheme === t ? " active" : "")}
                      onClick={() => setConfig((c) => ({ ...c, theme: t }))}
                      aria-pressed={currentTheme === t}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="settings-hint">Light, dark, or follow system.</p>
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
