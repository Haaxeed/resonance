import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import type { Hotkey, Sound } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { eventToShortcut, shortcutHasModifier } from "@/lib/shortcuts";
import SoundIconPicker from "./SoundIconPicker";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronDown, GripVertical, Image as ImageIcon, Keyboard, Play, RotateCcw, Save, Star, Tag, Trash2 } from "lucide-react";

const INTERNAL_DRAG_TYPE = "application/x-sbu-sound";

interface Props {
  sound: Sound;
  hotkey?: Hotkey;
  categories: string[];
  draggable?: boolean;
  isDragSource?: boolean;
  isDragTarget?: boolean;
  onPointerPick?: () => void;
  onPointerHover?: () => void;
  onPointerRelease?: () => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}

export default function SoundListItem({
  sound,
  hotkey,
  categories,
  draggable,
  isDragSource,
  isDragTarget,
  onPointerPick,
  onPointerHover,
  onPointerRelease,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const {
    playSound,
    toggleFavorite,
    removeSound,
    setHotkey,
    removeHotkey,
    setSoundVolume,
    renameSound,
    setSoundCategory,
    setSoundIcon,
    setSoundImage,
    removeSoundImage,
  } = useAppStore();

  const [draftShortcut, setDraftShortcut] = useState(hotkey?.shortcut ?? "");
  const [recording, setRecording] = useState(false);
  const [volume, setVolume] = useState(sound.volume ?? 1);
  const [customVolume, setCustomVolume] = useState(sound.custom_volume ?? false);
  const [draftName, setDraftName] = useState(sound.name);
  const [draftCategory, setDraftCategory] = useState(sound.category);

  useEffect(() => {
    setDraftShortcut(hotkey?.shortcut ?? "");
  }, [hotkey?.shortcut]);

  useEffect(() => {
    setVolume(sound.volume ?? 1);
    setCustomVolume(sound.custom_volume ?? false);
    setDraftName(sound.name);
    setDraftCategory(sound.category);
  }, [sound.volume, sound.custom_volume, sound.name, sound.category]);

  const hotkeyChanged = useMemo(() => draftShortcut !== (hotkey?.shortcut ?? ""), [draftShortcut, hotkey?.shortcut]);
  const nameChanged = draftName.trim() !== sound.name;

  const saveShortcut = async () => {
    if (!draftShortcut.trim()) {
      await removeHotkey(sound.id);
      return;
    }
    if (!shortcutHasModifier(draftShortcut.trim())) {
      window.alert("Les hotkeys globales doivent inclure Ctrl, Alt, Shift ou Win pour ne pas bloquer Windows/les jeux.");
      return;
    }
    await setHotkey({
      id: hotkey?.id ?? crypto.randomUUID(),
      sound_id: sound.id,
      shortcut: draftShortcut.trim(),
      global: true,
    });
  };

  const saveName = async () => {
    const next = draftName.trim();
    if (!next || !nameChanged) return;
    await renameSound(sound.id, next);
  };

  const resetVolume = async () => {
    setVolume(1);
    setCustomVolume(false);
    await setSoundVolume(sound.id, 1, false);
  };

  const pickImage = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
    });
    if (selected && typeof selected === "string") {
      await setSoundImage(sound.id, selected);
    }
  };

  const commitVolume = async () => {
    await setSoundVolume(sound.id, volume, customVolume);
  };

  const fileName = sound.path.split(/[/\\]/).pop() ?? sound.path;

  return (
    <div
      className={`rounded-2xl border bg-card/80 px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-sm transition hover:shadow-[0_12px_36px_rgba(0,0,0,0.2)] ${isDragSource ? "border-primary ring-2 ring-primary/30 opacity-80" : isDragTarget ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-white/8 hover:border-primary/30"}`}
      onMouseEnter={() => {
        if (draggable) onPointerHover?.();
      }}
      onMouseUp={() => {
        if (draggable) onPointerRelease?.();
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          draggable={draggable}
          onMouseDown={(e: MouseEvent<HTMLButtonElement>) => {
            if (!draggable) return;
            e.preventDefault();
            onPointerPick?.();
          }}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData(INTERNAL_DRAG_TYPE, sound.id);
            e.dataTransfer.setData("text/plain", sound.id);
            onDragStart?.(e as unknown as DragEvent<HTMLDivElement>);
          }}
          onDragEnd={onDragEnd}
          className="mt-1 cursor-grab rounded-lg p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          title="Déplacer"
        >
          <GripVertical size={15} />
        </button>

        <button
          onClick={() => playSound(sound.id)}
          className="mt-0.5 rounded-xl bg-primary/15 p-2 text-primary transition hover:bg-primary/25"
          title="Jouer"
        >
          <Play size={14} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <SoundIconPicker icon={sound.icon} onChange={(icon) => setSoundIcon(sound.id, icon)} />
            <button
              onClick={pickImage}
              className={sound.image_path ? "rounded-lg p-1.5 text-primary hover:bg-primary/10" : "rounded-lg p-1.5 text-muted-foreground hover:bg-muted"}
              title={sound.image_path ? "Changer l'image" : "Ajouter une image"}
            >
              <ImageIcon size={14} />
            </button>
            {sound.image_path && (
              <button
                onClick={() => removeSoundImage(sound.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Retirer l'image"
              >
                <Trash2 size={14} />
              </button>
            )}
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={saveName}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  await saveName();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold outline-none transition focus:border-border focus:bg-background/60"
            />
            <button
              onClick={() => toggleFavorite(sound.id, !sound.favorite)}
              className={sound.favorite ? "rounded-lg p-1.5 text-amber-400 hover:bg-amber-500/10" : "rounded-lg p-1.5 text-muted-foreground hover:bg-muted"}
              title={sound.favorite ? "Retirer des favoris" : "Mettre en favori"}
            >
              <Star size={14} fill={sound.favorite ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => removeSound(sound.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-background/70 px-2 py-0.5">{(sound.duration_ms / 1000).toFixed(1)}s</span>
            <span className="max-w-[220px] truncate" title={fileName}>{fileName}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary/90" title="Nombre de lectures">{sound.play_count} ✓</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_180px_170px]">
        <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-background/60 px-2 py-2">
          <Tag size={13} className="shrink-0 text-muted-foreground" />
          <div className="relative min-w-0 flex-1">
            <select
              value={draftCategory}
              onChange={async (e) => {
                const next = e.target.value;
                setDraftCategory(next);
                if (next.trim() && next !== sound.category) {
                  await setSoundCategory(sound.id, next);
                }
              }}
              className="premium-select min-w-0 w-full truncate rounded-lg border border-white/8 bg-card/70 py-1.5 pl-3 pr-8 text-xs text-foreground outline-none"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === "General" ? "General (tous les sons)" : category}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-background/60 px-2 py-2">
          <Keyboard size={13} className="shrink-0 text-muted-foreground" />
          <input
            type="text"
            readOnly
            value={recording ? "Appuie..." : draftShortcut}
            onFocus={() => setRecording(true)}
            onBlur={() => setRecording(false)}
            onKeyDown={(e) => {
              e.preventDefault();
              if (e.key === "Backspace" || e.key === "Delete") {
                setDraftShortcut("");
                setRecording(false);
                return;
              }
              const combo = eventToShortcut(e);
              if (!combo) return;
              setDraftShortcut(combo);
              setRecording(false);
            }}
            placeholder="Ctrl+Alt+1"
            className="min-w-0 flex-1 truncate bg-transparent text-xs outline-none"
          />
          <button
            onClick={saveShortcut}
            disabled={!hotkeyChanged}
            className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
            title="Sauver hotkey"
          >
            <Save size={12} />
          </button>
        </div>

        <div className="rounded-xl border border-white/6 bg-background/60 px-2 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="premium-checkbox"
                checked={customVolume}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setCustomVolume(next);
                  await setSoundVolume(sound.id, volume, next);
                }}
              />
              Volume perso
            </label>
            <button onClick={resetVolume} className="rounded-md p-1 hover:bg-muted" title="Reset volume">
              <RotateCcw size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={12}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              onMouseUp={commitVolume}
              onTouchEnd={commitVolume}
              className="premium-range w-full"
            />
            <span className="w-10 text-right text-[11px] text-muted-foreground">{customVolume ? `${Math.round(volume * 100)}%` : "Resonance"}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-primary/90">Hotkey globale active hors focus</div>
    </div>
  );
}

export { INTERNAL_DRAG_TYPE as SOUND_DRAG_TYPE };
