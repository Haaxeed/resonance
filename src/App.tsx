import { useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/store/useAppStore";
import { eventToShortcut } from "@/lib/shortcuts";
import BottomBar from "@/components/BottomBar";
import TitleBar from "@/components/TitleBar";
import Dashboard from "@/pages/Dashboard";
import Library from "@/pages/Library";
import SettingsPage from "@/pages/Settings";
import AudioSetup from "@/pages/AudioSetup";

const pageTransition = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.005 },
  transition: { duration: 0.18, ease: "easeInOut" as const },
};

function AppShell() {
  const location = useLocation();
  const { fetchSettings, fetchSounds, fetchHotkeys, fetchAppInfo, darkMode, settings, setPadSize, stopAll, hotkeys, playSound } = useAppStore();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("resonance-pad-size");
      if (saved) setPadSize(Number(saved));
    } catch {
      // ignore
    }
  }, [setPadSize]);

  useEffect(() => {
    fetchSettings();
    fetchSounds();
    fetchHotkeys();
    fetchAppInfo();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("panic-triggered", () => {
      void stopAll();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [stopAll]);

  // Fallback keyboard handler when the low-level hook doesn't fire while the app is focused
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const combo = eventToShortcut(e);
      if (!combo) return;
      const hk = hotkeys.find((h) => h.global && h.shortcut.toLowerCase() === combo.toLowerCase());
      if (hk) {
        e.preventDefault();
        void playSound(hk.sound_id);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [hotkeys, playSound]);

  useEffect(() => {
    const theme = settings?.theme ?? "dark";
    const isPreset = ["obsidian", "cyberpunk", "midnight-blue", "soft-purple", "neon-noir", "blood-moon"].includes(theme);
    const isDark = theme !== "light" && theme !== "soft-purple";

    document.documentElement.classList.remove("theme-obsidian", "theme-cyberpunk", "theme-midnight-blue", "theme-soft-purple", "theme-neon-noir", "theme-blood-moon");
    if (isPreset) {
      document.documentElement.classList.add(`theme-${theme}`);
    }

    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [settings?.theme, darkMode]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="h-full"
            {...pageTransition}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audio" element={<AudioSetup />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomBar />
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

export default App;
