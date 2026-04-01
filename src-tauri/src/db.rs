use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::config::{AppConfig, config_load, config_save};

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("cove.db"))
}

fn with_connection<F, T>(app: &AppHandle, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
{
    let path = db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    init_db(&conn)?;
    f(&conn).map_err(|e| e.to_string())
}

pub fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT 'New chat',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            model TEXT,
            backend_type TEXT,
            openwebui_workspace_id TEXT,
            openwebui_thread_id TEXT,
            branch_root_message_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            parent_message_id INTEGER,
            branch_id TEXT,
            event_type TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_messages_branch ON messages(branch_id);

        CREATE TABLE IF NOT EXISTS artifacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            message_id INTEGER,
            artifact_type TEXT NOT NULL,
            title TEXT,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);

        CREATE TABLE IF NOT EXISTS execution_traces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            message_id INTEGER,
            trace_type TEXT NOT NULL,
            trace_payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_execution_traces_session ON execution_traces(session_id);

        CREATE TABLE IF NOT EXISTS backend_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            event TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_backend_audit_logs_created ON backend_audit_logs(created_at);

        CREATE TABLE IF NOT EXISTS knowledge_docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            source_path TEXT,
            mime_type TEXT,
            content TEXT NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            token_estimate INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id, chunk_index);
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(content, content='knowledge_chunks', content_rowid='id');
        CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ai AFTER INSERT ON knowledge_chunks BEGIN
            INSERT INTO knowledge_chunks_fts(rowid, content) VALUES (NEW.id, NEW.content);
        END;
        CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ad AFTER DELETE ON knowledge_chunks BEGIN
            INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, content) VALUES('delete', OLD.id, OLD.content);
        END;
        CREATE TRIGGER IF NOT EXISTS knowledge_chunks_au AFTER UPDATE ON knowledge_chunks BEGIN
            INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, content) VALUES('delete', OLD.id, OLD.content);
            INSERT INTO knowledge_chunks_fts(rowid, content) VALUES (NEW.id, NEW.content);
        END;
        CREATE TABLE IF NOT EXISTS session_knowledge_links (
            session_id INTEGER NOT NULL,
            knowledge_doc_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (session_id, knowledge_doc_id),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (knowledge_doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_session_knowledge_session ON session_knowledge_links(session_id);

        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_app_config_updated_at ON app_config(updated_at);

        CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(title, content);

        CREATE TRIGGER IF NOT EXISTS sessions_fts_after_insert AFTER INSERT ON sessions BEGIN
            INSERT INTO sessions_fts(rowid, title, content) VALUES (NEW.id, NEW.title, '');
        END;
        CREATE TRIGGER IF NOT EXISTS sessions_fts_after_delete AFTER DELETE ON sessions BEGIN
            DELETE FROM sessions_fts WHERE rowid = OLD.id;
        END;
        CREATE TRIGGER IF NOT EXISTS sessions_after_update_title AFTER UPDATE OF title ON sessions BEGIN
            INSERT OR REPLACE INTO sessions_fts(rowid, title, content) SELECT s.id, s.title, COALESCE((SELECT group_concat(m.content, ' ') FROM messages m WHERE m.session_id = s.id), '') FROM sessions s WHERE s.id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS sessions_fts_msg_after_insert AFTER INSERT ON messages BEGIN
            INSERT OR REPLACE INTO sessions_fts(rowid, title, content) SELECT s.id, s.title, (SELECT group_concat(m.content, ' ') FROM messages m WHERE m.session_id = s.id) FROM sessions s WHERE s.id = NEW.session_id;
        END;
        CREATE TRIGGER IF NOT EXISTS sessions_fts_msg_after_delete AFTER DELETE ON messages BEGIN
            INSERT OR REPLACE INTO sessions_fts(rowid, title, content) SELECT s.id, s.title, COALESCE((SELECT group_concat(m.content, ' ') FROM messages m WHERE m.session_id = s.id), '') FROM sessions s WHERE s.id = OLD.session_id;
        END;
        CREATE TRIGGER IF NOT EXISTS sessions_fts_msg_after_update AFTER UPDATE ON messages BEGIN
            INSERT OR REPLACE INTO sessions_fts(rowid, title, content) SELECT s.id, s.title, (SELECT group_concat(m.content, ' ') FROM messages m WHERE m.session_id = s.id) FROM sessions s WHERE s.id = NEW.session_id;
        END;
        "#,
    )
    .map_err(|e| e.to_string())?;

    // Backfill FTS for existing sessions (no trigger ran for them)
    conn.execute_batch(
        r#"
        INSERT OR IGNORE INTO sessions_fts(rowid, title, content) SELECT s.id, s.title, COALESCE((SELECT group_concat(m.content, ' ') FROM messages m WHERE m.session_id = s.id), '') FROM sessions s WHERE s.id NOT IN (SELECT rowid FROM sessions_fts);
        "#,
    )
    .map_err(|e| e.to_string())?;

    // Agent: add columns for tool messages and assistant tool_calls (idempotent)
    let _ = conn.execute("ALTER TABLE messages ADD COLUMN tool_call_id TEXT", []);
    let _ = conn.execute("ALTER TABLE messages ADD COLUMN tool_name TEXT", []);
    let _ = conn.execute("ALTER TABLE messages ADD COLUMN tool_calls TEXT", []);
    // Open WebUI metadata on sessions (idempotent).
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN openwebui_workspace_id TEXT", []);
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN openwebui_thread_id TEXT", []);
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN branch_root_message_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE messages ADD COLUMN parent_message_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE messages ADD COLUMN branch_id TEXT", []);
    let _ = conn.execute("ALTER TABLE messages ADD COLUMN event_type TEXT", []);

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: i64,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub model: Option<String>,
    pub backend_type: Option<String>,
    pub openwebui_workspace_id: Option<String>,
    pub openwebui_thread_id: Option<String>,
    pub branch_root_message_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub session_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: i64,
    pub parent_message_id: Option<i64>,
    pub branch_id: Option<String>,
    pub event_type: Option<String>,
    pub tool_call_id: Option<String>,
    pub tool_name: Option<String>,
    pub tool_calls: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Artifact {
    pub id: i64,
    pub session_id: i64,
    pub message_id: Option<i64>,
    pub artifact_type: String,
    pub title: Option<String>,
    pub payload: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageBranchInfo {
    pub branch_id: Option<String>,
    pub message_count: i64,
    pub first_created_at: i64,
    pub last_created_at: i64,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionTrace {
    pub id: i64,
    pub session_id: i64,
    pub message_id: Option<i64>,
    pub trace_type: String,
    pub trace_payload: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendAuditLog {
    pub id: i64,
    pub level: String,
    pub event: String,
    pub payload: String,
    pub created_at: i64,
}

#[tauri::command]
pub fn session_create(app: AppHandle, title: Option<String>) -> Result<i64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let title = title.unwrap_or_else(|| "New chat".to_string());
    with_connection(&app, |conn| {
        conn.execute(
            "INSERT INTO sessions (title, created_at, updated_at) VALUES (?1, ?2, ?3)",
            params![title, now, now],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

#[tauri::command]
pub fn session_list(app: AppHandle) -> Result<Vec<Session>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, created_at, updated_at, model, backend_type, openwebui_workspace_id, openwebui_thread_id, branch_root_message_id FROM sessions ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Session {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                backend_type: row.get(5)?,
                openwebui_workspace_id: row.get(6)?,
                openwebui_thread_id: row.get(7)?,
                branch_root_message_id: row.get(8)?,
            })
        })?;
        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(row?);
        }
        Ok(sessions)
    })
}

#[tauri::command]
pub fn session_load(app: AppHandle, session_id: i64) -> Result<Option<Session>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, created_at, updated_at, model, backend_type, openwebui_workspace_id, openwebui_thread_id, branch_root_message_id FROM sessions WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![session_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Session {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                backend_type: row.get(5)?,
                openwebui_workspace_id: row.get(6)?,
                openwebui_thread_id: row.get(7)?,
                branch_root_message_id: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    })
}

#[tauri::command]
pub fn session_delete(app: AppHandle, session_id: i64) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute("DELETE FROM messages WHERE session_id = ?1", params![session_id])?;
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn session_update_title(app: AppHandle, session_id: i64, title: String) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, session_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn session_update_model(
    app: AppHandle,
    session_id: i64,
    model: Option<String>,
    backend_type: Option<String>,
) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute(
            "UPDATE sessions SET model = ?1, backend_type = ?2 WHERE id = ?3",
            params![model, backend_type, session_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn artifact_create(
    app: AppHandle,
    session_id: i64,
    message_id: Option<i64>,
    artifact_type: String,
    title: Option<String>,
    payload: String,
) -> Result<i64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "INSERT INTO artifacts (session_id, message_id, artifact_type, title, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![session_id, message_id, artifact_type, title, payload, now],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

#[tauri::command]
pub fn artifact_list(app: AppHandle, session_id: i64) -> Result<Vec<Artifact>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, message_id, artifact_type, title, payload, created_at FROM artifacts WHERE session_id = ?1 ORDER BY created_at DESC, id DESC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(Artifact {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                artifact_type: row.get(3)?,
                title: row.get(4)?,
                payload: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn artifact_update(
    app: AppHandle,
    artifact_id: i64,
    title: Option<String>,
    payload: Option<String>,
) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute(
            "UPDATE artifacts SET title = COALESCE(?1, title), payload = COALESCE(?2, payload) WHERE id = ?3",
            params![title, payload, artifact_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn artifact_delete(app: AppHandle, artifact_id: i64) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute("DELETE FROM artifacts WHERE id = ?1", params![artifact_id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn execution_trace_add(
    app: AppHandle,
    session_id: i64,
    message_id: Option<i64>,
    trace_type: String,
    trace_payload: String,
) -> Result<i64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "INSERT INTO execution_traces (session_id, message_id, trace_type, trace_payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![session_id, message_id, trace_type, trace_payload, now],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

#[tauri::command]
pub fn execution_trace_list(app: AppHandle, session_id: i64) -> Result<Vec<ExecutionTrace>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, message_id, trace_type, trace_payload, created_at FROM execution_traces WHERE session_id = ?1 ORDER BY created_at ASC, id ASC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(ExecutionTrace {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                trace_type: row.get(3)?,
                trace_payload: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn execution_trace_clear(app: AppHandle, session_id: i64) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute(
            "DELETE FROM execution_traces WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn backend_audit_log_add(
    app: AppHandle,
    level: String,
    event: String,
    payload: String,
) -> Result<i64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "INSERT INTO backend_audit_logs (level, event, payload, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![level, event, payload, now],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

#[tauri::command]
pub fn backend_audit_log_list(app: AppHandle, limit: Option<i64>) -> Result<Vec<BackendAuditLog>, String> {
    let lim = limit.unwrap_or(200).clamp(1, 2000);
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, level, event, payload, created_at FROM backend_audit_logs ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![lim], |row| {
            Ok(BackendAuditLog {
                id: row.get(0)?,
                level: row.get(1)?,
                event: row.get(2)?,
                payload: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn backend_audit_log_clear(app: AppHandle) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute("DELETE FROM backend_audit_logs", [])?;
        Ok(())
    })
}

/// Delete all messages in the session with id >= from_message_id.
#[tauri::command]
pub fn messages_delete_from(app: AppHandle, session_id: i64, from_message_id: i64) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute(
            "DELETE FROM messages WHERE session_id = ?1 AND id >= ?2",
            params![session_id, from_message_id],
        )?;
        Ok(())
    })
}

/// Update a message's content (e.g. when user edits their message).
#[tauri::command]
pub fn message_update(
    app: AppHandle,
    session_id: i64,
    message_id: i64,
    content: String,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
            params![now, session_id],
        )?;
        conn.execute(
            "UPDATE messages SET content = ?1 WHERE id = ?2 AND session_id = ?3",
            params![content, message_id, session_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn message_save(
    app: AppHandle,
    session_id: i64,
    role: String,
    content: String,
    tool_call_id: Option<String>,
    tool_name: Option<String>,
    tool_calls: Option<String>,
    parent_message_id: Option<i64>,
    branch_id: Option<String>,
    event_type: Option<String>,
) -> Result<i64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
            params![now, session_id],
        )?;
        conn.execute(
            "INSERT INTO messages (session_id, role, content, created_at, tool_call_id, tool_name, tool_calls, parent_message_id, branch_id, event_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![session_id, role, content, now, tool_call_id, tool_name, tool_calls, parent_message_id, branch_id, event_type],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

#[tauri::command]
pub fn messages_load(app: AppHandle, session_id: i64) -> Result<Vec<Message>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, created_at, parent_message_id, branch_id, event_type, tool_call_id, tool_name, tool_calls FROM messages WHERE session_id = ?1 ORDER BY created_at ASC, id ASC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                parent_message_id: row.get(5)?,
                branch_id: row.get(6)?,
                event_type: row.get(7)?,
                tool_call_id: row.get(8)?,
                tool_name: row.get(9)?,
                tool_calls: row.get(10)?,
            })
        })?;
        let mut messages = Vec::new();
        for row in rows {
            messages.push(row?);
        }
        Ok(messages)
    })
}

#[tauri::command]
pub fn messages_load_branch(
    app: AppHandle,
    session_id: i64,
    branch_id: Option<String>,
) -> Result<Vec<Message>, String> {
    let branch = branch_id.unwrap_or_default();
    with_connection(&app, |conn| {
        let mut stmt = if branch.is_empty() {
            conn.prepare(
                "SELECT id, session_id, role, content, created_at, parent_message_id, branch_id, event_type, tool_call_id, tool_name, tool_calls FROM messages WHERE session_id = ?1 AND (branch_id IS NULL OR branch_id = '') ORDER BY created_at ASC, id ASC",
            )?
        } else {
            conn.prepare(
                "SELECT id, session_id, role, content, created_at, parent_message_id, branch_id, event_type, tool_call_id, tool_name, tool_calls FROM messages WHERE session_id = ?1 AND (branch_id = ?2 OR branch_id IS NULL OR branch_id = '') ORDER BY created_at ASC, id ASC",
            )?
        };
        let mut out = Vec::new();
        if branch.is_empty() {
            let rows = stmt.query_map(params![session_id], |row| {
                Ok(Message {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    parent_message_id: row.get(5)?,
                    branch_id: row.get(6)?,
                    event_type: row.get(7)?,
                    tool_call_id: row.get(8)?,
                    tool_name: row.get(9)?,
                    tool_calls: row.get(10)?,
                })
            })?;
            for row in rows {
                out.push(row?);
            }
        } else {
            let rows = stmt.query_map(params![session_id, branch], |row| {
                Ok(Message {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    parent_message_id: row.get(5)?,
                    branch_id: row.get(6)?,
                    event_type: row.get(7)?,
                    tool_call_id: row.get(8)?,
                    tool_name: row.get(9)?,
                    tool_calls: row.get(10)?,
                })
            })?;
            for row in rows {
                out.push(row?);
            }
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn message_branch_list(app: AppHandle, session_id: i64) -> Result<Vec<MessageBranchInfo>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT
                NULLIF(COALESCE(m.branch_id, ''), '') AS branch_id,
                COUNT(*) AS message_count,
                MIN(m.created_at) AS first_created_at,
                MAX(m.created_at) AS last_created_at,
                COALESCE((
                  SELECT sm.content
                  FROM messages sm
                  WHERE sm.session_id = ?1
                    AND COALESCE(sm.branch_id, '') = COALESCE(m.branch_id, '')
                  ORDER BY sm.created_at ASC, sm.id ASC
                  LIMIT 1
                ), '') AS preview
            FROM messages m
            WHERE m.session_id = ?1
            GROUP BY COALESCE(m.branch_id, '')
            ORDER BY last_created_at DESC
            "#,
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(MessageBranchInfo {
                branch_id: row.get(0)?,
                message_count: row.get(1)?,
                first_created_at: row.get(2)?,
                last_created_at: row.get(3)?,
                preview: row.get(4)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn session_set_branch_root(
    app: AppHandle,
    session_id: i64,
    branch_root_message_id: Option<i64>,
) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute(
            "UPDATE sessions SET branch_root_message_id = ?1 WHERE id = ?2",
            params![branch_root_message_id, session_id],
        )?;
        Ok(())
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub session_id: i64,
    pub title: String,
    pub snippet: String,
}

/// Escape FTS5 query: wrap each token in double quotes and escape internal quotes.
fn fts5_escape_query(q: &str) -> String {
    q.split_whitespace()
        .map(|w| format!("\"{}\"", w.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Full-text search: sessions matching query in title or in any message content.
/// Uses FTS5 when available for faster search; falls back to LIKE.
#[tauri::command]
pub fn search_sessions(app: AppHandle, query: String) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    with_connection(&app, |conn| {
        let fts_query = fts5_escape_query(q);
        let use_fts = !fts_query.is_empty();

        if use_fts {
            // FTS5: match and snippet from content column (column index 2, 1-based in snippet)
            let sql = r#"
                SELECT s.id, s.title,
                    COALESCE(
                        nullif(trim(snippet(sessions_fts, 1, '', '', '...', 32)), ''),
                        s.title
                    ) AS snippet
                FROM sessions_fts
                JOIN sessions s ON s.id = sessions_fts.rowid
                WHERE sessions_fts MATCH ?1
                ORDER BY s.updated_at DESC
            "#;
            if let Ok(mut stmt) = conn.prepare(sql) {
                if let Ok(rows) = stmt.query_map(params![&fts_query], |row| {
                    Ok(SearchResult {
                        session_id: row.get(0)?,
                        title: row.get(1)?,
                        snippet: row.get(2)?,
                    })
                }) {
                    let mut results = Vec::new();
                    for row in rows {
                        results.push(row?);
                    }
                    return Ok(results);
                }
            }
        }

        // Fallback: LIKE search
        let sql = r#"
            SELECT s.id, s.title,
                COALESCE(
                    (SELECT substr(m.content, 1, 120) FROM messages m
                     WHERE m.session_id = s.id AND m.content LIKE '%' || ?1 || '%'
                     ORDER BY m.created_at ASC LIMIT 1),
                    s.title
                ) AS snippet
            FROM sessions s
            WHERE s.title LIKE '%' || ?1 || '%'
               OR s.id IN (SELECT session_id FROM messages WHERE content LIKE '%' || ?1 || '%')
            ORDER BY s.updated_at DESC
        "#;
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params![q, q, q], |row| {
            Ok(SearchResult {
                session_id: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
            })
        })?;
        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionWithMessages {
    pub session: Session,
    pub messages: Vec<Message>,
}

/// Export a session as JSON or Markdown string for saving to file.
#[tauri::command]
pub fn export_session_data(app: AppHandle, session_id: i64, format: String) -> Result<String, String> {
    let session = session_load(app.clone(), session_id)?
        .ok_or_else(|| "Session not found".to_string())?;
    let messages = messages_load(app, session_id)?;

    match format.as_str() {
        "json" => {
            let out = SessionWithMessages { session, messages };
            serde_json::to_string_pretty(&out).map_err(|e| e.to_string())
        }
        "markdown" => {
            let mut md = format!("# {}\n\n", session.title);
            for m in &messages {
                let label = if m.role == "user" { "**You**" } else { "**Assistant**" };
                md.push_str(&format!("{}:\n\n{}\n\n", label, m.content));
            }
            Ok(md)
        }
        _ => Err("format must be 'json' or 'markdown'".to_string()),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FullBackup {
    pub sessions: Vec<Session>,
    pub messages: Vec<Message>,
    #[serde(default)]
    pub config: Option<AppConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeDoc {
    pub id: i64,
    pub title: String,
    pub source_path: Option<String>,
    pub mime_type: Option<String>,
    pub content: String,
    pub chunk_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeSnippet {
    pub doc_id: i64,
    pub doc_title: String,
    pub chunk_index: i64,
    pub snippet: String,
    pub score: f64,
}

fn split_knowledge_chunks(content: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    if content.trim().is_empty() {
        return chunks;
    }
    let chars = content.chars().collect::<Vec<_>>();
    let mut start = 0usize;
    let n = chars.len();
    while start < n {
        let end = std::cmp::min(start + chunk_size, n);
        let chunk = chars[start..end].iter().collect::<String>().trim().to_string();
        if !chunk.is_empty() {
            chunks.push(chunk);
        }
        if end == n {
            break;
        }
        start = end.saturating_sub(overlap);
    }
    chunks
}

fn reindex_knowledge_doc(conn: &Connection, doc_id: i64, content: &str) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "DELETE FROM knowledge_chunks WHERE doc_id = ?1",
        params![doc_id],
    )?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let chunks = split_knowledge_chunks(content, 1200, 200);
    for (idx, chunk) in chunks.iter().enumerate() {
        let token_estimate = (chunk.chars().count() / 4) as i64;
        conn.execute(
            "INSERT INTO knowledge_chunks (doc_id, chunk_index, content, token_estimate, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![doc_id, idx as i64, chunk, token_estimate, now],
        )?;
    }
    Ok(chunks.len() as i64)
}

#[tauri::command]
pub fn knowledge_doc_create(
    app: AppHandle,
    title: String,
    source_path: Option<String>,
    mime_type: Option<String>,
    content: String,
    chunk_count: Option<i64>,
) -> Result<i64, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        conn.execute(
            "INSERT INTO knowledge_docs (title, source_path, mime_type, content, chunk_count, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![title, source_path, mime_type, content, chunk_count.unwrap_or(0), now, now],
        )?;
        let doc_id = conn.last_insert_rowid();
        let computed_chunks = reindex_knowledge_doc(conn, doc_id, &content)?;
        conn.execute(
            "UPDATE knowledge_docs SET chunk_count = ?1, updated_at = ?2 WHERE id = ?3",
            params![computed_chunks, now, doc_id],
        )?;
        Ok(doc_id)
    })
}

#[tauri::command]
pub fn knowledge_doc_list(app: AppHandle) -> Result<Vec<KnowledgeDoc>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, source_path, mime_type, content, chunk_count, created_at, updated_at FROM knowledge_docs ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(KnowledgeDoc {
                id: row.get(0)?,
                title: row.get(1)?,
                source_path: row.get(2)?,
                mime_type: row.get(3)?,
                content: row.get(4)?,
                chunk_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn knowledge_doc_delete(app: AppHandle, doc_id: i64) -> Result<(), String> {
    with_connection(&app, |conn| {
        conn.execute("DELETE FROM knowledge_docs WHERE id = ?1", params![doc_id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn knowledge_retrieve(
    app: AppHandle,
    query: String,
    limit: Option<i64>,
    session_id: Option<i64>,
) -> Result<Vec<KnowledgeSnippet>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let lim = limit.unwrap_or(6).clamp(1, 20);
    let fts_query = fts5_escape_query(q);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT
                kd.id,
                kd.title,
                kc.chunk_index,
                snippet(knowledge_chunks_fts, 0, '[', ']', ' ... ', 24) AS snippet,
                bm25(knowledge_chunks_fts) AS score
            FROM knowledge_chunks_fts
            JOIN knowledge_chunks kc ON kc.id = knowledge_chunks_fts.rowid
            JOIN knowledge_docs kd ON kd.id = kc.doc_id
            WHERE knowledge_chunks_fts MATCH ?1
              AND (
                ?2 IS NULL
                OR NOT EXISTS (SELECT 1 FROM session_knowledge_links skl WHERE skl.session_id = ?2)
                OR kd.id IN (SELECT skl.knowledge_doc_id FROM session_knowledge_links skl WHERE skl.session_id = ?2)
              )
            ORDER BY score ASC
            LIMIT ?3
            "#,
        )?;
        let rows = stmt.query_map(params![fts_query, session_id, lim], |row| {
            Ok(KnowledgeSnippet {
                doc_id: row.get(0)?,
                doc_title: row.get(1)?,
                chunk_index: row.get(2)?,
                snippet: row.get(3)?,
                score: row.get(4)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn knowledge_session_sources_list(
    app: AppHandle,
    session_id: i64,
) -> Result<Vec<i64>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT knowledge_doc_id FROM session_knowledge_links WHERE session_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| row.get::<_, i64>(0))?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn knowledge_session_sources_set(
    app: AppHandle,
    session_id: i64,
    doc_ids: Vec<i64>,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    with_connection(&app, |conn| {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "DELETE FROM session_knowledge_links WHERE session_id = ?1",
            params![session_id],
        )?;
        for doc_id in doc_ids {
            tx.execute(
                "INSERT OR IGNORE INTO session_knowledge_links (session_id, knowledge_doc_id, created_at) VALUES (?1, ?2, ?3)",
                params![session_id, doc_id, now],
            )?;
        }
        tx.commit()?;
        Ok(())
    })
}

/// Export all sessions and messages as JSON for backup.
#[tauri::command]
pub fn export_all_data(app: AppHandle) -> Result<String, String> {
    let sessions = session_list(app.clone())?;
    let mut messages = Vec::new();
    for s in &sessions {
        let list = messages_load(app.clone(), s.id)?;
        messages.extend(list);
    }
    let config = config_load(app.clone()).ok();
    let backup = FullBackup {
        sessions,
        messages,
        config,
    };
    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

/// Import from a backup JSON. Mode: "replace" clears existing data; "merge" adds to existing.
#[tauri::command]
pub fn import_backup(app: AppHandle, json: String, mode: String) -> Result<(), String> {
    let backup: FullBackup = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    let replace = mode == "replace";

    with_connection(&app, |conn| {
        if replace {
            conn.execute("DELETE FROM messages", [])?;
            conn.execute("DELETE FROM sessions", [])?;
        }

        let mut id_map: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
        for s in &backup.sessions {
            conn.execute(
                "INSERT INTO sessions (title, created_at, updated_at, model, backend_type, openwebui_workspace_id, openwebui_thread_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    s.title,
                    s.created_at,
                    s.updated_at,
                    s.model,
                    s.backend_type,
                    s.openwebui_workspace_id,
                    s.openwebui_thread_id
                ],
            )?;
            let new_id = conn.last_insert_rowid();
            id_map.insert(s.id, new_id);
        }

        for m in &backup.messages {
            let new_sid = *id_map.get(&m.session_id).unwrap_or(&m.session_id);
            conn.execute(
                "INSERT INTO messages (session_id, role, content, created_at, tool_call_id, tool_name, tool_calls) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    new_sid,
                    m.role,
                    m.content,
                    m.created_at,
                    m.tool_call_id,
                    m.tool_name,
                    m.tool_calls
                ],
            )?;
        }

        Ok(())
    })?;

    if let Some(config) = backup.config {
        config_save(app, config)?;
    }
    Ok(())
}
