import { useAppStore } from "@/store/useAppStore";
import type { AppSettings } from "@/types";
import { eventToShortcut, shortcutHasModifier, shortcutLooksReservedOnWindows } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { Info, Keyboard, Headphones, RadioTower, Save, Share2, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

const THEMES = [
  { value: "obsidian", label: "Obsidian", preview: "linear-gradient(135deg, #8b5cf6, #3b82f6)" },
  { value: "cyberpunk", label: "Cyberpunk", preview: "linear-gradient(135deg, #facc15, #ec4899)" },
  { value: "midnight-blue", label: "Midnight Blue", preview: "linear-gradient(135deg, #3b82f6, #06b6d4)" },
  { value: "soft-purple", label: "Soft Purple", preview: "linear-gradient(135deg, #c084fc, #f0abfc)" },
];

function SettingRow({
  label,
  description,
  icon: Icon,
  children,
  highlight = false,
}: {
  label: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        highlight
          ? "border-primary/15 bg-primary/[0.06]"
          : "border-white/8 bg-background/55"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-muted-foreground" />}
          <span>{label}</span>
        </div>
        {children}
      </div>
      {description && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Info size={12} className="mt-0.5 shrink-0" />
          {description}
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, saveSettings, setDarkMode, appInfo } = useAppStore();
  const [form, setForm] = useState(settings);
  const [recordingPanic, setRecordingPanic] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const update = (k: keyof AppSettings, v: any) => {
    setForm((prev: any) => ({ ...prev, [k]: v }));
  };

  const setTheme = (theme: string) => {
    update("theme", theme);
    setDarkMode(theme !== "light" && theme !== "soft-purple");
  };

  const submit = async () => {
    if (!form) return;
    if (form.panic_key && form.panic_key.trim() && !shortcutHasModifier(form.panic_key.trim())) {
      window.alert("Le raccourci d'urgence global doit inclure Ctrl, Alt, Shift ou Win pour ne pas bloquer Windows/les jeux.");
      return;
    }
    if (form.panic_key && form.panic_key.trim() && shortcutLooksReservedOnWindows(form.panic_key.trim())) {
      window.alert("Les combinaisons avec Escape sont peu fiables / réservées sous Windows pour une hotkey globale. Utilise plutôt Ctrl+Pause, Alt+Pause ou Ctrl+ScrollLock.");
      return;
    }
    await saveSettings(form);
  };

  if (!form) return <div className="p-8">Chargement...</div>;

  return (
    <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-8">
      <div>
        <h1 className="premium-heading text-3xl tracking-tight">Réglages</h1>
      </div>

      <div className="glass-card rounded-[28px] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Apparence</h2>
        <div className="mt-4">
          <SettingRow label="Thème">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition",
                    form.theme === t.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-white/8 bg-background/55 hover:border-primary/30 hover:bg-background/70"
                  )}
                >
                  <div
                    className="h-8 w-8 rounded-full shadow-inner ring-1 ring-white/20"
                    style={{ background: t.preview }}
                  />
                  <span className="text-[11px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </SettingRow>
        </div>
      </div>

      <div className="glass-card rounded-[28px] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Audio</h2>
        <div className="mt-4 space-y-3">
          <SettingRow
            label="Monitoring local"
            description="Joue les sons aussi sur le périphérique de sortie par défaut (ton casque) pour que tu t'entendes."
            icon={Headphones}
          >
            <input
              type="checkbox"
              checked={form.monitoring_enabled}
              onChange={(e) => update("monitoring_enabled", e.target.checked)}
              className="premium-checkbox"
            />
          </SettingRow>

          <SettingRow
            label="Auto ducking"
            description="Baisse temporairement le volume du micro dans le flux soundboard quand un son joue, puis le remonte."
            icon={Volume2}
          >
            <input
              type="checkbox"
              checked={form.auto_duck}
              onChange={(e) => update("auto_duck", e.target.checked)}
              className="premium-checkbox"
            />
          </SettingRow>

          <SettingRow
            label="Envoi live vers VB-Cable"
            description="Active l'envoi du son sur la sortie soundboard (Discord / live). Désactive pour écouter localement sans diffuser."
            icon={RadioTower}
            highlight
          >
            <input
              type="checkbox"
              checked={form.soundboard_live_enabled}
              onChange={async (e) => {
                const next = { ...form, soundboard_live_enabled: e.target.checked };
                setForm(next);
                await saveSettings(next);
              }}
              className="premium-checkbox"
            />
          </SettingRow>

          <div className="rounded-2xl border border-white/8 bg-background/55 px-4 py-3">
            <div className="flex items-center justify-between">
              <span>Mix micro dans le flux soundboard</span>
              <span className="text-xs text-muted-foreground">{Math.round((form.mic_volume ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={Math.round((form.mic_volume ?? 1) * 100)}
              onChange={(e) => update("mic_volume", Number(e.target.value) / 100)}
              className="premium-range mt-3 w-full"
            />
          </div>

          <div className="rounded-2xl border border-white/8 bg-background/55 px-4 py-3">
            <div className="flex items-center justify-between">
              <span>Volume d'écoute personnel (monitor)</span>
              <span className="text-xs text-muted-foreground">{Math.round((form.monitor_volume ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={400}
              value={Math.round((form.monitor_volume ?? 1) * 100)}
              onChange={(e) => update("monitor_volume", Number(e.target.value) / 100)}
              className="premium-range mt-3 w-full"
            />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[28px] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Raccourci d'urgence</h2>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-background/55 px-4 py-3">
          <span className="flex-1 text-sm">Panic key (stop all)</span>
          <div className="flex w-48 items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
            <Keyboard size={14} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              readOnly
              value={recordingPanic ? "Appuie..." : form.panic_key || ""}
              onFocus={() => setRecordingPanic(true)}
              onBlur={() => setRecordingPanic(false)}
              onKeyDown={(e) => {
                e.preventDefault();
                if (e.key === "Backspace" || e.key === "Delete") {
                  update("panic_key", null);
                  setRecordingPanic(false);
                  return;
                }
                const combo = eventToShortcut(e);
                if (!combo) return;
                update("panic_key", combo);
                setRecordingPanic(false);
              }}
              placeholder="Ex: Ctrl+Pause"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Les raccourcis globaux doivent inclure Ctrl, Alt, Shift ou Win. Sous Windows, évite Escape : préfère Ctrl+Pause, Alt+Pause ou Ctrl+ScrollLock.</div>
      </div>

      <button onClick={submit} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">
        <Save size={18} /> Sauvegarder les réglages
      </button>

      <div className="glass-card rounded-[28px] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Discord</h2>
        <div className="mt-4">
          <SettingRow
            label="Rich Presence"
            description="Affiche Resonance dans ton statut Discord (nom du son en cours, icône de l'app). Désactive si tu préfères rester discret."
            icon={Share2}
          >
            <input
              type="checkbox"
              checked={form.discord_rpc_enabled}
              onChange={async (e) => {
                const next = { ...form, discord_rpc_enabled: e.target.checked };
                setForm(next);
                await useAppStore.getState().setDiscordRpcEnabled(e.target.checked);
              }}
              className="premium-checkbox"
            />
          </SettingRow>
        </div>
      </div>

      <div className="glass-card rounded-[28px] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À propos</h2>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-background/55 px-4 py-3">
          <span>Version</span>
          <span className="font-mono text-sm text-muted-foreground">{appInfo?.version ?? "..."}</span>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-background/55 px-4 py-3">
          <span>Créé par</span>
          <span className="font-medium">{appInfo?.author ?? "..."}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
