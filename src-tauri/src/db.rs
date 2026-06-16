use anyhow::Result;
use rusqlite::{Connection, params};
use std::path::PathBuf;
use tauri::Manager;

use crate::models::*;

pub fn db_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_local_data_dir().expect("Failed to get app data dir");
    dir.join("resonance.db")
}

pub fn backup_db_before_upgrade(app: &tauri::AppHandle) -> Result<()> {
    let db_path = db_path(app);
    if !db_path.exists() {
        return Ok(());
    }

    let backup_dir = db_path.parent().unwrap().join("backups");
    std::fs::create_dir_all(&backup_dir)?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let version = env!("CARGO_PKG_VERSION").replace('.', "_");
    let backup_name = format!("resonance_v{}_{}.db", version, timestamp);
    let backup_path = backup_dir.join(backup_name);

    std::fs::copy(&db_path, &backup_path)?;
    println!("[Resonance] database backed up to {:?}", backup_path);

    // Keep only the 10 most recent backups
    let mut backups: Vec<std::path::PathBuf> = std::fs::read_dir(&backup_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().map(|ext| ext == "db").unwrap_or(false))
        .collect();

    backups.sort_by(|a, b| {
        b.metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .cmp(&a.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH))
    });

    for old in backups.iter().skip(10) {
        let _ = std::fs::remove_file(old);
    }

    Ok(())
}

pub fn init_db(app: &tauri::AppHandle) -> Result<Connection> {
    let path = db_path(app);
    std::fs::create_dir_all(path.parent().unwrap())?;

    backup_db_before_upgrade(app)?;

    let conn = Connection::open(&path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sounds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            source_type TEXT DEFAULT 'local',
            tags TEXT DEFAULT '',
            duration_ms INTEGER DEFAULT 0,
            volume REAL DEFAULT 1.0,
            custom_volume INTEGER DEFAULT 0,
            play_mode TEXT DEFAULT 'restart',
            category TEXT DEFAULT 'General',
            icon TEXT,
            favorite INTEGER DEFAULT 0,
            shortcut TEXT,
            date_added TEXT DEFAULT CURRENT_TIMESTAMP,
            sort_order INTEGER DEFAULT 0,
            play_count INTEGER DEFAULT 0,
            image_path TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS boards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'grid',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS board_items (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            sound_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            custom_color TEXT,
            FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE,
            FOREIGN KEY(sound_id) REFERENCES sounds(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS hotkeys (
            id TEXT PRIMARY KEY,
            sound_id TEXT NOT NULL UNIQUE,
            shortcut TEXT NOT NULL,
            global INTEGER DEFAULT 1,
            FOREIGN KEY(sound_id) REFERENCES sounds(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            input_device_id TEXT,
            output_device_id TEXT,
            mic_volume REAL DEFAULT 1.0,
            monitor_volume REAL DEFAULT 1.0,
            master_volume REAL DEFAULT 1.0,
            soundboard_volume REAL DEFAULT 1.0,
            soundboard_live_enabled INTEGER DEFAULT 1,
            monitoring_enabled INTEGER DEFAULT 0,
            theme TEXT DEFAULT 'dark',
            panic_key TEXT,
            auto_duck INTEGER DEFAULT 0,
            duck_threshold REAL DEFAULT 0.3
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS watched_folders (
            path TEXT PRIMARY KEY,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS categories (
            name TEXT PRIMARY KEY,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute("ALTER TABLE sounds ADD COLUMN custom_volume INTEGER DEFAULT 0", []).ok();
    conn.execute("ALTER TABLE sounds ADD COLUMN sort_order INTEGER DEFAULT 0", []).ok();
    conn.execute("ALTER TABLE settings ADD COLUMN soundboard_live_enabled INTEGER DEFAULT 1", []).ok();
    conn.execute("ALTER TABLE sounds ADD COLUMN icon TEXT", []).ok();
    conn.execute("ALTER TABLE sounds ADD COLUMN play_count INTEGER DEFAULT 0", []).ok();
    conn.execute("ALTER TABLE sounds ADD COLUMN image_path TEXT", []).ok();
    conn.execute("ALTER TABLE settings ADD COLUMN monitor_volume REAL DEFAULT 1.0", []).ok();
    conn.execute("ALTER TABLE settings ADD COLUMN discord_rpc_enabled INTEGER DEFAULT 1", []).ok();

    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_sounds_path ON sounds(path)", [])?;
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_board_sound_unique ON board_items(board_id, sound_id)", [])?;

    normalize_sound_order(&conn)?;

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM boards", [], |row| row.get(0))?;
    if count == 0 {
        conn.execute(
            "INSERT INTO boards (id, name) VALUES ('default', 'Default')",
            [],
        )?;
    }
    let settings_count: i64 = conn.query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))?;
    if settings_count == 0 {
        conn.execute("INSERT INTO settings (id) VALUES (1)", [])?;
    }

    conn.execute("INSERT OR IGNORE INTO categories (name) VALUES ('General')", [])?;
    conn.execute(
        "INSERT OR IGNORE INTO categories (name)
         SELECT DISTINCT TRIM(category) FROM sounds WHERE TRIM(category) <> ''",
        [],
    )?;

    Ok(conn)
}

fn normalize_sound_order(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT id FROM sounds ORDER BY sort_order ASC, name COLLATE NOCASE ASC, date_added ASC"
    )?;
    let ids = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let tx = conn.unchecked_transaction()?;
    for (index, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE sounds SET sort_order = ?1 WHERE id = ?2",
            params![index as i64, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn next_sound_order(conn: &Connection) -> Result<i64> {
    let next = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM sounds",
        [],
        |row| row.get(0),
    )?;
    Ok(next)
}

// --- Sounds ---

pub fn insert_sound(conn: &Connection, sound: &Sound) -> Result<()> {
    conn.execute(
        "INSERT INTO sounds (id, name, path, source_type, tags, duration_ms, volume, custom_volume, play_mode, category, icon, favorite, shortcut, date_added, sort_order, play_count, image_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            sound.id, sound.name, sound.path, sound.source_type, sound.tags,
            sound.duration_ms, sound.volume, if sound.custom_volume { 1 } else { 0 }, sound.play_mode, sound.category, sound.icon,
            if sound.favorite { 1 } else { 0 }, sound.shortcut, sound.date_added, sound.sort_order, sound.play_count, sound.image_path
        ],
    )?;
    Ok(())
}

pub fn get_sounds(conn: &Connection, filter: &SoundFilter) -> Result<Vec<Sound>> {
    let mut sql = "SELECT id, name, path, source_type, tags, duration_ms, volume, custom_volume, play_mode, category, icon, favorite, shortcut, date_added, sort_order, play_count, image_path FROM sounds WHERE 1=1".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref s) = filter.search {
        sql.push_str(" AND (name LIKE ? OR tags LIKE ? OR category LIKE ?)");
        let like = format!("%{}%", s);
        params_vec.push(Box::new(like.clone()));
        params_vec.push(Box::new(like.clone()));
        params_vec.push(Box::new(like));
    }
    if let Some(ref c) = filter.category {
        sql.push_str(" AND category = ?");
        params_vec.push(Box::new(c.clone()));
    }
    if let Some(f) = filter.favorite {
        sql.push_str(" AND favorite = ?");
        params_vec.push(Box::new(if f { 1 } else { 0 }));
    }
    sql.push_str(" ORDER BY sort_order ASC, name COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&sql)?;
    let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(&*params_ref, |row| {
        Ok(Sound {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            source_type: row.get(3)?,
            tags: row.get(4)?,
            duration_ms: row.get(5)?,
            volume: row.get(6)?,
            custom_volume: row.get::<_, i64>(7)? != 0,
            play_mode: row.get(8)?,
            category: row.get(9)?,
            icon: row.get(10)?,
            favorite: row.get::<_, i64>(11)? != 0,
            shortcut: row.get(12)?,
            date_added: row.get(13)?,
            sort_order: row.get(14)?,
            play_count: row.get(15)?,
            image_path: row.get(16)?,
        })
    })?;
    let mut sounds = vec![];
    for s in rows {
        sounds.push(s?);
    }
    Ok(sounds)
}

pub fn get_sound_by_id(conn: &Connection, id: &str) -> Result<Option<Sound>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, source_type, tags, duration_ms, volume, custom_volume, play_mode, category, icon, favorite, shortcut, date_added, sort_order, play_count, image_path FROM sounds WHERE id = ?1"
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(Sound {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            source_type: row.get(3)?,
            tags: row.get(4)?,
            duration_ms: row.get(5)?,
            volume: row.get(6)?,
            custom_volume: row.get::<_, i64>(7)? != 0,
            play_mode: row.get(8)?,
            category: row.get(9)?,
            icon: row.get(10)?,
            favorite: row.get::<_, i64>(11)? != 0,
            shortcut: row.get(12)?,
            date_added: row.get(13)?,
            sort_order: row.get(14)?,
            play_count: row.get(15)?,
            image_path: row.get(16)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn get_sound_by_path(conn: &Connection, path: &str) -> Result<Option<Sound>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, source_type, tags, duration_ms, volume, custom_volume, play_mode, category, icon, favorite, shortcut, date_added, sort_order, play_count, image_path FROM sounds WHERE path = ?1"
    )?;
    let mut rows = stmt.query_map(params![path], |row| {
        Ok(Sound {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            source_type: row.get(3)?,
            tags: row.get(4)?,
            duration_ms: row.get(5)?,
            volume: row.get(6)?,
            custom_volume: row.get::<_, i64>(7)? != 0,
            play_mode: row.get(8)?,
            category: row.get(9)?,
            icon: row.get(10)?,
            favorite: row.get::<_, i64>(11)? != 0,
            shortcut: row.get(12)?,
            date_added: row.get(13)?,
            sort_order: row.get(14)?,
            play_count: row.get(15)?,
            image_path: row.get(16)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn ensure_sound_in_board(conn: &Connection, board_id: &str, sound_id: &str) -> Result<()> {
    let position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM board_items WHERE board_id = ?1",
        params![board_id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO board_items (id, board_id, sound_id, position, custom_color) VALUES (?1, ?2, ?3, ?4, NULL)",
        params![format!("{}:{}", board_id, sound_id), board_id, sound_id, position],
    )?;
    Ok(())
}

pub fn add_watched_folder(conn: &Connection, path: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO watched_folders (path) VALUES (?1)",
        params![path],
    )?;
    Ok(())
}

pub fn list_categories(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT name FROM categories ORDER BY CASE WHEN name = 'General' THEN 0 ELSE 1 END, name COLLATE NOCASE ASC")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut categories = vec![];
    for row in rows {
        categories.push(row?);
    }
    Ok(categories)
}

pub fn ensure_category(conn: &Connection, category: &str) -> Result<String> {
    let trimmed = category.trim();
    let normalized = if trimmed.is_empty() { "General" } else { trimmed };
    conn.execute(
        "INSERT OR IGNORE INTO categories (name) VALUES (?1)",
        params![normalized],
    )?;
    Ok(normalized.to_string())
}

pub fn delete_category(conn: &Connection, category: &str) -> Result<()> {
    let trimmed = category.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("General") {
        return Ok(());
    }

    let fallback = ensure_category(conn, "General")?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE sounds SET category = ?1 WHERE category = ?2",
        params![fallback, trimmed],
    )?;
    tx.execute("DELETE FROM categories WHERE name = ?1", params![trimmed])?;
    tx.commit()?;
    Ok(())
}

pub fn list_watched_folders(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT path FROM watched_folders ORDER BY created_at")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut folders = vec![];
    for row in rows {
        folders.push(row?);
    }
    Ok(folders)
}

pub fn remove_watched_folder(conn: &Connection, path: &str) -> Result<()> {
    conn.execute("DELETE FROM watched_folders WHERE path = ?1", params![path])?;
    Ok(())
}

pub fn delete_sound(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM sounds WHERE id = ?1", params![id])?;
    conn.execute("DELETE FROM board_items WHERE sound_id = ?1", params![id])?;
    conn.execute("DELETE FROM hotkeys WHERE sound_id = ?1", params![id])?;
    Ok(())
}

pub fn update_sound_favorite(conn: &Connection, id: &str, favorite: bool) -> Result<()> {
    conn.execute("UPDATE sounds SET favorite = ?1 WHERE id = ?2", params![if favorite { 1 } else { 0 }, id])?;
    Ok(())
}

pub fn update_sound_shortcut(conn: &Connection, id: &str, shortcut: Option<&str>) -> Result<()> {
    conn.execute("UPDATE sounds SET shortcut = ?1 WHERE id = ?2", params![shortcut, id])?;
    Ok(())
}

pub fn update_sound_volume(conn: &Connection, id: &str, volume: f64, custom_volume: bool) -> Result<()> {
    conn.execute(
        "UPDATE sounds SET volume = ?1, custom_volume = ?2 WHERE id = ?3",
        params![volume, if custom_volume { 1 } else { 0 }, id],
    )?;
    Ok(())
}

pub fn update_sound_name(conn: &Connection, id: &str, name: &str) -> Result<()> {
    conn.execute("UPDATE sounds SET name = ?1 WHERE id = ?2", params![name.trim(), id])?;
    Ok(())
}

pub fn update_sound_icon(conn: &Connection, id: &str, icon: Option<&str>) -> Result<()> {
    conn.execute("UPDATE sounds SET icon = ?1 WHERE id = ?2", params![icon, id])?;
    Ok(())
}

pub fn update_sound_image(conn: &Connection, id: &str, image_path: Option<&str>) -> Result<()> {
    conn.execute("UPDATE sounds SET image_path = ?1 WHERE id = ?2", params![image_path, id])?;
    Ok(())
}

pub fn increment_play_count(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE sounds SET play_count = play_count + 1 WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn update_sound_category(conn: &Connection, id: &str, category: &str) -> Result<()> {
    let normalized = ensure_category(conn, category)?;
    conn.execute(
        "UPDATE sounds SET category = ?1 WHERE id = ?2",
        params![normalized, id],
    )?;
    Ok(())
}

pub fn reorder_sounds(conn: &Connection, sound_ids: &[String]) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    for (index, sound_id) in sound_ids.iter().enumerate() {
        tx.execute(
            "UPDATE sounds SET sort_order = ?1 WHERE id = ?2",
            params![index as i64, sound_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

// --- Boards ---

pub fn get_boards(conn: &Connection) -> Result<Vec<Board>> {
    let mut stmt = conn.prepare("SELECT id, name, icon, created_at FROM boards ORDER BY created_at")?;
    let rows = stmt.query_map([], |row| {
        Ok(Board {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    let mut boards = vec![];
    for b in rows { boards.push(b?); }
    Ok(boards)
}

pub fn insert_board(conn: &Connection, board: &Board) -> Result<()> {
    conn.execute(
        "INSERT INTO boards (id, name, icon, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![board.id, board.name, board.icon, board.created_at],
    )?;
    Ok(())
}

pub fn delete_board(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM boards WHERE id = ?1", params![id])?;
    conn.execute("DELETE FROM board_items WHERE board_id = ?1", params![id])?;
    Ok(())
}

// --- Board Items ---

pub fn get_board_items(conn: &Connection, board_id: &str) -> Result<Vec<BoardItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, board_id, sound_id, position, custom_color FROM board_items WHERE board_id = ?1 ORDER BY position"
    )?;
    let rows = stmt.query_map(params![board_id], |row| {
        Ok(BoardItem {
            id: row.get(0)?,
            board_id: row.get(1)?,
            sound_id: row.get(2)?,
            position: row.get(3)?,
            custom_color: row.get(4)?,
        })
    })?;
    let mut items = vec![];
    for i in rows { items.push(i?); }
    Ok(items)
}

pub fn insert_board_item(conn: &Connection, item: &BoardItem) -> Result<()> {
    conn.execute(
        "INSERT INTO board_items (id, board_id, sound_id, position, custom_color) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![item.id, item.board_id, item.sound_id, item.position, item.custom_color],
    )?;
    Ok(())
}

pub fn delete_board_item(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM board_items WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn reorder_board_items(conn: &Connection, board_id: &str, sound_ids: &[String]) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    for (pos, sid) in sound_ids.iter().enumerate() {
        tx.execute(
            "UPDATE board_items SET position = ?1 WHERE board_id = ?2 AND sound_id = ?3",
            params![pos as i64, board_id, sid],
        )?;
    }
    tx.commit()?;
    Ok(())
}

// --- Settings ---

pub fn get_settings(conn: &Connection) -> Result<AppSettings> {
    let mut stmt = conn.prepare(
        "SELECT id, input_device_id, output_device_id, mic_volume, master_volume, soundboard_volume, soundboard_live_enabled, monitoring_enabled, theme, panic_key, auto_duck, duck_threshold, monitor_volume, discord_rpc_enabled FROM settings WHERE id = 1"
    )?;
    let settings = stmt.query_row([], |row| {
        Ok(AppSettings {
            id: row.get(0)?,
            input_device_id: row.get(1)?,
            output_device_id: row.get(2)?,
            mic_volume: row.get(3)?,
            master_volume: row.get(4)?,
            soundboard_volume: row.get(5)?,
            soundboard_live_enabled: row.get::<_, i64>(6)? != 0,
            monitoring_enabled: row.get::<_, i64>(7)? != 0,
            theme: row.get(8)?,
            panic_key: row.get(9)?,
            auto_duck: row.get::<_, i64>(10)? != 0,
            duck_threshold: row.get(11)?,
            monitor_volume: row.get(12)?,
            discord_rpc_enabled: row.get::<_, i64>(13)? != 0,
        })
    })?;
    Ok(settings)
}

pub fn update_settings(conn: &Connection, settings: &AppSettings) -> Result<()> {
    conn.execute(
        "UPDATE settings SET
            input_device_id = ?1, output_device_id = ?2, mic_volume = ?3,
            master_volume = ?4, soundboard_volume = ?5, soundboard_live_enabled = ?6, monitoring_enabled = ?7,
            theme = ?8, panic_key = ?9, auto_duck = ?10, duck_threshold = ?11, monitor_volume = ?12, discord_rpc_enabled = ?13
         WHERE id = 1",
        params![
            settings.input_device_id, settings.output_device_id, settings.mic_volume,
            settings.master_volume, settings.soundboard_volume, if settings.soundboard_live_enabled { 1 } else { 0 }, if settings.monitoring_enabled { 1 } else { 0 },
            settings.theme, settings.panic_key, if settings.auto_duck { 1 } else { 0 }, settings.duck_threshold, settings.monitor_volume,
            if settings.discord_rpc_enabled { 1 } else { 0 }
        ],
    )?;
    Ok(())
}

// --- Hotkeys ---

pub fn get_hotkeys(conn: &Connection) -> Result<Vec<Hotkey>> {
    let mut stmt = conn.prepare("SELECT id, sound_id, shortcut, global FROM hotkeys")?;
    let rows = stmt.query_map([], |row| {
        Ok(Hotkey {
            id: row.get(0)?,
            sound_id: row.get(1)?,
            shortcut: row.get(2)?,
            global: row.get::<_, i64>(3)? != 0,
        })
    })?;
    let mut hotkeys = vec![];
    for h in rows { hotkeys.push(h?); }
    Ok(hotkeys)
}

pub fn insert_hotkey(conn: &Connection, hotkey: &Hotkey) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO hotkeys (id, sound_id, shortcut, global) VALUES (?1, ?2, ?3, ?4)",
        params![hotkey.id, hotkey.sound_id, hotkey.shortcut, if hotkey.global { 1 } else { 0 }],
    )?;
    Ok(())
}

pub fn delete_hotkey_for_sound(conn: &Connection, sound_id: &str) -> Result<()> {
    conn.execute("DELETE FROM hotkeys WHERE sound_id = ?1", params![sound_id])?;
    Ok(())
}
