import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, isTauriDesktop } from "../api/tauri";
import type { AppConfig, BackendType } from "../types";
import { fetchOllamaModels } from "../api/ollama";
import { fetchOpenAIModels } from "../api/openai";
import { fetchOpenWebUIModels } from "../api/openwebui";
import { Loader2, Plus, Radar, Save, Sparkles, Trash2, X, RefreshCw } from "./Icons";
import { DEFAULT_API_KEY_PROVIDERS, FIXED_BASE_URL_PROVIDERS, PROVIDER_PRESETS } from "../configHelpers";
import { getMcpServerStatus } from "../features/mcp/mcpRuntime";
import { discoverAllProviderModels, type ProviderModelCatalog } from "../features/models/modelDiscovery";
import { clearBackendAuditLogs, listBackendAuditLogs, type BackendAuditLogRecord } from "../features/logging/backendAuditLog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DEFAULT_APP_CONFIG } from "../config/defaultAppConfig";

interface SettingsProps {
  open: boolean;
  savedConfig: AppConfig | null;
  onDraftChange: (config: AppConfig) => void;
  onClose: () => void;
  onSaved: (config: AppConfig) => void;
  onBackupRestore?: () => void;
}

const COMMON_OLLAMA_URL = "http://localhost:11434";
const COMMON_OPENAI_URLS = ["http://localhost:1234", "http://localhost:8080", "http://127.0.0.1:1234"];
const COMMON_OPENWEBUI_URLS = ["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:3000"];
const THEME_OPTIONS = ["light", "dark", "system"] as const;
const BRAND_COLORS = ["#135bec", "#5f4a8b", "#10b981", "#f59e0b", "#f43f5e", "#6366f1", "#1e293b"];

async function detectOllama(url: string): Promise<boolean> {
  try { return (await fetch(url.replace(/\/$/, "") + "/api/tags")).ok; } catch { return false; }
}
async function detectOpenAI(url: string): Promise<boolean> {
  try { return (await fetch(url.replace(/\/$/, "") + "/v1/models")).ok; } catch { return false; }
}
async function detectOpenWebUI(url: string): Promise<boolean> {
  try {
    const base = url.replace(/\/$/, "");
    for (const ep of [`${base}/api/models`, `${base}/v1/models`, `${base}/api/version`]) {
      if ((await fetch(ep)).ok) return true;
    }
    return false;
  } catch { return false; }
}

const defaultConfig: AppConfig = { ...DEFAULT_APP_CONFIG };

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-3 first:mt-0">{children}</h3>;
}

export function Settings({ open, savedConfig, onDraftChange, onClose, onSaved, onBackupRestore }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig>(() => ({ ...defaultConfig, ...(savedConfig ?? {}) }));
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [backupRestoreStatus, setBackupRestoreStatus] = useState<string | null>(null);
  const [mcpStatusMap, setMcpStatusMap] = useState<Record<string, string>>({});
  const [discoveringAllModels, setDiscoveringAllModels] = useState(false);
  const [providerCatalog, setProviderCatalog] = useState<ProviderModelCatalog[]>([]);
  const [backendAuditLogs, setBackendAuditLogs] = useState<BackendAuditLogRecord[]>([]);
  const [whatsappBridgeUrl, setWhatsappBridgeUrl] = useState<string | null>(null);
  const [whatsappBridgeError, setWhatsappBridgeError] = useState<string | null>(null);
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const [whatsappQrDataUrl, setWhatsappQrDataUrl] = useState<string | null>(null);
  const [whatsappBridgeUnreachable, setWhatsappBridgeUnreachable] = useState(false);
  const [whatsappManualUrl, setWhatsappManualUrl] = useState("http://127.0.0.1:3456");
  const whatsappPollFailuresRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreModeRef = useRef<"merge" | "replace">("merge");

  useEffect(() => {
    if (open && savedConfig) {
      setConfig({ ...defaultConfig, ...savedConfig });
    }
  }, [open, savedConfig]);

  useEffect(() => { onDraftChange(config); }, [config, onDraftChange]);

  const fetchModels = useCallback(() => {
    const bt = config.backend_type ?? "ollama";
    const preset = bt in PROVIDER_PRESETS ? PROVIDER_PRESETS[bt as keyof typeof PROVIDER_PRESETS] : null;
    const shouldUseFixedPreset = (FIXED_BASE_URL_PROVIDERS as readonly string[]).includes(bt);
    const url = shouldUseFixedPreset && preset ? preset.baseUrl : (config.base_url?.trim() ?? "");
    if (!url) { setModels([]); return; }
    const apiKey = preset ? (config.api_keys?.[bt] ?? null) : config.api_key;
    setLoadingModels(true);
    if (bt === "ollama") {
      fetchOllamaModels(url).then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    } else if (bt === "open_webui") {
      fetchOpenWebUIModels(url, apiKey, config.openwebui_api_path).then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    } else {
      fetchOpenAIModels(url, apiKey).then(setModels).catch(() => setModels([])).finally(() => setLoadingModels(false));
    }
  }, [config.backend_type, config.base_url, config.api_key, config.api_keys, config.openwebui_api_path]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  // WhatsApp polling
  useEffect(() => {
    if (!whatsappBridgeUrl || whatsappBridgeUnreachable) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      try {
        const statusRes = await fetch(`${whatsappBridgeUrl}/status`);
        if (cancelled) return;
        whatsappPollFailuresRef.current = 0;
        setWhatsappBridgeUnreachable(false);
        if (statusRes.ok) {
          const d = (await statusRes.json()) as { linked: boolean };
          setWhatsappLinked(d.linked);
          if (!d.linked) {
            const qrRes = await fetch(`${whatsappBridgeUrl}/qr.json`);
            if (!cancelled && qrRes.ok) {
              const j = (await qrRes.json()) as { qr?: string };
              if (j.qr) setWhatsappQrDataUrl(j.qr);
              else setWhatsappQrDataUrl(null);
            }
          }
        }
      } catch {
        whatsappPollFailuresRef.current += 1;
        if (whatsappPollFailuresRef.current >= 3) setWhatsappBridgeUnreachable(true);
      }
    };
    poll().then(() => { if (!cancelled) intervalId = setInterval(poll, 2000); });
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, [whatsappBridgeUrl, whatsappBridgeUnreachable]);

  const handleAutoDetect = async () => {
    setDetecting(true);
    try {
      if (await detectOllama(COMMON_OLLAMA_URL)) {
        const list = await fetchOllamaModels(COMMON_OLLAMA_URL);
        setModels(list);
        setConfig((c) => ({ ...c, backend_type: "ollama", base_url: COMMON_OLLAMA_URL, model: list[0] ?? c.model }));
        return;
      }
      for (const url of COMMON_OPENAI_URLS) {
        if (await detectOpenAI(url)) {
          const list = await fetchOpenAIModels(url, null);
          setModels(list);
          setConfig((c) => ({ ...c, backend_type: "openai_compatible", base_url: url, model: list[0] ?? c.model }));
          return;
        }
      }
      for (const url of COMMON_OPENWEBUI_URLS) {
        if (await detectOpenWebUI(url)) {
          const list = await fetchOpenWebUIModels(url, null, "/api");
          setModels(list);
          setConfig((c) => ({ ...c, backend_type: "open_webui", base_url: url, model: list[0] ?? c.model }));
          return;
        }
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    try {
      await invoke("config_save", { config });
      try { await invoke("whatsapp_write_bridge_config"); } catch { /* bridge may not be running */ }
      onSaved(config);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2500);
    } catch (e) { console.error(e); }
  };

  const handleBackup = async () => {
    setBackupRestoreStatus(null);
    try {
      const data = await invoke<string>("export_all_data");
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const path = await save({ defaultPath: `cove-backup-${Date.now()}.json` });
        if (path) { await writeTextFile(path, data); setBackupRestoreStatus("Backup saved."); }
      } catch {
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `cove-backup-${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
        setBackupRestoreStatus("Backup downloaded.");
      }
    } catch (e) { setBackupRestoreStatus(e instanceof Error ? e.message : "Backup failed."); }
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
      const text = await input.files[0].text();
      await invoke("import_backup", { json: text, mode });
      setBackupRestoreStatus("Restore complete. Restart to apply all changes.");
      input.value = "";
      onBackupRestore?.();
    } catch (e) { setBackupRestoreStatus(e instanceof Error ? e.message : "Restore failed."); }
  };

  const isFixedUrl = (FIXED_BASE_URL_PROVIDERS as readonly string[]).includes(config.backend_type ?? "");
  const needsApiKey = (DEFAULT_API_KEY_PROVIDERS as readonly string[]).includes(config.backend_type ?? "");
  const setFeatureFlag = (flag: string, enabled: boolean) => {
    setConfig((c) => ({
      ...c,
      feature_flags: {
        ...(c.feature_flags ?? {}),
        [flag]: enabled,
      },
    }));
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border flex-row items-center justify-between space-y-0">
          <div>
            <SheetTitle className="text-base font-semibold">Settings</SheetTitle>
            <SheetDescription className="text-xs">Configure your AI provider, model, and preferences.</SheetDescription>
          </div>
          <div className="flex items-center gap-2">
            {savedMessage && (
              <Badge variant="secondary" className="text-xs animate-fade-in" role="status" aria-live="polite">
                ✓ Saved
              </Badge>
            )}
            <Button size="sm" onClick={handleSave}>
              <Save size={14} className="mr-1.5" />
              Save
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close settings">
              <X size={16} strokeWidth={2} />
            </Button>
          </div>
        </SheetHeader>

        {/* Hidden restore input */}
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={() => void handleRestoreFileChange()} />

        {/* Tabs */}
        <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-6 mt-3 mb-0 shrink-0 w-auto justify-start h-8 text-xs">
            <TabsTrigger value="general" className="text-xs h-7">General</TabsTrigger>
            <TabsTrigger value="providers" className="text-xs h-7">Providers</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs h-7">Appearance</TabsTrigger>
            <TabsTrigger value="mcp" className="text-xs h-7">MCP</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs h-7">Advanced</TabsTrigger>
          </TabsList>

          {/* GENERAL TAB */}
          <TabsContent value="general" asChild>
            <ScrollArea className="flex-1 px-6 pb-6 pt-4">
              <div className="space-y-5">
                <SectionTitle>Connection</SectionTitle>

                <FieldGroup label="Provider" hint="Where to send chat requests.">
                  <Select
                    value={config.backend_type ?? "ollama"}
                    onValueChange={(v) => {
                      const bt = v as BackendType;
                      const preset = bt in PROVIDER_PRESETS ? PROVIDER_PRESETS[bt as keyof typeof PROVIDER_PRESETS] : null;
                      const fixed = (FIXED_BASE_URL_PROVIDERS as readonly string[]).includes(bt);
                      setConfig((c) => ({
                        ...c,
                        backend_type: bt,
                        base_url: fixed ? (preset?.baseUrl ?? c.base_url ?? "") : c.base_url,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama (local)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="groq">Groq</SelectItem>
                      <SelectItem value="open_webui">Open WebUI</SelectItem>
                      <SelectItem value="openai_compatible">Custom (OpenAI-compatible)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup label="Base URL" hint={isFixedUrl ? "URL is set automatically for this provider." : undefined}>
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      value={config.base_url ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, base_url: e.target.value || null }))}
                      placeholder="http://localhost:11434"
                      readOnly={isFixedUrl}
                      className={cn(isFixedUrl && "opacity-60")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => void handleAutoDetect()}
                      disabled={detecting || isFixedUrl}
                    >
                      {detecting ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} strokeWidth={2} />}
                      Detect
                    </Button>
                  </div>
                </FieldGroup>

                {needsApiKey && (
                  <FieldGroup
                    label={`API key (${config.backend_type && config.backend_type in PROVIDER_PRESETS ? PROVIDER_PRESETS[config.backend_type as keyof typeof PROVIDER_PRESETS]?.label : config.backend_type})`}
                    hint="Stored only on your device."
                  >
                    <Input
                      type="password"
                      value={config.api_keys?.[config.backend_type!] ?? ""}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, api_keys: { ...(c.api_keys ?? {}), [c.backend_type!]: e.target.value } }))
                      }
                      placeholder="Paste your API key"
                      autoComplete="off"
                    />
                  </FieldGroup>
                )}

                {config.backend_type === "openai_compatible" && (
                  <FieldGroup label="API key (optional)">
                    <Input
                      type="password"
                      value={config.api_key ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, api_key: e.target.value || null }))}
                      placeholder="sk-…"
                      autoComplete="off"
                    />
                  </FieldGroup>
                )}

                {config.backend_type === "open_webui" && (
                  <>
                    <FieldGroup label="Workspace" hint="Optional label for Open WebUI multi-workspace setups.">
                      <Input
                        value={config.openwebui_workspace ?? ""}
                        onChange={(e) => setConfig((c) => ({ ...c, openwebui_workspace: e.target.value || null }))}
                        placeholder="optional workspace name"
                      />
                    </FieldGroup>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup label="API path">
                        <Input
                          value={config.openwebui_api_path ?? "/api"}
                          onChange={(e) => setConfig((c) => ({ ...c, openwebui_api_path: e.target.value || "/api" }))}
                          placeholder="/api"
                        />
                      </FieldGroup>
                      <FieldGroup label="RAG context">
                        <Select
                          value={config.openwebui_enable_rag ? "on" : "off"}
                          onValueChange={(v) => setConfig((c) => ({ ...c, openwebui_enable_rag: v === "on" }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="off">Off</SelectItem>
                            <SelectItem value="on">On</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldGroup>
                    </div>
                  </>
                )}

                <Separator />
                <SectionTitle>Model & Behavior</SectionTitle>

                <FieldGroup label="Model">
                  <div className="flex gap-2">
                    {models.length > 0 ? (
                      <Select value={config.model ?? ""} onValueChange={(v) => setConfig((c) => ({ ...c, model: v }))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={config.model ?? ""}
                        onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value || null }))}
                        placeholder={loadingModels ? "Loading models…" : "e.g. llama3"}
                        className="flex-1"
                      />
                    )}
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={fetchModels} disabled={loadingModels} title="Refresh models">
                      <RefreshCw size={14} className={cn(loadingModels && "animate-spin")} strokeWidth={2} />
                    </Button>
                  </div>
                </FieldGroup>

                <FieldGroup label="System prompt" hint="Optional context sent at the start of every conversation.">
                  <Textarea
                    value={config.system_prompt ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, system_prompt: e.target.value || null }))}
                    placeholder="You are a helpful assistant…"
                    rows={4}
                    className="resize-none font-mono text-sm"
                  />
                </FieldGroup>

                <FieldGroup label={`Temperature: ${config.temperature != null ? config.temperature.toFixed(1) : "default"}`} hint="Higher = more creative. Leave blank for model default.">
                  <div className="flex items-center gap-3">
                    <Slider
                      min={0} max={2} step={0.1}
                      value={[config.temperature ?? 1]}
                      onValueChange={([v]) => setConfig((c) => ({ ...c, temperature: v }))}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setConfig((c) => ({ ...c, temperature: null }))}>
                      Reset
                    </Button>
                  </div>
                </FieldGroup>

                <FieldGroup label={`Max tokens: ${config.max_tokens != null ? config.max_tokens : "default"}`} hint="Maximum tokens per response. Leave blank for model default.">
                  <div className="flex items-center gap-3">
                    <Slider
                      min={256} max={32768} step={256}
                      value={[config.max_tokens ?? 4096]}
                      onValueChange={([v]) => setConfig((c) => ({ ...c, max_tokens: v }))}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setConfig((c) => ({ ...c, max_tokens: null }))}>
                      Reset
                    </Button>
                  </div>
                </FieldGroup>

                <FieldGroup label="Agent workspace path" hint="Root directory for agent file tools. Leave empty to disable.">
                  <Input
                    value={config.agent_workspace_path ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, agent_workspace_path: e.target.value || null }))}
                    placeholder="/home/user/projects"
                  />
                </FieldGroup>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* PROVIDERS TAB */}
          <TabsContent value="providers" asChild>
            <ScrollArea className="flex-1 px-6 pb-6 pt-4">
              <div className="space-y-5">
                <SectionTitle>Named API Keys</SectionTitle>
                <p className="text-xs text-muted-foreground">Manage API keys for multiple providers. Keys are stored only on your device.</p>

                <div className="space-y-2">
                  {(DEFAULT_API_KEY_PROVIDERS as readonly string[]).map((provider) => (
                    <FieldGroup key={provider} label={provider in PROVIDER_PRESETS ? (PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS]?.label ?? provider) : provider}>
                      <Input
                        type="password"
                        value={config.api_keys?.[provider] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, api_keys: { ...(c.api_keys ?? {}), [provider]: e.target.value } }))
                        }
                        placeholder={`${provider} API key`}
                        autoComplete="off"
                      />
                    </FieldGroup>
                  ))}
                </div>

                <Separator />
                <SectionTitle>Custom Providers</SectionTitle>

                <div className="flex gap-2">
                  <Input
                    value={newProviderName}
                    onChange={(e) => setNewProviderName(e.target.value)}
                    placeholder="Provider ID (e.g. mistral)"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!newProviderName.trim()}
                    onClick={() => {
                      const id = newProviderName.trim();
                      if (id) {
                        setConfig((c) => ({ ...c, api_keys: { ...(c.api_keys ?? {}), [id]: "" } }));
                        setNewProviderName("");
                      }
                    }}
                  >
                    <Plus size={13} className="mr-1" /> Add
                  </Button>
                </div>

                {config.api_keys && Object.keys(config.api_keys).filter((k) => !(DEFAULT_API_KEY_PROVIDERS as readonly string[]).includes(k)).map((provider) => (
                  <div key={provider} className="flex gap-2 items-end">
                    <FieldGroup label={provider} key={provider}>
                      <Input
                        type="password"
                        value={config.api_keys?.[provider] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, api_keys: { ...(c.api_keys ?? {}), [provider]: e.target.value } }))
                        }
                        placeholder="API key"
                        autoComplete="off"
                      />
                    </FieldGroup>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive mb-0"
                      onClick={() =>
                        setConfig((c) => {
                          const next = { ...(c.api_keys ?? {}) };
                          delete next[provider];
                          return { ...c, api_keys: next };
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}

                <Separator />
                <SectionTitle>Model Discovery</SectionTitle>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={discoveringAllModels}
                    onClick={async () => {
                      setDiscoveringAllModels(true);
                      try {
                        const catalogs = await discoverAllProviderModels(config);
                        setProviderCatalog(catalogs);
                      } finally {
                        setDiscoveringAllModels(false);
                      }
                    }}
                  >
                    {discoveringAllModels ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Sparkles size={13} className="mr-1.5" />}
                    Discover all provider models
                  </Button>
                  {providerCatalog.length > 0 && (
                    <div className="space-y-2">
                      {providerCatalog.map((cat) => (
                        <div key={cat.provider} className="border border-border rounded-lg p-3">
                          <p className="text-sm font-medium mb-1.5">{cat.provider}</p>
                          <div className="flex flex-wrap gap-1">
                            {cat.models.map((m) => (
                              <Badge
                                key={m}
                                variant="secondary"
                                className="text-xs cursor-pointer hover:bg-primary/20"
                                onClick={() => setConfig((c) => ({ ...c, model: m, backend_type: cat.provider as BackendType }))}
                              >
                                {m}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* APPEARANCE TAB */}
          <TabsContent value="appearance" asChild>
            <ScrollArea className="flex-1 px-6 pb-6 pt-4">
              <div className="space-y-5">
                <SectionTitle>Theme</SectionTitle>

                <FieldGroup label="Color scheme">
                  <div className="flex gap-2">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={cn(
                          "flex-1 py-2 rounded-md border text-sm font-medium capitalize transition-colors",
                          config.theme === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                        onClick={() => setConfig((c) => ({ ...c, theme: t }))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup label="Primary color">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 flex-wrap">
                      {BRAND_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            "w-7 h-7 rounded-full transition-transform hover:scale-110 ring-2 ring-offset-2 ring-offset-background",
                            config.primary_color === color ? "ring-primary" : "ring-transparent"
                          )}
                          style={{ background: color }}
                          onClick={() => setConfig((c) => ({ ...c, primary_color: color }))}
                          aria-label={color}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={config.primary_color ?? "#5f4a8b"}
                      onChange={(e) => setConfig((c) => ({ ...c, primary_color: e.target.value }))}
                      className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent p-0"
                      title="Custom color"
                    />
                    {config.primary_color && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfig((c) => ({ ...c, primary_color: null }))}>
                        Reset
                      </Button>
                    )}
                  </div>
                </FieldGroup>

                <Separator />
                <SectionTitle>Advanced Tokens</SectionTitle>
                <p className="text-xs text-muted-foreground">Override individual CSS color variables. Leave blank to use theme defaults.</p>

                {[
                  { key: "surface_bg" as const, label: "Surface background", placeholder: "#ffffff" },
                  { key: "panel_bg" as const, label: "Panel background", placeholder: "#f8fafc" },
                  { key: "text_primary" as const, label: "Primary text", placeholder: "#0f172a" },
                  { key: "text_muted" as const, label: "Muted text", placeholder: "#64748b" },
                  { key: "border" as const, label: "Border color", placeholder: "#e2e8f0" },
                ].map(({ key, label, placeholder }) => (
                  <FieldGroup key={key} label={label}>
                    <div className="flex gap-2 items-center">
                      <Input
                        value={config.theme_tokens?.[key] ?? ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            theme_tokens: { ...(c.theme_tokens ?? {}), [key]: e.target.value || null },
                          }))
                        }
                        placeholder={placeholder}
                        className="flex-1"
                      />
                      {config.theme_tokens?.[key] && (
                        <div
                          className="w-6 h-6 rounded border border-border shrink-0"
                          style={{ background: config.theme_tokens[key] ?? undefined }}
                        />
                      )}
                    </div>
                  </FieldGroup>
                ))}

                <FieldGroup label="Border radius">
                  <Select
                    value={config.theme_tokens?.radius_scale ?? "__none__"}
                    onValueChange={(v) =>
                      setConfig((c) => ({
                        ...c,
                        theme_tokens: { ...(c.theme_tokens ?? {}), radius_scale: (v === "__none__" ? null : v) as "sm" | "md" | "lg" | null },
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Default</SelectItem>
                      <SelectItem value="sm">Small (tighter)</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large (rounder)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup label="Density">
                  <Select
                    value={config.theme_tokens?.density ?? "__none__"}
                    onValueChange={(v) =>
                      setConfig((c) => ({
                        ...c,
                        theme_tokens: { ...(c.theme_tokens ?? {}), density: (v === "__none__" ? null : v) as "comfortable" | "compact" | null },
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Comfortable" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Comfortable (default)</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* MCP TAB */}
          <TabsContent value="mcp" asChild>
            <ScrollArea className="flex-1 px-6 pb-6 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionTitle>MCP Servers</SectionTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        mcp_servers: [
                          ...(c.mcp_servers ?? []),
                          { id: `mcp-${Date.now()}`, label: "", transport: "http", endpoint: "", enabled: true },
                        ],
                      }))
                    }
                  >
                    <Plus size={12} className="mr-1" /> Add server
                  </Button>
                </div>

                {(!config.mcp_servers || config.mcp_servers.length === 0) ? (
                  <div className="border border-dashed border-border rounded-lg py-8 text-center">
                    <p className="text-sm text-muted-foreground">No MCP servers configured.</p>
                    <p className="text-xs text-muted-foreground mt-1">Use Discover to install curated servers.</p>
                  </div>
                ) : (
                  config.mcp_servers.map((server, idx) => (
                    <div key={server.id} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={server.enabled}
                            onCheckedChange={(v) =>
                              setConfig((c) => ({
                                ...c,
                                mcp_servers: c.mcp_servers?.map((s, i) => i === idx ? { ...s, enabled: v } : s),
                              }))
                            }
                            className="h-4 w-7"
                          />
                          <Input
                            value={server.label}
                            onChange={(e) =>
                              setConfig((c) => ({
                                ...c,
                                mcp_servers: c.mcp_servers?.map((s, i) => i === idx ? { ...s, label: e.target.value } : s),
                              }))
                            }
                            placeholder="Server name"
                            className="h-7 text-xs w-32"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={async () => {
                              const status = await getMcpServerStatus(server.id);
                              setMcpStatusMap((m) => ({ ...m, [server.id]: status.detail ?? String(status) }));
                            }}
                          >
                            Status
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setConfig((c) => ({
                                ...c,
                                mcp_servers: c.mcp_servers?.filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={server.transport}
                          onValueChange={(v) =>
                            setConfig((c) => ({
                              ...c,
                              mcp_servers: c.mcp_servers?.map((s, i) => i === idx ? { ...s, transport: v as "http" | "stdio" } : s),
                            }))
                          }
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="http">HTTP</SelectItem>
                            <SelectItem value="stdio">stdio</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={server.endpoint}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              mcp_servers: c.mcp_servers?.map((s, i) => i === idx ? { ...s, endpoint: e.target.value } : s),
                            }))
                          }
                          placeholder={server.transport === "http" ? "http://localhost:3000" : "/path/to/server"}
                          className="h-7 text-xs"
                        />
                      </div>
                      {mcpStatusMap[server.id] && (
                        <p className="text-xs text-muted-foreground">{mcpStatusMap[server.id]}</p>
                      )}
                    </div>
                  ))
                )}

                <Separator />
                <SectionTitle>Tool Policy</SectionTitle>
                <FieldGroup label="Agent tool mode" hint="Controls how the agent is allowed to use tools.">
                  <Select
                    value={config.tool_policy?.mode ?? "confirm_all"}
                    onValueChange={(v) =>
                      setConfig((c) => ({
                        ...c,
                        tool_policy: { ...(c.tool_policy ?? { role: "owner", allowed_tools: null, denied_tools: null, require_confirmation_for: null }), mode: v as "allow_all" | "confirm_all" | "allow_list" | "deny_all" },
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow_all">Allow all (auto-approve)</SelectItem>
                      <SelectItem value="confirm_all">Confirm all</SelectItem>
                      <SelectItem value="allow_list">Allow list only</SelectItem>
                      <SelectItem value="deny_all">Deny all</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ADVANCED TAB */}
          <TabsContent value="advanced" asChild>
            <ScrollArea className="flex-1 px-6 pb-6 pt-4">
              <div className="space-y-5">
                <SectionTitle>Knowledge & Runtime</SectionTitle>

                <FieldGroup label="Knowledge index mode">
                  <Select
                    value={config.knowledge_index_mode ?? "sqlite_fts"}
                    onValueChange={(v) =>
                      setConfig((c) => ({ ...c, knowledge_index_mode: v as AppConfig["knowledge_index_mode"] }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sqlite_fts">SQLite FTS (default)</SelectItem>
                      <SelectItem value="sqlite_vec">SQLite vec (vector)</SelectItem>
                      <SelectItem value="sidecar">Sidecar service</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup label="Runtime profile">
                  <Select
                    value={config.runtime_profile ?? "default"}
                    onValueChange={(v) => setConfig((c) => ({ ...c, runtime_profile: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup label="Agent runtime flags" hint="Use feature flags for safe rollout and fallback.">
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">agent.runtimeV2.enabled</span>
                      <Switch
                        checked={(config.feature_flags?.["agent.runtimeV2.enabled"] ?? true) === true}
                        onCheckedChange={(v) => setFeatureFlag("agent.runtimeV2.enabled", v)}
                        className="h-4 w-7"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">agent.planner.capabilityAware</span>
                      <Switch
                        checked={(config.feature_flags?.["agent.planner.capabilityAware"] ?? true) === true}
                        onCheckedChange={(v) => setFeatureFlag("agent.planner.capabilityAware", v)}
                        className="h-4 w-7"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">agent.tools.parallel.enabled</span>
                      <Switch
                        checked={(config.feature_flags?.["agent.tools.parallel.enabled"] ?? true) === true}
                        onCheckedChange={(v) => setFeatureFlag("agent.tools.parallel.enabled", v)}
                        className="h-4 w-7"
                      />
                    </div>
                  </div>
                </FieldGroup>

                <Separator />
                <SectionTitle>Browser Command Bridge</SectionTitle>
                <FieldGroup label="Enable browser shell commands" hint="Allows command execution in browser mode through a local bridge service.">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!config.browser_command_bridge_enabled}
                      onCheckedChange={(v) => setConfig((c) => ({ ...c, browser_command_bridge_enabled: v }))}
                      className="h-4 w-7"
                    />
                    <span className="text-xs text-muted-foreground">
                      {config.browser_command_bridge_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </FieldGroup>
                <FieldGroup label="Bridge URL" hint="Default: http://127.0.0.1:4317">
                  <Input
                    type="url"
                    value={config.browser_command_bridge_url ?? "http://127.0.0.1:4317"}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        browser_command_bridge_url: e.target.value || "http://127.0.0.1:4317",
                      }))
                    }
                    placeholder="http://127.0.0.1:4317"
                  />
                </FieldGroup>
                <FieldGroup label="Bridge token (optional)" hint="Sent as Bearer token to the bridge.">
                  <Input
                    type="password"
                    value={config.browser_command_bridge_token ?? ""}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, browser_command_bridge_token: e.target.value || null }))
                    }
                    placeholder="Optional auth token"
                    autoComplete="off"
                  />
                </FieldGroup>

                <Separator />
                <SectionTitle>Backup & Restore</SectionTitle>

                {backupRestoreStatus && (
                  <div className={cn(
                    "px-3 py-2 rounded-lg text-xs border",
                    backupRestoreStatus.toLowerCase().includes("fail") || backupRestoreStatus.toLowerCase().includes("error")
                      ? "bg-destructive/10 border-destructive/20 text-destructive"
                      : "bg-primary/10 border-primary/20 text-primary"
                  )}>
                    {backupRestoreStatus}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void handleBackup()}>
                    Export backup
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRestoreClick("merge")}>
                    Restore (merge)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRestoreClick("replace")}>
                    Restore (replace)
                  </Button>
                </div>

                <Separator />
                <SectionTitle>WhatsApp Bridge</SectionTitle>

                {whatsappBridgeError && (
                  <div className="px-3 py-2 rounded-lg text-xs bg-destructive/10 border border-destructive/20 text-destructive">
                    {whatsappBridgeError}
                  </div>
                )}

                {!whatsappBridgeUrl ? (
                  <div className="space-y-3">
                    {isTauriDesktop() && (
                      <Button variant="outline" size="sm" onClick={async () => {
                        setWhatsappBridgeError(null);
                        setWhatsappBridgeUnreachable(false);
                        try {
                          const result = await invoke<{ url: string }>("whatsapp_bridge_start");
                          setWhatsappBridgeUrl(result.url);
                          setWhatsappQrDataUrl(null);
                          setWhatsappLinked(false);
                        } catch (e) {
                          setWhatsappBridgeError(e instanceof Error ? e.message : String(e));
                        }
                      }}>
                        Start WhatsApp bridge
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={whatsappManualUrl}
                        onChange={(e) => setWhatsappManualUrl(e.target.value)}
                        placeholder="http://127.0.0.1:3456"
                        className="h-8 text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={() => {
                        const url = whatsappManualUrl.trim().replace(/\/$/, "") || "http://127.0.0.1:3456";
                        setWhatsappBridgeError(null);
                        setWhatsappBridgeUnreachable(false);
                        setWhatsappBridgeUrl(url);
                        setWhatsappQrDataUrl(null);
                        setWhatsappLinked(false);
                      }}>
                        Connect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", whatsappLinked ? "bg-green-500" : "bg-yellow-500")} />
                        <span className="text-sm">{whatsappLinked ? "Linked" : "Waiting for scan"}</span>
                        {whatsappBridgeUnreachable && <Badge variant="destructive" className="text-xs">Unreachable</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={async () => {
                        if (isTauriDesktop()) { try { await invoke("whatsapp_bridge_stop"); } catch { /* ignore */ } }
                        setWhatsappBridgeUrl(null); setWhatsappQrDataUrl(null);
                        setWhatsappLinked(false); setWhatsappBridgeUnreachable(false);
                      }}>
                        Disconnect
                      </Button>
                    </div>
                    {!whatsappLinked && whatsappQrDataUrl && (
                      <div className="flex justify-center">
                        <img src={whatsappQrDataUrl} alt="WhatsApp QR code" className="w-48 h-48 rounded-lg border border-border" />
                      </div>
                    )}
                    {whatsappBridgeUnreachable && (
                      <Button variant="outline" size="sm" onClick={() => { whatsappPollFailuresRef.current = 0; setWhatsappBridgeUnreachable(false); }}>
                        Retry
                      </Button>
                    )}
                  </div>
                )}

                <Separator />
                <SectionTitle>Audit Logs</SectionTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    try { const list = await listBackendAuditLogs(100); setBackendAuditLogs(list); } catch { setBackendAuditLogs([]); }
                  }}>
                    Load logs
                  </Button>
                  {backendAuditLogs.length > 0 && (
                    <Button variant="outline" size="sm" onClick={async () => {
                      try { await clearBackendAuditLogs(); setBackendAuditLogs([]); } catch { /* ignore */ }
                    }}>
                      Clear
                    </Button>
                  )}
                </div>
                {backendAuditLogs.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {backendAuditLogs.map((log) => (
                      <div key={log.id} className="px-3 py-1.5 border-b border-border last:border-0 text-xs font-mono">
                        <span className="text-muted-foreground mr-2">{new Date(log.created_at * 1000).toLocaleTimeString()}</span>
                        <Badge variant={log.level === "error" ? "destructive" : "secondary"} className="text-[10px] mr-2">{log.level}</Badge>
                        {log.event}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />
                <SectionTitle>Danger Zone</SectionTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">Reset all settings</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will restore all settings to defaults. Your chat history will not be affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => setConfig({ ...defaultConfig })}
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
