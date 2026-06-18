use crate::db;
use crate::models::*;
use crate::refresh_global_shortcuts;
use crate::audio::decoder::decode_file;
use crate::audio::engine::{AudioEngineHandle, PlayRequest};
use crate::audio::device::{list_audio_devices};
use chrono::Utc;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;
use tauri::State;
use uuid::Uuid;
use walkdir::WalkDir;

pub struct DbState(pub Mutex<rusqlite::Connection>);
pub struct AudioState(pub Mutex<AudioEngineHandle>);

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "wav" | "mp3" | "flac" | "ogg" | "m4a"))
        .unwrap_or(false)
}

fn import_single_sound(conn: &rusqlite::Connection, path: &Path, category: Option<&str>) -> Result<bool, String> {
    let full_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let path_str = full_path.to_string_lossy().to_string();

    if let Some(existing) = db::get_sound_by_path(conn, &path_str).map_err(|e| e.to_string())? {
        db::ensure_sound_in_board(conn, "default", &existing.id).map_err(|e| e.to_string())?;
        return Ok(false);
    }

    let decoded = decode_file(&path_str).map_err(|e| e.to_string())?;
    let normalized_category = db::ensure_category(conn, category.unwrap_or("General")).map_err(|e| e.to_string())?;
    let sound = Sound {
        id: Uuid::new_v4().to_string(),
        name: full_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Imported")
            .to_string(),
        path: path_str,
        source_type: "local".to_string(),
        tags: String::new(),
        duration_ms: decoded.duration_ms as i64,
        volume: 1.0,
        custom_volume: false,
        play_mode: "restart".to_string(),
        category: normalized_category,
        icon: None,
        favorite: false,
        shortcut: None,
        date_added: Utc::now().to_rfc3339(),
        sort_order: db::next_sound_order(conn).map_err(|e| e.to_string())?,
        play_count: 0,
        image_path: None,
    };

    db::insert_sound(conn, &sound).map_err(|e| e.to_string())?;
    db::ensure_sound_in_board(conn, "default", &sound.id).map_err(|e| e.to_string())?;
    Ok(true)
}

fn sync_folder_internal(conn: &rusqlite::Connection, folder: &Path) -> Result<usize, String> {
    let folder = folder.canonicalize().unwrap_or_else(|_| folder.to_path_buf());
    let mut imported = 0usize;

    for entry in WalkDir::new(&folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if entry.file_type().is_file() && is_audio_file(path) {
            if import_single_sound(conn, path, None)? {
                imported += 1;
            }
        }
    }

    Ok(imported)
}

#[tauri::command]
pub fn list_sounds(filter: SoundFilter, db: State<DbState>) -> Result<Vec<Sound>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_sounds(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sound(id: String, db: State<DbState>) -> Result<Option<Sound>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_sound_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_sound(sound: Sound, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::insert_sound(&conn, &sound).map_err(|e| e.to_string())?;
    db::ensure_sound_in_board(&conn, "default", &sound.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_sound_file(path: String, category: Option<String>, db: State<DbState>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    import_single_sound(&conn, Path::new(&path), category.as_deref())
}

#[tauri::command]
pub fn import_sound_folder(path: String, category: Option<String>, db: State<DbState>) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let folder = PathBuf::from(path);
    db::add_watched_folder(&conn, &folder.to_string_lossy()).map_err(|e| e.to_string())?;
    let chosen = category.unwrap_or_else(|| "General".to_string());
    let mut imported = 0usize;

    for entry in WalkDir::new(&folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if entry.file_type().is_file() && is_audio_file(path) {
            if import_single_sound(&conn, path, Some(&chosen))? {
                imported += 1;
            }
        }
    }

    Ok(imported)
}

#[tauri::command]
pub fn sync_watched_folders(db: State<DbState>) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut imported = 0usize;
    for folder in db::list_watched_folders(&conn).map_err(|e| e.to_string())? {
        let path = PathBuf::from(&folder);
        if path.exists() {
            imported += sync_folder_internal(&conn, &path)?;
        } else {
            db::remove_watched_folder(&conn, &folder).map_err(|e| e.to_string())?;
        }
    }
    Ok(imported)
}

#[tauri::command]
pub fn remove_sound(id: String, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_sound(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_favorite(id: String, favorite: bool, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_sound_favorite(&conn, &id, favorite).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_sound_volume(id: String, volume: f64, custom_volume: bool, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_sound_volume(&conn, &id, volume, custom_volume).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_sound(id: String, name: String, db: State<DbState>) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Le nom du son ne peut pas être vide".to_string());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_sound_name(&conn, &id, trimmed).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_sound_category(id: String, category: String, db: State<DbState>) -> Result<(), String> {
    let trimmed = category.trim();
    if trimmed.is_empty() {
        return Err("La catégorie ne peut pas être vide".to_string());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_sound_category(&conn, &id, trimmed).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_sound_icon(id: String, icon: Option<String>, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_sound_icon(&conn, &id, icon.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_sounds(sound_ids: Vec<String>, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::reorder_sounds(&conn, &sound_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_categories(db: State<DbState>) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(name: String, db: State<DbState>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::ensure_category(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(name: String, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_category(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_boards(db: State<DbState>) -> Result<Vec<Board>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_boards(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_board(board: Board, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::insert_board(&conn, &board).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_board(id: String, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_board(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_board_items(board_id: String, db: State<DbState>) -> Result<Vec<BoardItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_board_items(&conn, &board_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_board_item(item: BoardItem, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::insert_board_item(&conn, &item).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_board_item(id: String, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_board_item(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_items(board_id: String, sound_ids: Vec<String>, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::reorder_board_items(&conn, &board_id, &sound_ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(db: State<DbState>) -> Result<AppSettings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, db: State<DbState>, app: AppHandle) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_settings(&conn, &settings).map_err(|e| e.to_string())?;
    drop(conn);
    refresh_global_shortcuts(&app)
}

#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    list_audio_devices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn play_sound_cmd(req: PlaySoundRequest, audio: State<AudioState>, db: State<DbState>) -> Result<i64, String> {
    let engine = audio.0.lock().map_err(|e| e.to_string())?;
    engine.play(PlayRequest {
        sound_id: req.sound_id.clone(),
        board_id: req.board_id,
    }).map_err(|e| e.to_string())?;
    drop(engine);

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sound_name = db::get_sound_by_id(&conn, &req.sound_id)
        .ok()
        .flatten()
        .map(|s| s.name);
    let _ = db::increment_play_count(&conn, &req.sound_id);
    let new_count = db::get_sound_by_id(&conn, &req.sound_id)
        .ok()
        .flatten()
        .map(|s| s.play_count)
        .unwrap_or(0);
    drop(conn);
    crate::discord_rpc::update_activity(sound_name.as_deref());
    Ok(new_count)
}

#[tauri::command]
pub fn stop_all_sounds(audio: State<AudioState>) -> Result<(), String> {
    let engine = audio.0.lock().map_err(|e| e.to_string())?;
    let res = engine.stop_all().map_err(|e| e.to_string());
    crate::discord_rpc::update_activity(None);
    res
}

#[tauri::command]
pub fn set_volumes(mic: f64, master: f64, sb: f64, db: State<DbState>, audio: State<AudioState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    settings.mic_volume = mic;
    settings.master_volume = master;
    settings.soundboard_volume = sb;
    db::update_settings(&conn, &settings).map_err(|e| e.to_string())?;

    let engine = audio.0.lock().map_err(|e| e.to_string())?;
    engine.set_volumes(mic, master, sb).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_monitor_volume(volume: f64, db: State<DbState>, audio: State<AudioState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    settings.monitor_volume = volume.clamp(0.0, 4.0);
    db::update_settings(&conn, &settings).map_err(|e| e.to_string())?;

    let engine = audio.0.lock().map_err(|e| e.to_string())?;
    engine.set_monitor_volume(volume).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_soundboard_live_enabled(enabled: bool, db: State<DbState>, audio: State<AudioState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    settings.soundboard_live_enabled = enabled;
    db::update_settings(&conn, &settings).map_err(|e| e.to_string())?;

    let engine = audio.0.lock().map_err(|e| e.to_string())?;
    engine.set_soundboard_live_enabled(enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_discord_rpc_enabled(enabled: bool, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    settings.discord_rpc_enabled = enabled;
    db::update_settings(&conn, &settings).map_err(|e| e.to_string())?;
    crate::discord_rpc::set_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub fn get_discord_rpc_enabled(db: State<DbState>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    Ok(settings.discord_rpc_enabled)
}

#[tauri::command]
pub fn restart_audio_engine(
    input_device_id: Option<String>,
    output_device_id: Option<String>,
    audio: State<AudioState>,
) -> Result<(), String> {
    let mut engine = audio.0.lock().map_err(|e| e.to_string())?;
    engine.restart(input_device_id, output_device_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_hotkeys(db: State<DbState>) -> Result<Vec<Hotkey>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_hotkeys(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_hotkey(hotkey: Hotkey, db: State<DbState>, app: AppHandle) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::insert_hotkey(&conn, &hotkey).map_err(|e| e.to_string())?;
    db::update_sound_shortcut(&conn, &hotkey.sound_id, Some(&hotkey.shortcut)).map_err(|e| e.to_string())?;
    drop(conn);
    refresh_global_shortcuts(&app)
}

#[tauri::command]
pub fn remove_hotkey_for_sound(sound_id: String, db: State<DbState>, app: AppHandle) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_hotkey_for_sound(&conn, &sound_id).map_err(|e| e.to_string())?;
    db::update_sound_shortcut(&conn, &sound_id, None).map_err(|e| e.to_string())?;
    drop(conn);
    refresh_global_shortcuts(&app)
}

#[tauri::command]
pub fn get_app_info() -> crate::version::AppInfo {
    crate::version::get_app_info()
}

#[tauri::command]
pub fn set_sound_image(id: String, source_path: String, db: State<DbState>, app: AppHandle) -> Result<String, String> {
    let ext = Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .filter(|s| matches!(s.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp"))
        .unwrap_or_else(|| "png".to_string());

    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let images_dir = data_dir.join("sound_images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let filename = format!("{}_{}.{}", id.replace('-', "_"), Uuid::new_v4().to_string().replace('-', "_"), ext);
    let dest = images_dir.join(&filename);
    std::fs::copy(&source_path, &dest).map_err(|e| e.to_string())?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let dest_str = dest.to_string_lossy().to_string();
    db::update_sound_image(&conn, &id, Some(&dest_str)).map_err(|e| e.to_string())?;
    Ok(dest_str)
}

#[tauri::command]
pub fn set_sound_image_from_url(id: String, url: String, db: State<DbState>, app: AppHandle) -> Result<String, String> {
    // Determine extension from URL path or content-type
    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let path_ext = Path::new(parsed.path())
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .filter(|s| matches!(s.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp"));

    let response = reqwest::blocking::get(&url).map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Téléchargement échoué : {}", response.status()));
    }

    let content_type_ext = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|ct| match ct {
            _ if ct.contains("png") => "png",
            _ if ct.contains("jpeg") || ct.contains("jpg") => "jpg",
            _ if ct.contains("gif") => "gif",
            _ if ct.contains("webp") => "webp",
            _ if ct.contains("bmp") => "bmp",
            _ => "png",
        });

    let ext = path_ext.or(content_type_ext.map(|s| s.to_string())).unwrap_or_else(|| "png".to_string());

    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let images_dir = data_dir.join("sound_images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let filename = format!("{}_{}.{}", id.replace('-', "_"), Uuid::new_v4().to_string().replace('-', "_"), ext);
    let dest = images_dir.join(&filename);

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let dest_str = dest.to_string_lossy().to_string();
    db::update_sound_image(&conn, &id, Some(&dest_str)).map_err(|e| e.to_string())?;
    Ok(dest_str)
}

#[tauri::command]
pub fn remove_sound_image(id: String, db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if let Ok(Some(sound)) = db::get_sound_by_id(&conn, &id) {
        if let Some(path) = sound.image_path {
            let _ = std::fs::remove_file(&path);
        }
    }
    db::update_sound_image(&conn, &id, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sound_image_base64(id: String, db: State<DbState>) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sound = db::get_sound_by_id(&conn, &id).map_err(|e| e.to_string())?;
    let path = match sound.and_then(|s| s.image_path) {
        Some(p) => p,
        None => return Ok(None),
    };
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_else(|| "png".to_string());
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}
