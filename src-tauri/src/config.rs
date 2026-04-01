use crate::db::init_db;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub id: String,
    pub label: String,
    pub transport: String,
    pub endpoint: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPolicyConfig {
    pub role: String,
    pub mode: String,
    #[serde(default)]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub denied_tools: Option<Vec<String>>,
    #[serde(default)]
    pub require_confirmation_for: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTemplateConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProfileConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub system_prompt: String,
    #[serde(default)]
    pub preferred_model: Option<String>,
    #[serde(default)]
    pub preferred_backend: Option<String>,
    #[serde(default)]
    pub tools_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentGroupConfig {
    pub id: String,
    pub name: String,
    pub member_profile_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub root_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledTaskConfig {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub interval_minutes: i64,
    pub enabled: bool,
    #[serde(default)]
    pub next_run_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeTokensConfig {
    #[serde(default)]
    pub surface_bg: Option<String>,
    #[serde(default)]
    pub panel_bg: Option<String>,
    #[serde(default)]
    pub text_primary: Option<String>,
    #[serde(default)]
    pub text_muted: Option<String>,
    #[serde(default)]
    pub border: Option<String>,
    #[serde(default)]
    pub radius_scale: Option<String>,
    #[serde(default)]
    pub density: Option<String>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("cove.db"))
}

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub backend_type: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    /// Named API keys per provider: openai, gemini, groq, etc.
    #[serde(default)]
    pub api_keys: Option<HashMap<String, String>>,
    pub system_prompt: Option<String>,
    pub theme: Option<String>,
    pub primary_color: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    /// Optional workspace root for agent file tools (read_file, write_file, list_dir). Empty = disabled.
    pub agent_workspace_path: Option<String>,
    /// Open WebUI API path prefix, usually "/api".
    pub openwebui_api_path: Option<String>,
    /// Enable tool-use flows by default when Open WebUI backend is selected.
    pub openwebui_enable_tools: Option<bool>,
    /// Enable retrieval-style context for Open WebUI flows.
    pub openwebui_enable_rag: Option<bool>,
    /// Optional workspace label to route Open WebUI conversations.
    pub openwebui_workspace: Option<String>,
    /// Feature flags used to rollout larger integrations safely.
    #[serde(default)]
    pub feature_flags: Option<HashMap<String, bool>>,
    /// Runtime profile for local-first execution.
    pub runtime_profile: Option<String>,
    /// Knowledge index mode.
    pub knowledge_index_mode: Option<String>,
    /// Configured MCP servers.
    #[serde(default)]
    pub mcp_servers: Option<Vec<McpServerConfig>>,
    /// Tool policy controls for agent runtime.
    #[serde(default)]
    pub tool_policy: Option<ToolPolicyConfig>,
    /// Enabled built-in skills.
    #[serde(default)]
    pub enabled_skills: Option<Vec<String>>,
    /// Whether to auto-recommend skills from user prompts.
    #[serde(default)]
    pub skill_auto_recommend: Option<bool>,
    /// Per-skill trust mode for auto recommendations.
    #[serde(default)]
    pub skill_trust_modes: Option<HashMap<String, String>>,
    /// Installed local agent templates.
    #[serde(default)]
    pub agent_templates: Option<Vec<AgentTemplateConfig>>,
    /// User-defined agent profiles.
    #[serde(default)]
    pub agent_profiles: Option<Vec<AgentProfileConfig>>,
    /// Currently selected agent profile id.
    #[serde(default)]
    pub active_agent_profile_id: Option<String>,
    /// Agent groups for multi-agent orchestration.
    #[serde(default)]
    pub agent_groups: Option<Vec<AgentGroupConfig>>,
    /// Active agent group id.
    #[serde(default)]
    pub active_agent_group_id: Option<String>,
    /// Workspace definitions for project organization.
    #[serde(default)]
    pub workspaces: Option<Vec<WorkspaceConfig>>,
    /// Active workspace id.
    #[serde(default)]
    pub active_workspace_id: Option<String>,
    /// Scheduled background tasks.
    #[serde(default)]
    pub scheduled_tasks: Option<Vec<ScheduledTaskConfig>>,
    /// Advanced theme token overrides.
    #[serde(default)]
    pub theme_tokens: Option<ThemeTokensConfig>,
    /// Browser-only shell command bridge settings (used outside Tauri).
    #[serde(default)]
    pub browser_command_bridge_enabled: Option<bool>,
    #[serde(default)]
    pub browser_command_bridge_url: Option<String>,
    #[serde(default)]
    pub browser_command_bridge_token: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            backend_type: Some("ollama".to_string()),
            base_url: Some("http://localhost:11434".to_string()),
            model: Some("llama2".to_string()),
            api_key: None,
            api_keys: None,
            system_prompt: None,
            theme: None,
            primary_color: None,
            temperature: None,
            max_tokens: None,
            agent_workspace_path: None,
            openwebui_api_path: Some("/api".to_string()),
            openwebui_enable_tools: Some(true),
            openwebui_enable_rag: Some(false),
            openwebui_workspace: None,
            feature_flags: None,
            runtime_profile: Some("default".to_string()),
            knowledge_index_mode: Some("sqlite_fts".to_string()),
            mcp_servers: Some(Vec::new()),
            tool_policy: Some(ToolPolicyConfig {
                role: "owner".to_string(),
                mode: "confirm_all".to_string(),
                allowed_tools: None,
                denied_tools: None,
                require_confirmation_for: Some(vec!["run_shell_command".to_string()]),
            }),
            enabled_skills: Some(Vec::new()),
            skill_auto_recommend: Some(true),
            skill_trust_modes: Some(HashMap::new()),
            agent_templates: Some(Vec::new()),
            agent_profiles: Some(Vec::new()),
            active_agent_profile_id: None,
            agent_groups: Some(Vec::new()),
            active_agent_group_id: None,
            workspaces: Some(Vec::new()),
            active_workspace_id: None,
            scheduled_tasks: Some(Vec::new()),
            theme_tokens: None,
            browser_command_bridge_enabled: Some(false),
            browser_command_bridge_url: Some("http://127.0.0.1:4317".to_string()),
            browser_command_bridge_token: None,
        }
    }
}

struct ConfigRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ConfigRepository<'a> {
    const GLOBAL_KEY: &'static str = "global";

    fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    fn log_event(&self, level: &str, event: &str, payload: serde_json::Value) -> Result<(), String> {
        let now = now_unix_secs();
        self.conn
            .execute(
                "INSERT INTO backend_audit_logs (level, event, payload, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![level, event, payload.to_string(), now],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn load_from_db(&self) -> Result<Option<String>, String> {
        self.conn
            .query_row(
                "SELECT value FROM app_config WHERE key = ?1",
                params![Self::GLOBAL_KEY],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| e.to_string())
    }

    fn save_to_db(&self, config: &AppConfig) -> Result<(), String> {
        let now = now_unix_secs();
        let serialized = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "INSERT INTO app_config (key, value, updated_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![Self::GLOBAL_KEY, serialized, now],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn migrate_legacy_config_if_needed(&self, legacy_path: &PathBuf) -> Result<AppConfig, String> {
        if !legacy_path.exists() {
            let cfg = AppConfig::default();
            self.save_to_db(&cfg)?;
            self.log_event(
                "info",
                "config_migration_skipped_no_legacy_file",
                json!({ "source": legacy_path }),
            )?;
            return Ok(cfg);
        }

        let raw = fs::read_to_string(legacy_path).map_err(|e| e.to_string())?;
        match serde_json::from_str::<AppConfig>(&raw) {
            Ok(cfg) => {
                self.save_to_db(&cfg)?;
                self.log_event(
                    "info",
                    "config_migrated_from_json_to_sqlite",
                    json!({ "source": legacy_path }),
                )?;
                Ok(cfg)
            }
            Err(_) => {
                // Repair path: fall back to defaults and persist a known good config row.
                let cfg = AppConfig::default();
                self.save_to_db(&cfg)?;
                self.log_event(
                    "warn",
                    "config_migration_failed_invalid_json_repaired_with_defaults",
                    json!({ "source": legacy_path }),
                )?;
                Ok(cfg)
            }
        }
    }

    fn load(&self, legacy_path: &PathBuf) -> Result<AppConfig, String> {
        let db_value = self.load_from_db()?;
        if let Some(raw) = db_value {
            match serde_json::from_str::<AppConfig>(&raw) {
                Ok(cfg) => Ok(cfg),
                Err(_) => {
                    // Recovery path for corrupted DB row.
                    let cfg = AppConfig::default();
                    self.save_to_db(&cfg)?;
                    self.log_event(
                        "error",
                        "config_db_row_invalid_repaired_with_defaults",
                        json!({ "key": Self::GLOBAL_KEY }),
                    )?;
                    Ok(cfg)
                }
            }
        } else {
            self.migrate_legacy_config_if_needed(legacy_path)
        }
    }
}

fn with_config_repo<F, T>(app: &AppHandle, f: F) -> Result<T, String>
where
    F: FnOnce(ConfigRepository<'_>, PathBuf) -> Result<T, String>,
{
    let path = db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    init_db(&conn)?;
    let repo = ConfigRepository::new(&conn);
    let legacy_config_path = config_path(app)?;
    f(repo, legacy_config_path)
}

#[tauri::command]
pub fn config_load(app: AppHandle) -> Result<AppConfig, String> {
    with_config_repo(&app, |repo, legacy| repo.load(&legacy))
}

#[tauri::command]
pub fn config_save(app: AppHandle, config: AppConfig) -> Result<(), String> {
    with_config_repo(&app, |repo, _legacy| {
        repo.save_to_db(&config)?;
        Ok(())
    })
}
