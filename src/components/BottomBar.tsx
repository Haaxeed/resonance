import { Link, useLocation } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { Headphones, Library, RadioTower, Radio, Settings, SquareStack, StopCircle, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomBar() {
  const location = useLocation();
  const { stopAll, settings, setSoundboardVolume, setSoundboardLiveEnabled } = useAppStore();

  const sbVolume = settings?.soundboard_volume ?? 1;
  const liveEnabled = settings?.soundboard_live_enabled ?? false;

  const toggleLive = async () => {
    if (!settings) return;
    await setSoundboardLiveEnabled(!settings.soundboard_live_enabled);
  };

  const navItems = [
    { path: "/", label: "Board", icon: SquareStack },
    { path: "/library", label: "Bibliothèque", icon: Library },
    { path: "/audio", label: "Audio", icon: Headphones },
    { path: "/settings", label: "Réglages", icon: Settings },
  ];

  return (
    <footer className="glass-card flex h-16 items-center justify-between border-t border-white/8 px-4">
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title={item.label}
            >
              <item.icon size={18} />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => stopAll()}
        className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/15"
      >
        <StopCircle size={16} /> Stop all
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void toggleLive()}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
            liveEnabled
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20"
              : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20",
          )}
          title={liveEnabled ? "Live activé" : "Live désactivé"}
        >
          {liveEnabled ? <RadioTower size={16} /> : <Radio size={16} />}
          <span className="hidden sm:inline">{liveEnabled ? "Live ON" : "Test local"}</span>
        </button>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sortie Discord / Live</span>
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={200}
              value={Math.round(sbVolume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                void setSoundboardVolume(v);
              }}
              className="premium-range h-1 w-24 cursor-pointer"
            />
            <span className="w-8 text-right text-xs text-muted-foreground">{Math.round(sbVolume * 100)}%</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
