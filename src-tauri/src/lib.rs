#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod config;

use db::{session_create, session_list, session_load, session_delete, session_update_title, session_update_model, artifact_create, artifact_list, artifact_update, artifact_delete, execution_trace_add, execution_trace_list, execution_trace_clear, backend_audit_log_add, backend_audit_log_list, backend_audit_log_clear, message_save, message_update, messages_load, messages_load_branch, message_branch_list, session_set_branch_root, messages_delete_from, search_sessions, export_session_data, export_all_data, import_backup, knowledge_doc_create, knowledge_doc_list, knowledge_doc_delete, knowledge_retrieve, knowledge_session_sources_list, knowledge_session_sources_set};
use config::{config_load, config_save, McpServerConfig};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use tauri::Emitter;
use std::path::{Path, PathBuf};
use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::collections::HashMap;

#[derive(serde::Serialize)]
struct RunShellResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

#[tauri::command]
fn run_shell_command(command: String) -> Result<RunShellResult, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .output()
            .map_err(|e| e.to_string())?
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(&command)
            .output()
            .map_err(|e| e.to_string())?
    };

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let exit_code = output.status.code();

    Ok(RunShellResult {
        stdout,
        stderr,
        exit_code,
    })
}

/// Resolve path relative to agent workspace. Returns error if workspace not set or path escapes.
fn resolve_workspace_path(app: &tauri::AppHandle, path: &str) -> Result<std::path::PathBuf, String> {
    let config = config_load(app.clone())?;
    let workspace = config
        .agent_workspace_path
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "Agent workspace path is not set. Set it in Settings to use file tools.".to_string())?;
    let base = Path::new(workspace).canonicalize().map_err(|e| e.to_string())?;
    let path = path.trim();
    if path.starts_with('/') || path.contains("..") {
        return Err("Path is outside the agent workspace.".to_string());
    }
    let full = base.join(path);
    let normalized = if full.exists() {
        full.canonicalize().map_err(|e| e.to_string())?
    } else {
        let parent = full.parent().ok_or_else(|| "Invalid path.".to_string())?;
        let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
        let file = full.file_name().ok_or_else(|| "Invalid path.".to_string())?;
        canonical_parent.join(file)
    };
    if !normalized.starts_with(&base) {
        return Err("Path is outside the agent workspace.".to_string());
    }
    Ok(normalized)
}

#[tauri::command]
fn agent_read_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let full = resolve_workspace_path(&app, path.trim())?;
    std::fs::read_to_string(&full).map_err(|e| e.to_string())
}

#[tauri::command]
fn agent_write_file(app: tauri::AppHandle, path: String, contents: String) -> Result<(), String> {
    let full = resolve_workspace_path(&app, path.trim())?;
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&full, contents).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ListDirEntry {
    name: String,
    is_dir: bool,
}

#[tauri::command]
fn agent_list_dir(app: tauri::AppHandle, path: String, recursive: Option<bool>) -> Result<Vec<ListDirEntry>, String> {
    let full = resolve_workspace_path(&app, path.trim())?;
    if !full.is_dir() {
        return Err("Not a directory.".to_string());
    }
    let recursive = recursive.unwrap_or(false);
    let mut entries = Vec::new();
    fn collect_entries(dir: &Path, recursive: bool, out: &mut Vec<ListDirEntry>) -> Result<(), String> {
        for e in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
            let e = e.map_err(|e| e.to_string())?;
            let name = e.file_name().to_string_lossy().into_owned();
            let is_dir = e.file_type().map_err(|e| e.to_string())?.is_dir();
            out.push(ListDirEntry { name, is_dir });
            if recursive && is_dir {
                collect_entries(&e.path(), true, out)?;
            }
        }
        Ok(())
    }
    collect_entries(&full, recursive, &mut entries)?;
    Ok(entries)
}

// --- WhatsApp bridge ---

struct WhatsAppBridgeState {
    child: Mutex<Option<Child>>,
}

const BRIDGE_PORT: u16 = 3456;

struct McpRuntimeState {
    children: Mutex<HashMap<String, Child>>,
}

struct DeepLinkState {
    pending: Mutex<Vec<String>>,
}

#[derive(serde::Serialize)]
struct McpServerRuntimeStatus {
    server_id: String,
    transport: String,
    running: bool,
    detail: String,
}

fn split_command_line(command_line: &str) -> Result<(String, Vec<String>), String> {
    let parts = command_line
        .split_whitespace()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    if parts.is_empty() {
        return Err("Empty command line.".to_string());
    }
    Ok((parts[0].clone(), parts[1..].to_vec()))
}

fn get_mcp_server(app: &tauri::AppHandle, server_id: &str) -> Result<McpServerConfig, String> {
    let cfg = config_load(app.clone())?;
    let servers = cfg
        .mcp_servers
        .ok_or_else(|| "No MCP servers configured.".to_string())?;
    servers
        .into_iter()
        .find(|s| s.id == server_id)
        .ok_or_else(|| format!("MCP server '{}' not found.", server_id))
}

#[tauri::command]
fn mcp_server_start(
    app: tauri::AppHandle,
    state: tauri::State<McpRuntimeState>,
    server_id: String,
) -> Result<McpServerRuntimeStatus, String> {
    let server = get_mcp_server(&app, server_id.trim())?;
    if !server.enabled {
        return Err(format!("MCP server '{}' is disabled.", server.id));
    }
    if server.transport == "http" {
        return Ok(McpServerRuntimeStatus {
            server_id: server.id,
            transport: server.transport,
            running: true,
            detail: "HTTP MCP does not require a local process start.".to_string(),
        });
    }
    if server.transport != "stdio" {
        return Err(format!("Unsupported MCP transport: {}", server.transport));
    }
    let mut guard = state.children.lock().map_err(|e| e.to_string())?;
    if guard.contains_key(&server.id) {
        return Ok(McpServerRuntimeStatus {
            server_id: server.id,
            transport: server.transport,
            running: true,
            detail: "Already running.".to_string(),
        });
    }
    let (cmd, args) = split_command_line(&server.endpoint)?;
    let child = Command::new(cmd)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start MCP stdio process: {}", e))?;
    guard.insert(server.id.clone(), child);
    Ok(McpServerRuntimeStatus {
        server_id: server.id,
        transport: server.transport,
        running: true,
        detail: "Started.".to_string(),
    })
}

#[tauri::command]
fn mcp_server_stop(
    state: tauri::State<McpRuntimeState>,
    server_id: String,
) -> Result<McpServerRuntimeStatus, String> {
    let mut guard = state.children.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.remove(server_id.trim()) {
        let _ = child.kill();
        return Ok(McpServerRuntimeStatus {
            server_id,
            transport: "stdio".to_string(),
            running: false,
            detail: "Stopped.".to_string(),
        });
    }
    Ok(McpServerRuntimeStatus {
        server_id,
        transport: "stdio".to_string(),
        running: false,
        detail: "Not running.".to_string(),
    })
}

#[tauri::command]
fn mcp_server_status(
    app: tauri::AppHandle,
    state: tauri::State<McpRuntimeState>,
    server_id: String,
) -> Result<McpServerRuntimeStatus, String> {
    let server = get_mcp_server(&app, server_id.trim())?;
    if server.transport == "http" {
        return Ok(McpServerRuntimeStatus {
            server_id: server.id,
            transport: server.transport,
            running: true,
            detail: "HTTP MCP endpoint configured.".to_string(),
        });
    }
    let guard = state.children.lock().map_err(|e| e.to_string())?;
    let running = guard.contains_key(&server.id);
    Ok(McpServerRuntimeStatus {
        server_id: server.id,
        transport: server.transport,
        running,
        detail: if running { "Running.".to_string() } else { "Stopped.".to_string() },
    })
}

#[tauri::command]
fn mcp_server_test(
    app: tauri::AppHandle,
    server_id: String,
) -> Result<String, String> {
    let server = get_mcp_server(&app, server_id.trim())?;
    if !server.enabled {
        return Err(format!("MCP server '{}' is disabled.", server.id));
    }
    if server.transport == "http" {
        return Ok("HTTP MCP server test should be performed in frontend via fetch health check.".to_string());
    }
    let (cmd, args) = split_command_line(&server.endpoint)?;
    let output = Command::new(cmd)
        .args(args)
        .arg("--help")
        .output()
        .map_err(|e| format!("Failed to execute MCP stdio test: {}", e))?;
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    Ok(format!(
        "exit_code: {:?}\nstdout:\n{}\nstderr:\n{}",
        output.status.code(),
        stdout,
        stderr
    ))
}

#[tauri::command]
fn mcp_dispatch_stdio_tool(
    app: tauri::AppHandle,
    server_id: String,
    tool_name: String,
    arguments_json: String,
) -> Result<String, String> {
    let server = get_mcp_server(&app, server_id.trim())?;
    if !server.enabled {
        return Err(format!("MCP server '{}' is disabled.", server.id));
    }
    if server.transport != "stdio" {
        return Err("mcp_dispatch_stdio_tool only supports stdio transport.".to_string());
    }
    let (cmd, args) = split_command_line(&server.endpoint)?;
    let output = Command::new(cmd)
        .args(args)
        .env("COVE_MCP_TOOL_NAME", tool_name)
        .env("COVE_MCP_TOOL_ARGS_JSON", arguments_json)
        .output()
        .map_err(|e| format!("Failed to dispatch stdio MCP tool: {}", e))?;
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    if !output.status.success() {
        return Err(format!(
            "MCP stdio tool failed (exit {:?}): {}",
            output.status.code(),
            stderr
        ));
    }
    Ok(stdout)
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn whatsapp_bridge_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("whatsapp-ai-config.json"))
}

fn whatsapp_bridge_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let candidates = [
        cwd.join("whatsapp-bridge"),
        cwd.parent().map(|p| p.join("whatsapp-bridge")).unwrap_or_else(|| cwd.join("whatsapp-bridge")),
    ];
    for dir in &candidates {
        if dir.join("index.js").exists() {
            return Ok(dir.clone());
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let d = res.join("whatsapp-bridge");
        if d.join("index.js").exists() {
            return Ok(d);
        }
    }
    Err("WhatsApp bridge not found. Run from the Cove project root or install the bridge.".to_string())
}

#[tauri::command]
fn whatsapp_bridge_config_path_cmd(app: tauri::AppHandle) -> Result<String, String> {
    whatsapp_bridge_config_path(&app).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn whatsapp_write_bridge_config(app: tauri::AppHandle) -> Result<(), String> {
    let config = config_load(app.clone())?;
    let path = whatsapp_bridge_config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct WhatsAppBridgeStartResult {
    url: String,
}

#[tauri::command]
fn whatsapp_bridge_start(
    app: tauri::AppHandle,
    state: tauri::State<WhatsAppBridgeState>,
) -> Result<WhatsAppBridgeStartResult, String> {
    whatsapp_write_bridge_config(app.clone())?;
    let config_path = whatsapp_bridge_config_path(&app)?;
    let session_dir = app_data_dir(&app)?.join("whatsapp-session");
    std::fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;
    let bridge_dir = whatsapp_bridge_dir(&app)?;
    let index_js = bridge_dir.join("index.js");

    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("Bridge already running.".to_string());
    }

    let node = which_node()?;
    let mut cmd = Command::new(node);
    cmd.arg(&index_js)
        .arg(format!("--config={}", config_path.display()))
        .arg(format!("--session-dir={}", session_dir.display()))
        .arg(format!("--port={}", BRIDGE_PORT))
        .current_dir(&bridge_dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null());

    let child = cmd.spawn().map_err(|e| {
        format!("Failed to start bridge (is Node.js installed?): {}", e)
    })?;
    *guard = Some(child);
    Ok(WhatsAppBridgeStartResult {
        url: format!("http://127.0.0.1:{}", BRIDGE_PORT),
    })
}

fn which_node() -> Result<String, String> {
    Ok("node".to_string())
}

fn extract_deep_links(args: &[String]) -> Vec<String> {
    args.iter()
        .filter(|a| a.starts_with("cove://"))
        .cloned()
        .collect()
}

#[tauri::command]
fn deep_link_consume_pending(state: tauri::State<DeepLinkState>) -> Result<Vec<String>, String> {
    let mut guard = state.pending.lock().map_err(|e| e.to_string())?;
    let out = guard.clone();
    guard.clear();
    Ok(out)
}

#[tauri::command]
fn deep_link_emit(app: tauri::AppHandle, state: tauri::State<DeepLinkState>, url: String) -> Result<(), String> {
    {
        let mut guard = state.pending.lock().map_err(|e| e.to_string())?;
        guard.push(url.clone());
    }
    app.emit("cove://deep-link", url).map_err(|e| e.to_string())
}

#[tauri::command]
fn whatsapp_bridge_stop(state: tauri::State<WhatsAppBridgeState>) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
    Ok(())
}

pub fn run() {
    let startup_args: Vec<String> = std::env::args().collect();
    let initial_deep_links = extract_deep_links(&startup_args);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let deep_links = extract_deep_links(&argv);
            if deep_links.is_empty() {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
                return;
            }
            if let Some(state) = app.try_state::<DeepLinkState>() {
                if let Ok(mut guard) = state.pending.lock() {
                    for link in &deep_links {
                        guard.push(link.clone());
                    }
                }
            }
            for link in deep_links {
                let _ = app.emit("cove://deep-link", link);
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(WhatsAppBridgeState {
            child: Mutex::new(None),
        })
        .manage(McpRuntimeState {
            children: Mutex::new(HashMap::new()),
        })
        .manage(DeepLinkState {
            pending: Mutex::new(initial_deep_links),
        })
        .invoke_handler(tauri::generate_handler![
            session_create,
            session_list,
            session_load,
            session_delete,
            session_update_title,
            session_update_model,
            artifact_create,
            artifact_list,
            artifact_update,
            artifact_delete,
            execution_trace_add,
            execution_trace_list,
            execution_trace_clear,
            backend_audit_log_add,
            backend_audit_log_list,
            backend_audit_log_clear,
            message_save,
            message_update,
            messages_load,
            messages_load_branch,
            message_branch_list,
            session_set_branch_root,
            messages_delete_from,
            search_sessions,
            export_session_data,
            export_all_data,
            import_backup,
            knowledge_doc_create,
            knowledge_doc_list,
            knowledge_doc_delete,
            knowledge_retrieve,
            knowledge_session_sources_list,
            knowledge_session_sources_set,
            config_load,
            config_save,
            run_shell_command,
            agent_read_file,
            agent_write_file,
            agent_list_dir,
            whatsapp_bridge_config_path_cmd,
            whatsapp_write_bridge_config,
            whatsapp_bridge_start,
            whatsapp_bridge_stop,
            mcp_server_start,
            mcp_server_stop,
            mcp_server_status,
            mcp_server_test,
            mcp_dispatch_stdio_tool,
            deep_link_consume_pending,
            deep_link_emit,
        ])
        .setup(|app| {
            // System tray with Show / Quit
            let show_i = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let chat_i = MenuItemBuilder::with_id("open_chat", "Open Chat").build(app)?;
            let agents_i = MenuItemBuilder::with_id("open_agents", "Open Agents").build(app)?;
            let knowledge_i = MenuItemBuilder::with_id("open_knowledge", "Open Knowledge").build(app)?;
            let discover_i = MenuItemBuilder::with_id("open_discover", "Open Discover").build(app)?;
            let quit_i = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_i)
                .item(&chat_i)
                .item(&agents_i)
                .item(&knowledge_i)
                .item(&discover_i)
                .item(&quit_i)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Cove")
                .on_menu_event(move |app, event| {
                    if event.id().0.as_str() == "show" {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if event.id().0.as_str() == "open_chat" {
                        let _ = app.emit("cove://deep-link", "cove://chat");
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if event.id().0.as_str() == "open_agents" {
                        let _ = app.emit("cove://deep-link", "cove://agents");
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if event.id().0.as_str() == "open_knowledge" {
                        let _ = app.emit("cove://deep-link", "cove://knowledge");
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if event.id().0.as_str() == "open_discover" {
                        let _ = app.emit("cove://deep-link", "cove://discover");
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if event.id().0.as_str() == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
