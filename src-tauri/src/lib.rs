#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod config;

use db::{init_db, session_create, session_list, session_load, session_delete, session_update_title, message_save, messages_load, search_sessions};
use config::{config_load, config_save};

fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            session_create,
            session_list,
            session_load,
            session_delete,
            session_update_title,
            message_save,
            messages_load,
            search_sessions,
            config_load,
            config_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
