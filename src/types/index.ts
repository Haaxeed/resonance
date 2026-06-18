export interface Sound {
  id: string;
  name: string;
  path: string;
  source_type: string;
  tags: string;
  duration_ms: number;
  volume: number;
  custom_volume: boolean;
  play_mode: "restart" | "overlap" | "loop";
  category: string;
  icon: string | null;
  favorite: boolean;
  shortcut: string | null;
  date_added: string;
  sort_order: number;
  play_count: number;
  image_path: string | null;
}

export interface Board {
  id: string;
  name: string;
  icon: string;
  created_at: string;
}

export interface BoardItem {
  id: string;
  board_id: string;
  sound_id: string;
  position: number;
  custom_color: string | null;
}

export interface Hotkey {
  id: string;
  sound_id: string;
  shortcut: string;
  global: boolean;
}

export interface AppSettings {
  id: number;
  input_device_id: string | null;
  output_device_id: string | null;
  mic_volume: number;
  monitor_volume: number;
  master_volume: number;
  soundboard_volume: number;
  soundboard_live_enabled: boolean;
  monitoring_enabled: boolean;
  discord_rpc_enabled: boolean;
  theme: string;
  panic_key: string | null;
  auto_duck: boolean;
  duck_threshold: number;
  overlap_enabled: boolean;
}

export interface AudioDeviceInfo {
  id: string;
  name: string;
  is_default: boolean;
  device_type: "input" | "output";
}

export interface AppInfo {
  version: string;
  author: string;
}
