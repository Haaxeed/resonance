import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

const appWindow = getCurrentWindow();

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.onResized(() => {
      void appWindow.isMaximized().then(setIsMaximized);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-md select-none"
      data-tauri-drag-region
    >
      <div className="w-28 pl-3" data-tauri-drag-region />

      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
        data-tauri-drag-region
      >
        <img
          src="/assets/logo-titlebar-48.png"
          alt=""
          className="h-6 w-6 object-contain drop-shadow-[0_0_8px_hsla(var(--primary)_/_0.6)]"
          draggable={false}
        />
        <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-base font-bold tracking-wide text-transparent">
          Resonance
        </span>
      </div>

      <div className="flex items-center" data-tauri-drag-region>
        <button
          onClick={() => void appWindow.minimize()}
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          title="Réduire"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => void appWindow.toggleMaximize()}
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          title={isMaximized ? "Restaurer" : "Agrandir"}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => void appWindow.close()}
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition hover:bg-red-500/90 hover:text-white"
          title="Fermer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
