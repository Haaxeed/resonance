import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Sound, AppSettings, AudioDeviceInfo, Hotkey, AppInfo } from "@/types";

interface AppState {
  sounds: Sound[];
  categories: string[];
  settings: AppSettings | null;
  devices: AudioDeviceInfo[];
  hotkeys: Hotkey[];
  appInfo: AppInfo | null;
  playingSounds: Set<string>;
  isLoading: boolean;
  darkMode: boolean;
  padSize: number;

  fetchSounds: (search?: string) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchHotkeys: () => Promise<void>;
  fetchAppInfo: () => Promise<void>;
  playSound: (soundId: string) => Promise<void>;
  stopAll: () => Promise<void>;
  importSoundFile: (path: string | string[], category?: string | null) => Promise<void>;
  importFolder: (path: string, category?: string | null) => Promise<void>;
  syncWatchedFolders: () => Promise<number>;
  toggleFavorite: (soundId: string, favorite: boolean) => Promise<void>;
  removeSound: (soundId: string) => Promise<void>;
  reorderSounds: (soundIds: string[]) => Promise<void>;
  renameSound: (soundId: string, name: string) => Promise<void>;
  setSoundCategory: (soundId: string, category: string) => Promise<void>;
  setSoundIcon: (soundId: string, icon: string | null) => Promise<void>;
  setSoundImage: (soundId: string, sourcePath: string) => Promise<string>;
  setSoundImageFromUrl: (soundId: string, url: string) => Promise<string>;
  removeSoundImage: (soundId: string) => Promise<void>;
  createCategory: (name: string) => Promise<string>;
  deleteCategory: (name: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setVolumes: (mic: number, master: number, sb: number) => Promise<void>;
  setMonitorVolume: (volume: number) => Promise<void>;
  setSoundboardVolume: (volume: number) => Promise<void>;
  setSoundboardLiveEnabled: (enabled: boolean) => Promise<void>;
  setDiscordRpcEnabled: (enabled: boolean) => Promise<void>;
  setSoundVolume: (soundId: string, volume: number, customVolume: boolean) => Promise<void>;
  setHotkey: (hotkey: Hotkey) => Promise<void>;
  removeHotkey: (soundId: string) => Promise<void>;
  restartAudioEngine: (input_device_id?: string | null, output_device_id?: string | null) => Promise<void>;
  setDarkMode: (v: boolean) => void;
  setPadSize: (v: number) => void;
}

function sortSounds(sounds: Sound[]) {
  return [...sounds].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  sounds: [],
  categories: [],
  settings: null,
  devices: [],
  hotkeys: [],
  appInfo: null,
  playingSounds: new Set(),
  isLoading: false,
  darkMode: true,
  padSize: 100,

  fetchSounds: async (search) => {
    set({ isLoading: true });
    const res = await invoke<Sound[]>("list_sounds", {
      filter: { search: search || null, category: null, favorite: null },
    });
    set({ sounds: sortSounds(res), isLoading: false });
  },

  fetchCategories: async () => {
    const res = await invoke<string[]>("list_categories");
    set({ categories: res });
  },

  fetchSettings: async () => {
    const res = await invoke<AppSettings>("get_settings");
    const isDark = res.theme === "dark" || (!["light", "soft-purple"].includes(res.theme));
    set({ settings: res, darkMode: isDark });
  },

  fetchDevices: async () => {
    const res = await invoke<AudioDeviceInfo[]>("get_audio_devices");
    set({ devices: res });
  },

  fetchHotkeys: async () => {
    const res = await invoke<Hotkey[]>("list_hotkeys");
    set({ hotkeys: res });
  },

  fetchAppInfo: async () => {
    const res = await invoke<AppInfo>("get_app_info");
    set({ appInfo: res });
  },

  playSound: async (soundId) => {
    set((s) => ({ playingSounds: new Set(s.playingSounds).add(soundId) }));
    const newCount = await invoke<number>("play_sound_cmd", { req: { sound_id: soundId } });
    set((state) => ({
      sounds: state.sounds.map((s) => (s.id === soundId ? { ...s, play_count: newCount } : s)),
    }));
    const sound = get().sounds.find((s) => s.id === soundId);
    const duration = sound && sound.duration_ms > 0 ? sound.duration_ms : 800;
    setTimeout(() => {
      set((s) => {
        const next = new Set(s.playingSounds);
        next.delete(soundId);
        return { playingSounds: next };
      });
    }, duration + 150);
  },

  stopAll: async () => {
    await invoke("stop_all_sounds");
    set({ playingSounds: new Set() });
  },

  importSoundFile: async (path, category) => {
    const paths = Array.isArray(path) ? path : [path];
    for (const p of paths) {
      await invoke("import_sound_file", { path: p, category: category ?? null });
    }
    await get().fetchSounds();
    await get().fetchCategories();
  },

  importFolder: async (path, category) => {
    await invoke("import_sound_folder", { path, category: category ?? null });
    await get().fetchSounds();
    await get().fetchCategories();
  },

  syncWatchedFolders: async () => {
    const imported = await invoke<number>("sync_watched_folders");
    if (imported > 0) {
      await get().fetchSounds();
    }
    return imported;
  },

  toggleFavorite: async (soundId, favorite) => {
    await invoke("set_favorite", { id: soundId, favorite });
    set((state) => ({
      sounds: state.sounds.map((sound) => (sound.id === soundId ? { ...sound, favorite } : sound)),
    }));
  },

  removeSound: async (soundId) => {
    await invoke("remove_sound", { id: soundId });
    await get().fetchSounds();
    await get().fetchHotkeys();
  },

  reorderSounds: async (soundIds) => {
    await invoke("reorder_sounds", { soundIds });
    set((state) => ({
      sounds: sortSounds(
        state.sounds.map((sound) => ({
          ...sound,
          sort_order: soundIds.indexOf(sound.id),
        })),
      ),
    }));
    await get().fetchSounds();
  },

  renameSound: async (soundId, name) => {
    await invoke("rename_sound", { id: soundId, name });
    set((state) => ({
      sounds: sortSounds(state.sounds.map((sound) => (sound.id === soundId ? { ...sound, name } : sound))),
    }));
  },

  setSoundCategory: async (soundId, category) => {
    await invoke("set_sound_category", { id: soundId, category });
    await get().fetchCategories();
    set((state) => ({
      sounds: sortSounds(state.sounds.map((sound) => (sound.id === soundId ? { ...sound, category } : sound))),
    }));
  },

  setSoundIcon: async (soundId, icon) => {
    await invoke("set_sound_icon", { id: soundId, icon });
    set((state) => ({
      sounds: sortSounds(state.sounds.map((sound) => (sound.id === soundId ? { ...sound, icon } : sound))),
    }));
  },

  setSoundImage: async (soundId, sourcePath) => {
    const imagePath = await invoke<string>("set_sound_image", { id: soundId, sourcePath });
    set((state) => ({
      sounds: sortSounds(state.sounds.map((sound) => (sound.id === soundId ? { ...sound, image_path: imagePath } : sound))),
    }));
    return imagePath;
  },

  setSoundImageFromUrl: async (soundId, url) => {
    const imagePath = await invoke<string>("set_sound_image_from_url", { id: soundId, url });
    set((state) => ({
      sounds: sortSounds(state.sounds.map((sound) => (sound.id === soundId ? { ...sound, image_path: imagePath } : sound))),
    }));
    return imagePath;
  },

  removeSoundImage: async (soundId) => {
    await invoke("remove_sound_image", { id: soundId });
    set((state) => ({
      sounds: sortSounds(state.sounds.map((sound) => (sound.id === soundId ? { ...sound, image_path: null } : sound))),
    }));
  },

  createCategory: async (name) => {
    const created = await invoke<string>("create_category", { name });
    await get().fetchCategories();
    return created;
  },

  deleteCategory: async (name) => {
    await invoke("delete_category", { name });
    await get().fetchSounds();
    await get().fetchCategories();
  },

  saveSettings: async (settings) => {
    await invoke("save_settings", { settings });
    await invoke("restart_audio_engine", {
      inputDeviceId: settings.input_device_id ?? null,
      outputDeviceId: settings.output_device_id ?? null,
    });
    set({ settings });
  },

  setVolumes: async (mic, master, sb) => {
    await invoke("set_volumes", { mic, master, sb });
    set((s) => ({
      settings: s.settings ? { ...s.settings, mic_volume: mic, master_volume: master, soundboard_volume: sb } : null,
    }));
  },

  setMonitorVolume: async (volume) => {
    await invoke("set_monitor_volume", { volume });
    set((s) => ({
      settings: s.settings ? { ...s.settings, monitor_volume: volume } : null,
    }));
  },

  setSoundboardVolume: async (volume) => {
    const s = get().settings;
    if (!s) return;
    await invoke("set_volumes", { mic: s.mic_volume, master: s.master_volume, sb: volume });
    set({ settings: { ...s, soundboard_volume: volume } });
  },

  setSoundboardLiveEnabled: async (enabled) => {
    const s = get().settings;
    if (!s) return;
    await invoke("set_soundboard_live_enabled", { enabled });
    set({ settings: { ...s, soundboard_live_enabled: enabled } });
  },

  setDiscordRpcEnabled: async (enabled) => {
    const s = get().settings;
    if (!s) return;
    await invoke("set_discord_rpc_enabled", { enabled });
    set({ settings: { ...s, discord_rpc_enabled: enabled } });
  },

  setSoundVolume: async (soundId, volume, customVolume) => {
    await invoke("set_sound_volume", { id: soundId, volume, customVolume });
    set((state) => ({
      sounds: state.sounds.map((sound) => (sound.id === soundId ? { ...sound, volume, custom_volume: customVolume } : sound)),
    }));
  },

  setHotkey: async (hotkey) => {
    await invoke("set_hotkey", { hotkey });
    await get().fetchHotkeys();
    await get().fetchSounds();
  },

  removeHotkey: async (soundId) => {
    await invoke("remove_hotkey_for_sound", { soundId });
    await get().fetchHotkeys();
    await get().fetchSounds();
  },

  restartAudioEngine: async (input_device_id?: string | null, output_device_id?: string | null) => {
    await invoke("restart_audio_engine", {
      inputDeviceId: input_device_id ?? null,
      outputDeviceId: output_device_id ?? null,
    });
  },

  setDarkMode: (v) => {
    set({ darkMode: v });
    if (v) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  },

  setPadSize: (v) => {
    const clamped = Math.max(64, Math.min(180, v));
    localStorage.setItem("resonance-pad-size", String(clamped));
    set({ padSize: clamped });
  },
}));
