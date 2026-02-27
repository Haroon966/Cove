use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

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

/// Full-text search: sessions matching query in title or in any message content.
/// Returns session_id, title, and a short snippet (message excerpt or title).
#[tauri::command]
pub fn search_sessions(app: AppHandle, query: String) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    with_connection(&app, |conn| {
        // Sessions matching by title OR by message content; snippet from first matching message or title
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
