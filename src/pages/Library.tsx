import { useEffect, useMemo, useState, type DragEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, Image, Keyboard, Plus, Search, Star, Trash2, Upload, Volume2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { eventToShortcut } from "@/lib/shortcuts";
import type { Sound } from "@/types";
import EmojiPicker from "@/components/EmojiPicker";

function isAudioPath(path: string) {
  return /\.(wav|mp3|flac|ogg|m4a)$/i.test(path);
}

function hasFileDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export default function Library() {
  const {
    categories: persistedCategories,
    createCategory,
    deleteCategory,
    fetchCategories,
    fetchHotkeys,
    fetchSounds,
    hotkeys,
    importFolder,
    importSoundFile,
    removeSound,
    removeSoundImage,
    renameSound,
    setHotkey,
    removeHotkey,
    setSoundCategory,
    setSoundIcon,
    setSoundImage,
    setSoundImageFromUrl,
    sounds,
    toggleFavorite,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [editShortcutValue, setEditShortcutValue] = useState("");
  const [pickerSoundId, setPickerSoundId] = useState<string | null>(null);
  const [imageMenuSoundId, setImageMenuSoundId] = useState<string | null>(null);
  const [imageUrlValue, setImageUrlValue] = useState("");

  useEffect(() => {
    fetchSounds();
    fetchCategories();
    fetchHotkeys();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerSoundId) {
        const picker = document.querySelector("[data-emoji-picker]");
        if (picker && !picker.contains(target)) setPickerSoundId(null);
      }
      if (imageMenuSoundId) {
        const menu = document.querySelector("[data-image-menu]");
        if (menu && !menu.contains(target)) setImageMenuSoundId(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [pickerSoundId, imageMenuSoundId]);

  const categories = useMemo(() => {
    return Array.from(new Set(persistedCategories.map((category) => category.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [persistedCategories]);

  const filteredSounds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sounds.filter((sound) => {
      if (favoritesOnly && !sound.favorite) return false;
      if (selectedCategory !== "all" && sound.category !== selectedCategory) return false;
      if (!q) return true;
      return sound.name.toLowerCase().includes(q) || sound.category.toLowerCase().includes(q) || sound.tags.toLowerCase().includes(q);
    });
  }, [favoritesOnly, query, selectedCategory, sounds]);

  const hotkeyMap = useMemo(() => new Map(hotkeys.map((h) => [h.sound_id, h])), [hotkeys]);

  const handleImportFile = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "flac", "ogg", "m4a"] }],
    });
    if (Array.isArray(selected) && selected.length > 0) {
      await importSoundFile(selected);
    }
  };

  const handleImportFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await importFolder(selected);
    }
  };

  const handleHtmlDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    setDragActive(false);
    const droppedPaths = Array.from(event.dataTransfer.files)
      .map((file) => (file as any).path as string | undefined)
      .filter(Boolean) as string[];
    for (const path of droppedPaths) {
      if (isAudioPath(path)) await importSoundFile(path);
      else await importFolder(path);
    }
  };

  const handleCategoryCreate = async () => {
    const next = newCategory.trim();
    if (!next) return;
    await createCategory(next);
    setNewCategory("");
  };

  const handleCategoryDelete = async (category: string) => {
    if (category === "General") return;
    await deleteCategory(category);
    if (selectedCategory === category) setSelectedCategory("all");
  };

  const startRename = (sound: Sound) => {
    setEditingName(sound.id);
    setEditNameValue(sound.name);
  };

  const commitRename = async (soundId: string) => {
    if (editNameValue.trim()) await renameSound(soundId, editNameValue.trim());
    setEditingName(null);
  };

  const startShortcutEdit = (soundId: string) => {
    const hk = hotkeyMap.get(soundId);
    setEditingShortcut(soundId);
    setEditShortcutValue(hk?.shortcut ?? "");
  };

  const commitShortcut = async (soundId: string) => {
    const value = editShortcutValue.trim();
    if (value) {
      await setHotkey({ id: "", sound_id: soundId, shortcut: value, global: false });
    } else {
      await removeHotkey(soundId);
    }
    setEditingShortcut(null);
  };

  const handleSetImage = async (soundId: string) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
    });
    if (typeof selected === "string") {
      await setSoundImage(soundId, selected);
    }
  };

  return (
    <div
      className="relative flex h-full flex-col gap-4 p-4"
      onDragOver={(e) => {
        if (!hasFileDrag(e)) return;
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleHtmlDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-primary/10 text-lg font-semibold text-primary backdrop-blur-sm">
          Dépose tes sons ou dossiers ici
        </div>
      )}

      {/* Header */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h1 className="premium-heading text-xl tracking-tight">Bibliothèque</h1>
          <p className="text-xs text-muted-foreground">{filteredSounds.length} sons · gestion et import</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleImportFile} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90">
            <Upload size={16} /> Importer
          </button>
          <button onClick={handleImportFolder} className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm hover:bg-primary/15">
            <FolderPlus size={16} /> Dossier
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            placeholder="Rechercher un son..."
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
          Toutes
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
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Nouvelle catégorie"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCategoryCreate()}
            className="w-32 rounded-full border border-white/8 bg-muted px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={() => void handleCategoryCreate()} className="rounded-full bg-muted p-1.5 hover:bg-primary/15">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="glass-card min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-2xl">
        {filteredSounds.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Search size={40} className="opacity-30" />
            <p className="text-sm">Aucun son trouvé</p>
            <p className="text-xs opacity-70">Importe des sons ou ajuste tes filtres</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredSounds.map((sound) => {
              const hk = hotkeyMap.get(sound.id);
              return (
                <div key={sound.id} className="group flex items-center gap-3 p-3 transition hover:bg-white/[0.03]">
                  {/* Image / icon */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setImageMenuSoundId(imageMenuSoundId === sound.id ? null : sound.id);
                        setImageUrlValue("");
                      }}
                      className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted hover:ring-2 hover:ring-primary/50"
                    >
                      {sound.image_path ? (
                        <SoundImage id={sound.id} />
                      ) : sound.icon ? (
                        <span className="text-xl">{sound.icon}</span>
                      ) : (
                        <Image size={18} className="text-muted-foreground" />
                      )}
                    </button>
                    {imageMenuSoundId === sound.id && (
                      <div data-image-menu className="glass-card absolute left-0 top-full z-50 mt-2 w-56 rounded-xl p-2 shadow-xl">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Image du son</p>
                        <button
                          onClick={() => {
                            void handleSetImage(sound.id);
                            setImageMenuSoundId(null);
                          }}
                          className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/10"
                        >
                          <Upload size={12} /> Choisir un fichier
                        </button>
                        <div className="flex gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={imageUrlValue}
                            onChange={(e) => setImageUrlValue(e.target.value)}
                            placeholder="https://..."
                            className="min-w-0 flex-1 rounded-lg border border-white/8 bg-background/60 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && imageUrlValue.trim()) {
                                void setSoundImageFromUrl(sound.id, imageUrlValue.trim());
                                setImageMenuSoundId(null);
                                setImageUrlValue("");
                              }
                            }}
                          />
                          <button
                            disabled={!imageUrlValue.trim()}
                            onClick={() => {
                              void setSoundImageFromUrl(sound.id, imageUrlValue.trim());
                              setImageMenuSoundId(null);
                              setImageUrlValue("");
                            }}
                            className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name + category */}
                  <div className="min-w-0 flex-1">
                    {editingName === sound.id ? (
                      <input
                        autoFocus
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onBlur={() => void commitRename(sound.id)}
                        onKeyDown={(e) => e.key === "Enter" && void commitRename(sound.id)}
                        className="w-full rounded-lg border border-white/8 bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      <p onClick={() => startRename(sound)} className="cursor-pointer truncate text-sm font-medium hover:text-primary">
                        {sound.name}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <select
                        value={sound.category}
                        onChange={(e) => void setSoundCategory(sound.id, e.target.value)}
                        className="premium-select rounded-md border border-white/8 bg-background/60 px-1.5 py-0.5 text-xs"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">{sound.play_count} plays</span>
                    </div>
                  </div>

                  {/* Volume */}
                  <SoundVolume sound={sound} />

                  {/* Hotkey */}
                  <div className="w-32">
                    {editingShortcut === sound.id ? (
                      <input
                        autoFocus
                        readOnly
                        value={editShortcutValue}
                        onKeyDown={(e) => {
                          e.preventDefault();
                          if (e.key === "Escape") {
                            setEditingShortcut(null);
                            return;
                          }
                          if (e.key === "Backspace" || e.key === "Delete") {
                            setEditShortcutValue("");
                            return;
                          }
                          const combo = eventToShortcut(e);
                          if (combo) setEditShortcutValue(combo);
                        }}
                        onBlur={() => void commitShortcut(sound.id)}
                        placeholder="Appuie..."
                        className="w-full rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary"
                      />
                    ) : (
                      <button
                        onClick={() => startShortcutEdit(sound.id)}
                        className={cn(
                          "inline-flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs transition",
                          hk ? "border-primary/30 bg-primary/10 text-primary" : "border-white/8 bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Keyboard size={12} /> {hk ? hk.shortcut : "Hotkey"}
                      </button>
                    )}
                  </div>

                  {/* Icon emoji */}
                  <div className="relative">
                    <button
                      onClick={() => setPickerSoundId(pickerSoundId === sound.id ? null : sound.id)}
                      className="rounded-lg bg-muted px-2 py-1.5 text-sm hover:bg-primary/15"
                      title="Icône"
                    >
                      {sound.icon || "—"}
                    </button>
                    {pickerSoundId === sound.id && (
                      <EmojiPicker
                        value={sound.icon}
                        onSelect={(icon) => {
                          void setSoundIcon(sound.id, icon);
                          setPickerSoundId(null);
                        }}
                        onClose={() => setPickerSoundId(null)}
                      />
                    )}
                  </div>

                  {/* Favorite */}
                  <button
                    onClick={() => void toggleFavorite(sound.id, !sound.favorite)}
                    className={cn("rounded-lg p-2 transition", sound.favorite ? "text-amber-400" : "text-muted-foreground hover:text-foreground")}
                  >
                    <Star size={16} fill={sound.favorite ? "currentColor" : "none"} />
                  </button>

                  {/* Remove image */}
                  {sound.image_path && (
                    <button onClick={() => void removeSoundImage(sound.id)} className="text-muted-foreground hover:text-foreground" title="Retirer l'image">
                      <Image size={16} />
                    </button>
                  )}

                  {/* Delete */}
                  <button onClick={() => void removeSound(sound.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SoundImage({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke<string | null>("get_sound_image_base64", { id }).then((url) => {
        if (!cancelled && url) setSrc(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (!src) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

function SoundVolume({ sound }: { sound: Sound }) {
  const { setSoundVolume } = useAppStore();
  const [local, setLocal] = useState(Math.round(sound.volume * 100));
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) setLocal(Math.round(sound.volume * 100));
  }, [sound.volume, isDragging]);

  const commit = (value: number) => {
    void setSoundVolume(sound.id, value / 100, sound.custom_volume);
  };

  return (
    <div className="hidden w-36 flex-col gap-1 sm:flex">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={sound.custom_volume}
            onChange={(e) => {
              const enabled = e.target.checked;
              void setSoundVolume(sound.id, enabled ? sound.volume : 1, enabled);
            }}
            className="premium-checkbox h-3 w-3 rounded-[0.2rem]"
            title="Volume personnalisé"
          />
          <Volume2 size={12} />
        </div>
        <span>{sound.custom_volume ? `${local}%` : "Défaut"}</span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        value={local}
        disabled={!sound.custom_volume}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={(e) => {
          setIsDragging(false);
          commit(Number(e.currentTarget.value));
        }}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End") {
            commit(Number(e.currentTarget.value));
          }
        }}
        className={cn("premium-range h-1 w-full cursor-pointer", !sound.custom_volume && "opacity-40")}
      />
    </div>
  );
}
