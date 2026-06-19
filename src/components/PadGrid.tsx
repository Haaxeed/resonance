import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { Hotkey, Sound } from "@/types";
import Pad from "./Pad";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface PadGridProps {
  sounds: Sound[];
  hotkeyMap: Map<string, Hotkey>;
  reorderMode?: boolean;
}

function SortablePad({
  sound,
  hotkeyMap,
  padSize,
  playingSounds,
}: {
  sound: Sound;
  hotkeyMap: Map<string, Hotkey>;
  padSize: number;
  playingSounds: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sound.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "opacity-50")}
    >
      <Pad
        soundId={sound.id}
        name={sound.name}
        icon={sound.icon}
        shortcut={hotkeyMap.get(sound.id)?.shortcut}
        category={sound.category}
        playCount={sound.play_count}
        imagePath={sound.image_path}
        size={padSize}
        active={playingSounds.has(sound.id)}
        reorderMode
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
}

export default function PadGrid({ sounds, hotkeyMap, reorderMode }: PadGridProps) {
  const { playingSounds, padSize, reorderSounds } = useAppStore();
  const [items, setItems] = useState<Sound[]>(sounds);

  // Keep local items in sync when sounds change externally or reorderMode toggles
  if (sounds.map((s) => s.id).join(",") !== items.map((s) => s.id).join(",")) {
    setItems(sounds);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    void reorderSounds(next.map((s) => s.id));
  };

  if (sounds.length === 0) {
    return (
      <div className="glass-card flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 p-8 text-center text-muted-foreground">
        <div className="text-5xl opacity-30">🎵</div>
        <div className="text-lg font-medium">Aucun son ici</div>
        <p className="max-w-md text-sm">Importe des fichiers audio dans la Bibliothèque pour commencer. Les sons apparaissent automatiquement ici.</p>
      </div>
    );
  }

  if (reorderMode) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div
            className="grid justify-items-center gap-4 pb-4"
            style={{ gridTemplateColumns: `repeat(auto-fill, ${padSize}px)` }}
          >
            {items.map((sound) => (
              <SortablePad
                key={sound.id}
                sound={sound}
                hotkeyMap={hotkeyMap}
                padSize={padSize}
                playingSounds={playingSounds}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <div
      className="grid justify-items-center gap-4 pb-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${padSize}px)` }}
    >
      {sounds.map((sound) => (
        <Pad
          key={sound.id}
          soundId={sound.id}
          name={sound.name}
          icon={sound.icon}
          shortcut={hotkeyMap.get(sound.id)?.shortcut}
          category={sound.category}
          playCount={sound.play_count}
          imagePath={sound.image_path}
          size={padSize}
          active={playingSounds.has(sound.id)}
        />
      ))}
    </div>
  );
}
