use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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
            backend_type TEXT
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub session_id: i64,
    pub role: String,
    pub content: String,
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
            "SELECT id, title, created_at, updated_at, model, backend_type FROM sessions ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Session {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                model: row.get(4)?,
                backend_type: row.get(5)?,
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
            "SELECT id, title, created_at, updated_at, model, backend_type FROM sessions WHERE id = ?1",
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
            "INSERT INTO messages (session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![session_id, role, content, now],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

#[tauri::command]
pub fn messages_load(app: AppHandle, session_id: i64) -> Result<Vec<Message>, String> {
    with_connection(&app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut messages = Vec::new();
        for row in rows {
            messages.push(row?);
        }
        Ok(messages)
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
    let backup = FullBackup { sessions, messages };
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
                "INSERT INTO sessions (title, created_at, updated_at, model, backend_type) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![s.title, s.created_at, s.updated_at, s.model, s.backend_type],
            )?;
            let new_id = conn.last_insert_rowid();
            id_map.insert(s.id, new_id);
        }

        for m in &backup.messages {
            let new_sid = *id_map.get(&m.session_id).unwrap_or(&m.session_id);
            conn.execute(
                "INSERT INTO messages (session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![new_sid, m.role, m.content, m.created_at],
            )?;
        }

        Ok(())
    })
}
