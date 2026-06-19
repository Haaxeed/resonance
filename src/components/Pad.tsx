import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Pencil, Keyboard, Smile, ImagePlus, Link, Trash2, FolderX, Tag, X } from "lucide-react";

interface PadProps {
  soundId: string;
  name: string;
  icon?: string | null;
  shortcut?: string | null;
  category?: string | null;
  playCount?: number;
  imagePath?: string | null;
  size?: number;
  active?: boolean;
  reorderMode?: boolean;
  dragListeners?: React.HTMLAttributes<HTMLElement>;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  dragOver?: boolean;
}

export default function Pad({
  soundId,
  name,
  icon,
  shortcut,
  category,
  playCount,
  imagePath,
  size = 140,
  active,
  reorderMode,
  dragListeners,
  dragAttributes,
  dragOver,
}: PadProps) {
  const {
    playSound,
    renameSound,
    setHotkey,
    setSoundIcon,
    setSoundCategory,
    setSoundImage,
    setSoundImageFromUrl,
    removeSoundImage,
    removeSound,
    removeBoardItem,
    categories,
    fetchCategories,
  } = useAppStore();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!imagePath) {
      setImgUrl(null);
      return;
    }
    let cancelled = false;
    invoke<string | null>("get_sound_image_base64", { id: soundId })
      .then((url) => {
        if (!cancelled) setImgUrl(url);
      })
      .catch(() => setImgUrl(null));
    return () => {
      cancelled = true;
    };
  }, [imagePath, soundId]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (reorderMode) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = () => {
    setMenu(null);
    const next = window.prompt("Nouveau nom", name);
    if (next && next.trim() && next.trim() !== name) {
      void renameSound(soundId, next.trim());
    }
  };

  const handleIcon = () => {
    setMenu(null);
    const next = window.prompt("Icône (emoji ou caractère)", icon || "🎵");
    if (next === null) return;
    void setSoundIcon(soundId, next.trim() || null);
  };

  const handleCategory = async () => {
    setMenu(null);
    await fetchCategories();
    const opts = categories.length ? categories.join(", ") : "aucune";
    const next = window.prompt(`Catégorie (${opts})`, category || "");
    if (next === null) return;
    void setSoundCategory(soundId, next.trim());
  };

  const handleImageFile = async () => {
    setMenu(null);
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    if (typeof selected === "string") {
      void setSoundImage(soundId, selected);
    }
  };

  const handleImageUrl = () => {
    setMenu(null);
    const next = window.prompt("URL de l'image", "");
    if (next && next.trim()) {
      void setSoundImageFromUrl(soundId, next.trim());
    }
  };

  const handleRemoveImage = () => {
    setMenu(null);
    void removeSoundImage(soundId);
  };

  const handleHotkey = () => {
    setMenu(null);
    const next = window.prompt("Raccourci clavier", shortcut || "");
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) {
      void setHotkey({ id: soundId, sound_id: soundId, shortcut: "", global: true });
    } else {
      void setHotkey({ id: soundId, sound_id: soundId, shortcut: trimmed, global: true });
    }
  };

  const handleRemoveFromBoard = () => {
    setMenu(null);
    void removeBoardItem("default", soundId);
  };

  const handleDeleteSound = () => {
    setMenu(null);
    if (window.confirm("Supprimer ce son de la bibliothèque ? Cette action est irréversible.")) {
      void removeSound(soundId);
    }
  };

  const visualSize = Math.round(size * 0.72);
  const fontSize = Math.max(26, Math.round(size * 0.32));

  return (
    <div
      title={name}
      onClick={reorderMode ? undefined : () => playSound(soundId)}
      onContextMenu={handleContextMenu}
      className={cn(
        "group flex select-none flex-col items-center gap-2 text-center transition-all duration-150",
        reorderMode ? "cursor-default" : "cursor-pointer active:scale-[0.96]",
        dragOver && "scale-[1.04]",
      )}
      style={{ width: size }}
    >
      <div
        className={cn(
          "glass-pad relative flex items-center justify-center overflow-hidden rounded-full transition-all duration-200",
          active
            ? "scale-[1.03] border-[#8b5cf6] shadow-[0_0_32px_rgba(139,92,246,0.65),inset_0_0_20px_rgba(139,92,246,0.25)]"
            : "border-white/10 group-hover:border-[#8b5cf6]/60 group-hover:shadow-[0_0_24px_rgba(139,92,246,0.30)]",
          reorderMode && "border-2 border-dashed border-primary/40 cursor-grab active:cursor-grabbing",
        )}
        style={{
          width: visualSize,
          height: visualSize,
        }}
        {...dragAttributes}
        {...dragListeners}
      >
        {active && <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-[#8b5cf6]/20" />}
        {dragOver && <div className="pointer-events-none absolute inset-0 rounded-full bg-primary/20" />}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={name}
            className="h-full w-full object-cover"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        ) : icon ? (
          <span className="leading-none drop-shadow" style={{ fontSize: `${fontSize}px` }}>{icon}</span>
        ) : (
          <span className="font-bold text-foreground/40" style={{ fontSize: `${Math.max(20, size * 0.22)}px` }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}

        {/* Hotkey overlay on hover */}
        {shortcut && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 opacity-0 backdrop-blur-[3px] transition-opacity group-hover:opacity-100">
            <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              {shortcut}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span
          className="line-clamp-2 w-full break-words px-1 font-semibold leading-tight text-foreground/90"
          style={{ fontSize: `${Math.max(11, size * 0.095)}px` }}
        >
          {name}
        </span>
        {typeof playCount === "number" && (
          <span className="text-[10px] font-medium text-muted-foreground/80">{playCount} plays</span>
        )}
      </div>

      {menu && (
        <div
          className="fixed z-[100] min-w-[200px] overflow-hidden rounded-xl border border-border bg-popover/95 p-1 shadow-2xl backdrop-blur-xl"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleRename}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <Pencil size={14} /> Renommer
          </button>
          <button
            onClick={handleIcon}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <Smile size={14} /> Changer l'icône
          </button>
          <button
            onClick={handleCategory}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <Tag size={14} /> Catégorie
          </button>

          <div className="my-1 h-px bg-border" />

          <button
            onClick={handleImageFile}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <ImagePlus size={14} /> Image depuis fichier
          </button>
          <button
            onClick={handleImageUrl}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <Link size={14} /> Image depuis URL
          </button>
          {imagePath && (
            <button
              onClick={handleRemoveImage}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <X size={14} /> Retirer l'image
            </button>
          )}

          <div className="my-1 h-px bg-border" />

          <button
            onClick={handleHotkey}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <Keyboard size={14} /> Raccourci clavier
          </button>

          <div className="my-1 h-px bg-border" />

          <button
            onClick={handleRemoveFromBoard}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-primary/10"
          >
            <FolderX size={14} /> Retirer du board
          </button>
          <button
            onClick={handleDeleteSound}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} /> Supprimer de la bibliothèque
          </button>
        </div>
      )}
    </div>
  );
}
