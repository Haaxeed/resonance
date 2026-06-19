use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sound {
    pub id: String,
    pub name: String,
    pub path: String,
    pub source_type: String, // "local" | "remote"
    pub tags: String,
    pub duration_ms: i64,
    pub volume: f64,
    pub custom_volume: bool,
    pub play_mode: String, // "restart" | "overlap" | "loop"
    pub category: String,
    pub icon: Option<String>,
    pub favorite: bool,
    pub shortcut: Option<String>,
    pub date_added: String,
    pub sort_order: i64,
    pub play_count: i64,
    pub image_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Board {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardItem {
    pub id: String,
    pub board_id: String,
    pub sound_id: String,
    pub position: i64,
    pub custom_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hotkey {
    pub id: String,
    pub sound_id: String,
    pub shortcut: String,
    pub global: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub id: i64,
    pub input_device_id: Option<String>,
    pub output_device_id: Option<String>,
    pub mic_volume: f64,
    pub monitor_volume: f64,
    pub master_volume: f64,
    pub soundboard_volume: f64,
    pub soundboard_live_enabled: bool,
    pub monitoring_enabled: bool,
    pub discord_rpc_enabled: bool,
    pub theme: String,
    pub panic_key: Option<String>,
    pub auto_duck: bool,
    pub duck_threshold: f64,
    pub overlap_enabled: bool,
    pub autostart_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub device_type: String, // "input" | "output"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaySoundRequest {
    pub sound_id: String,
    pub board_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSoundRequest {
    pub path: String,
    pub name: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SoundFilter {
    pub search: Option<String>,
    pub category: Option<String>,
    pub favorite: Option<bool>,
}
