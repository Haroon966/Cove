#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod config;

use db::{session_create, session_list, session_load, session_delete, session_update_title, session_update_model, message_save, message_update, messages_load, messages_delete_from, search_sessions, export_session_data, export_all_data, import_backup};
use config::{config_load, config_save};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use std::process::Command;

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            session_create,
            session_list,
            session_load,
            session_delete,
            session_update_title,
            session_update_model,
            message_save,
            message_update,
            messages_load,
            messages_delete_from,
            search_sessions,
            export_session_data,
            export_all_data,
            import_backup,
            config_load,
            config_save,
            run_shell_command,
        ])
        .setup(|app| {
            // System tray with Show / Quit
            let show_i = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let quit_i = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).item(&show_i).item(&quit_i).build()?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Cove")
                .on_menu_event(move |app, event| {
                    if event.id().0.as_str() == "show" {
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
