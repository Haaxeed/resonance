import { useEffect, useMemo, useState } from "react";
import { GripVertical, Layers, LayoutGrid, Search, Star, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import PadGrid from "@/components/PadGrid";

export default function Dashboard() {
  const {
    categories: persistedCategories,
    deleteCategory,
    fetchCategories,
    fetchHotkeys,
    fetchSounds,
    hotkeys,
    padSize,
    saveSettings,
    setMonitorVolume,
    setPadSize,
    settings,
    sounds,
    syncWatchedFolders,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    fetchSounds();
    fetchCategories();
    fetchHotkeys();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      syncWatchedFolders();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [syncWatchedFolders]);

  const categories = useMemo(() => {
    return Array.from(new Set(persistedCategories.map((category) => category.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [persistedCategories]);

  const filteredSounds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sounds.filter((sound) => {
      if (favoritesOnly && !sound.favorite) return false;
      const matchesCategory = selectedCategory === "all" || selectedCategory === "General" || sound.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return sound.name.toLowerCase().includes(q) || sound.category.toLowerCase().includes(q) || sound.tags.toLowerCase().includes(q);
    });
  }, [favoritesOnly, query, selectedCategory, sounds]);

  const handleCategoryDelete = async (category: string) => {
    if (category === "General") return;
    await deleteCategory(category);
    if (selectedCategory === category) setSelectedCategory("all");
  };

  const monitorVolume = settings?.monitor_volume ?? 1;

  return (
    <div className="relative flex h-full flex-col gap-4 p-4">
      {/* Header compact */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/20">
            <LayoutGrid size={20} />
          </div>
          <h1 className="premium-heading text-xl tracking-tight">Board</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Volume écoute personnelle */}
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-background/55 px-3 py-1.5">
            <Volume2 size={14} className="text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Écoute</span>
            <input
              type="range"
              min={0}
              max={400}
              value={Math.round(monitorVolume * 100)}
              onChange={(e) => {
                void setMonitorVolume(Number(e.target.value) / 100);
              }}
              className="premium-range h-1 w-20 cursor-pointer"
            />
            <span className="w-8 text-right text-xs text-muted-foreground">{Math.round(monitorVolume * 100)}%</span>
          </div>

          {/* Toggle overlap */}
          <button
            onClick={() => {
              if (!settings) return;
              const next = !settings.overlap_enabled;
              void saveSettings({ ...settings, overlap_enabled: next });
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              settings?.overlap_enabled ?? true
                ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_12px_rgba(var(--primary)_0.25)]"
                : "border-white/8 bg-background/55 text-muted-foreground hover:text-foreground",
            )}
            title={settings?.overlap_enabled ?? true ? "Plusieurs sons peuvent se superposer" : "Un seul son à la fois"}
          >
            <Layers size={14} />
            {settings?.overlap_enabled ?? true ? "Overlap" : "Solo"}
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-background/55 px-1.5 py-1">
            <button onClick={() => setPadSize(padSize - 12)} className="rounded-lg p-1.5 hover:bg-primary/15" title="Réduire">
              <ZoomOut size={14} />
            </button>
            <span className="min-w-[2rem] text-center text-xs text-muted-foreground">{padSize}px</span>
            <button onClick={() => setPadSize(padSize + 12)} className="rounded-lg p-1.5 hover:bg-primary/15" title="Agrandir">
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Mode réorganiser */}
          <button
            onClick={() => setReorderMode((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              reorderMode
                ? "border-primary/50 bg-primary/20 text-primary shadow-[0_0_12px_rgba(var(--primary)_0.25)]"
                : "border-white/8 bg-background/55 text-muted-foreground hover:text-foreground",
            )}
            title={reorderMode ? "Désactiver la réorganisation" : "Réorganiser les pads"}
          >
            <GripVertical size={14} />
            {reorderMode ? "Terminer" : "Réorganiser"}
          </button>
        </div>
      </div>

      {/* Filtres simplifiés */}
      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            placeholder="Filtrer les sons..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-white/8 bg-background/60 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={() => setFavoritesOnly((prev) => !prev)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
            favoritesOnly ? "bg-amber-500/15 text-amber-300" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <Star size={12} /> Favoris
        </button>

        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            selectedCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Tous
        </button>

        {categories.map((category) => (
          <div
            key={category}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 transition",
              selectedCategory === category ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <button onClick={() => setSelectedCategory(category)} className="rounded-full px-1 py-0.5 text-xs font-medium">
              {category}
            </button>
            {category !== "General" && (
              <button onClick={() => void handleCategoryDelete(category)} className="rounded-full p-1 hover:bg-black/10" title={`Supprimer ${category}`}>
                <span className="text-xs">×</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className={cn("min-h-0 flex-1 overflow-y-auto rounded-2xl p-1 pt-4", reorderMode && "bg-primary/5 ring-1 ring-inset ring-primary/20")}>
        <PadGrid
          sounds={filteredSounds}
          hotkeyMap={useMemo(() => new Map(hotkeys.map((h) => [h.sound_id, h])), [hotkeys])}
          reorderMode={reorderMode}
        />
      </div>
    </div>
  );
}
