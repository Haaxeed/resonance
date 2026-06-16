import { useAppStore } from "@/store/useAppStore";
import { Mic, Music } from "lucide-react";
import { useEffect, useState } from "react";

export default function VolumeMixer() {
  const { settings, setVolumes } = useAppStore();
  const [mic, setMic] = useState(settings?.mic_volume ?? 1);
  const [sb, setSb] = useState(settings?.soundboard_volume ?? 1);

  useEffect(() => {
    setMic(settings?.mic_volume ?? 1);
    setSb(settings?.soundboard_volume ?? 1);
  }, [settings]);

  const commit = () => {
    setVolumes(mic, settings?.master_volume ?? 1, sb);
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-border bg-card/80 p-4 shadow-sm lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <Mic size={16} className="text-muted-foreground" />
            Micro
          </div>
          <span className="text-xs text-muted-foreground">{Math.round(mic * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={mic}
          onChange={(e) => setMic(parseFloat(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          className="premium-range w-full"
        />
      </div>

      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <Music size={16} className="text-primary" />
            Soundboard
          </div>
          <span className="text-xs text-muted-foreground">{Math.round(sb * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={12}
          step={0.05}
          value={sb}
          onChange={(e) => setSb(parseFloat(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          className="premium-range w-full"
        />
      </div>
    </div>
  );
}
