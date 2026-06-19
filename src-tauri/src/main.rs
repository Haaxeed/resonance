#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod commands;
mod db;
mod discord_rpc;
mod input_hook;
mod models;
mod version;

use commands::*;
use crate::audio::engine::PlayRequest;
#[cfg(windows)]
use crate::input_hook::InputHookManager;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub struct HotkeyBindings(pub Mutex<HashMap<u32, String>>);

fn parse_f_key(raw: &str) -> Option<String> {
    let lower = raw.to_ascii_lowercase();
    if lower.len() >= 2 && lower.starts_with('f') {
        if let Ok(num) = lower[1..].parse::<u8>() {
            if (13..=24).contains(&num) {
                return Some(format!("F{}", num));
            }
        }
    }
    None
}

fn normalize_shortcut(shortcut: &str) -> Option<String> {
    let mut modifiers = Vec::new();
    let mut key = None::<String>;

    for raw in shortcut.split('+').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let lower = raw.to_ascii_lowercase();
        match lower.as_str() {
            "ctrl" | "control" | "cmdorcontrol" | "commandorcontrol" => {
                if !modifiers.iter().any(|m| m == "CmdOrControl") {
                    modifiers.push("CmdOrControl".to_string());
                }
            }
            "alt" | "option" => {
                if !modifiers.iter().any(|m| m == "Alt") {
                    modifiers.push("Alt".to_string());
                }
            }
            "shift" => {
                if !modifiers.iter().any(|m| m == "Shift") {
                    modifiers.push("Shift".to_string());
                }
            }
            "meta" | "cmd" | "command" | "super" | "win" | "windows" => {
                if !modifiers.iter().any(|m| m == "Meta") {
                    modifiers.push("Meta".to_string());
                }
            }
            "esc" | "escape" => key = Some("Escape".to_string()),
            "del" | "delete" => key = Some("Delete".to_string()),
            "return" | "enter" => key = Some("Enter".to_string()),
            "space" | "spacebar" => key = Some("Space".to_string()),
            "num0" | "numpad0" => key = Some("Num0".to_string()),
            "num1" | "numpad1" => key = Some("Num1".to_string()),
            "num2" | "numpad2" => key = Some("Num2".to_string()),
            "num3" | "numpad3" => key = Some("Num3".to_string()),
            "num4" | "numpad4" => key = Some("Num4".to_string()),
            "num5" | "numpad5" => key = Some("Num5".to_string()),
            "num6" | "numpad6" => key = Some("Num6".to_string()),
            "num7" | "numpad7" => key = Some("Num7".to_string()),
            "num8" | "numpad8" => key = Some("Num8".to_string()),
            "num9" | "numpad9" => key = Some("Num9".to_string()),
            "numadd" | "numpadadd" | "numplus" | "numpadplus" => key = Some("NumAdd".to_string()),
            "numsubtract" | "numpadsubtract" | "numminus" | "numpadminus" => key = Some("NumSubtract".to_string()),
            "nummultiply" | "numpadmultiply" => key = Some("NumMultiply".to_string()),
            "numdivide" | "numpaddivide" => key = Some("NumDivide".to_string()),
            "numdecimal" | "numpaddecimal" => key = Some("NumDecimal".to_string()),
            "numenter" | "numpadenter" => key = Some("NumEnter".to_string()),
            "mediaplay" | "mediaplaypause" => key = Some("MediaPlayPause".to_string()),
            "mediastop" => key = Some("MediaStop".to_string()),
            "medianext" | "medianexttrack" | "mediatracknext" => key = Some("MediaNextTrack".to_string()),
            "mediaprev" | "mediaprevtrack" | "mediaprevious" | "mediatrackprevious" => key = Some("MediaPrevTrack".to_string()),
            "volumeup" => key = Some("VolumeUp".to_string()),
            "volumedown" => key = Some("VolumeDown".to_string()),
            "volumemute" => key = Some("VolumeMute".to_string()),
            _ if raw.len() == 1 => key = Some(raw.to_ascii_uppercase()),
            _ => {
                if let Some(f_key) = parse_f_key(&raw) {
                    key = Some(f_key);
                } else {
                    key = Some(raw.to_string());
                }
            }
        }
    }

    key.map(|k| {
        modifiers.push(k);
        modifiers.join("+")
    })
}

fn shortcut_has_modifier(shortcut: &str) -> bool {
    shortcut.contains('+')
}

pub fn refresh_global_shortcuts<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let db_state = app.state::<DbState>();
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    let hotkeys = db::get_hotkeys(&conn).map_err(|e| e.to_string())?;
    let settings = db::get_settings(&conn).map_err(|e| e.to_string())?;
    drop(conn);

    let shortcut_manager = app.global_shortcut();
    if let Err(err) = shortcut_manager.unregister_all() {
        println!("[Resonance] warning: unregister_all failed ({})", err);
    }

    let bindings_state = app.state::<HotkeyBindings>();
    let mut bindings = bindings_state.0.lock().map_err(|e| e.to_string())?;
    bindings.clear();

    #[cfg(windows)]
    let mut ll_bindings: Vec<(String, String)> = Vec::new();

    for hotkey in hotkeys.into_iter().filter(|h| h.global) {
        if let Some(accelerator) = normalize_shortcut(&hotkey.shortcut) {
            #[cfg(not(windows))]
            {
                if !shortcut_has_modifier(accelerator.as_str()) {
                    println!("[Resonance] skipped hotkey without modifier {} -> {}", accelerator, hotkey.sound_id);
                    continue;
                }
                if shortcut_manager.is_registered(accelerator.as_str()) {
                    println!("[Resonance] duplicate hotkey skipped {} -> {}", accelerator, hotkey.sound_id);
                    continue;
                }
                if let Err(err) = shortcut_manager.register(accelerator.as_str()) {
                    println!("[Resonance] failed to register hotkey {} -> {} ({})", accelerator, hotkey.sound_id, err);
                    continue;
                }
                if let Ok(parsed) = accelerator.parse::<tauri_plugin_global_shortcut::Shortcut>() {
                    bindings.insert(parsed.id(), hotkey.sound_id.clone());
                }
            }

            #[cfg(windows)]
            {
                ll_bindings.push((accelerator.clone(), hotkey.sound_id.clone()));
                println!("[Resonance] registered low-level hotkey {} -> {}", accelerator, hotkey.sound_id);
            }
        }
    }

    let panic_shortcut = settings
        .panic_key
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .and_then(normalize_shortcut)
        .unwrap_or_else(|| "Ctrl+Pause".to_string());

    #[cfg(not(windows))]
    {
        if !shortcut_has_modifier(panic_shortcut.as_str()) {
            println!("[Resonance] skipped panic shortcut without modifier {}", panic_shortcut);
            return Ok(());
        }

        if !shortcut_manager.is_registered(panic_shortcut.as_str()) {
            if let Err(err) = shortcut_manager.register(panic_shortcut.as_str()) {
                println!("[Resonance] failed to register panic shortcut {} ({})", panic_shortcut, err);
            }
        }
        if shortcut_manager.is_registered(panic_shortcut.as_str()) {
            if let Ok(parsed) = panic_shortcut.parse::<tauri_plugin_global_shortcut::Shortcut>() {
                bindings.insert(parsed.id(), "__STOP_ALL__".to_string());
            }
        }
    }

    #[cfg(windows)]
    {
        ll_bindings.push((panic_shortcut.clone(), "__STOP_ALL__".to_string()));
    }
    println!("[Resonance] registered panic shortcut {}", panic_shortcut);

    #[cfg(windows)]
    {
        app.state::<InputHookManager>().set_bindings(ll_bindings);
    }

    Ok(())
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    println!("[Resonance] Starting audio engine...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }

                    let shortcut_text = shortcut.to_string();
                    let shortcut_id = shortcut.id();
                    let binding = app
                        .state::<HotkeyBindings>()
                        .0
                        .lock()
                        .ok()
                        .and_then(|map| map.get(&shortcut_id).cloned());

                    match binding.as_deref() {
                        Some("__STOP_ALL__") => {
                            if let Ok(engine) = app.state::<AudioState>().0.lock() {
                                let _ = engine.stop_all();
                            }
                            let _ = app.emit("panic-triggered", ());
                            println!("[Resonance] panic shortcut triggered: {}", shortcut_text);
                        }
                        Some(sound_id) => {
                            if let Ok(engine) = app.state::<AudioState>().0.lock() {
                                let _ = engine.stop_all();
                                let _ = engine.play(PlayRequest {
                                    sound_id: sound_id.to_string(),
                                    board_id: Some("default".to_string()),
                                });
                            }
                            if let Ok(conn) = app.state::<DbState>().0.lock() {
                                let _ = db::increment_play_count(&conn, sound_id);
                            }
                            println!("[Resonance] hotkey triggered {} -> {}", shortcut_text, sound_id);
                        }
                        None => {
                            println!("[Resonance] shortcut pressed but not bound: {}", shortcut_text);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let conn = db::init_db(app.app_handle()).expect("Failed to init DB");
            let db_path = db::db_path(app.app_handle());
            let settings = db::get_settings(&conn).expect("Failed to get settings");

            let engine = audio::engine::AudioEngineHandle::new(
                db_path,
                settings.input_device_id.clone(),
                settings.output_device_id.clone(),
            ).expect("Failed to init audio engine");

            app.manage(DbState(Mutex::new(conn)));
            app.manage(AudioState(Mutex::new(engine)));
            app.manage(HotkeyBindings(Mutex::new(HashMap::new())));

            discord_rpc::init(settings.discord_rpc_enabled);

            #[cfg(windows)]
            {
                let hook_manager = InputHookManager::new();
                let app_handle = app.app_handle().clone();
                hook_manager.start(move |sound_id| {
                    if sound_id == "__STOP_ALL__" {
                        if let Ok(engine) = app_handle.state::<AudioState>().0.lock() {
                            let _ = engine.stop_all();
                        }
                        let _ = app_handle.emit("panic-triggered", ());
                        println!("[Resonance] low-level panic shortcut triggered");
                    } else {
                        if let Ok(engine) = app_handle.state::<AudioState>().0.lock() {
                            let _ = engine.play(PlayRequest {
                                sound_id: sound_id.to_string(),
                                board_id: Some("default".to_string()),
                            });
                        }
                        if let Ok(conn) = app_handle.state::<DbState>().0.lock() {
                            let _ = db::increment_play_count(&conn, sound_id);
                        }
                        println!("[Resonance] low-level hotkey triggered -> {}", sound_id);
                    }
                });
                unsafe { crate::input_hook::set_global_input_hook(&hook_manager); }
                app.manage(hook_manager);
            }

            if let Err(err) = refresh_global_shortcuts(app.app_handle()) {
                println!("[Resonance] global shortcuts initialization warning: {}", err);
            }

            // System tray
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Afficher", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;
            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            println!("[Resonance] Quit from tray");
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_sounds, get_sound, add_sound, import_sound_file, import_sound_folder, sync_watched_folders, remove_sound, set_favorite, set_sound_volume,
            rename_sound, set_sound_category, set_sound_icon, set_sound_image, set_sound_image_from_url, remove_sound_image, get_sound_image_base64, reorder_sounds, list_categories, create_category, delete_category,
            list_boards, create_board, delete_board,
            list_board_items, add_board_item, remove_board_item, reorder_items,
            get_settings, save_settings,
            get_audio_devices,
            play_sound_cmd, stop_all_sounds, set_volumes, set_monitor_volume, set_soundboard_live_enabled, restart_audio_engine,
            list_hotkeys, set_hotkey, remove_hotkey_for_sound, get_app_info,
            set_discord_rpc_enabled, get_discord_rpc_enabled
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } => {
                    println!("[Resonance] Exit requested, stopping audio engine...");
                    if let Some(engine) = app_handle.try_state::<AudioState>() {
                        if let Ok(e) = engine.0.lock() {
                            let _ = e.stop_all();
                        }
                    }
                }
                tauri::RunEvent::WindowEvent { label, event, .. } => {
                    if label == "main" {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .expect("error while running tauri application");
}
