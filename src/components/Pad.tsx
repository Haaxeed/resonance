import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

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
  playCount,
  imagePath,
  size = 140,
  active,
  reorderMode,
  dragListeners,
  dragAttributes,
  dragOver,
}: PadProps) {
  const { playSound } = useAppStore();
  const [imgUrl, setImgUrl] = useState<string | null>(null);

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

  const visualSize = Math.round(size * 0.72);
  const fontSize = Math.max(26, Math.round(size * 0.32));

  return (
    <div
      title={name}
      onClick={reorderMode ? undefined : () => playSound(soundId)}
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
    </div>
  );
}
