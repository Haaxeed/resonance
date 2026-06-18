type ShortcutKeyboardEvent = {
  key: string;
  code?: string;
  location?: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

const MODIFIER_ALIASES: Record<string, string> = {
  ctrl: "CmdOrControl",
  control: "CmdOrControl",
  cmd: "Meta",
  command: "Meta",
  cmdorcontrol: "CmdOrControl",
  commandorcontrol: "CmdOrControl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  meta: "Meta",
  super: "Meta",
  win: "Meta",
  windows: "Meta",
};

const KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  del: "Delete",
  return: "Enter",
  plus: "Plus",
  spacebar: "Space",
  pause: "Pause",
  scrolllock: "ScrollLock",
  mediaplay: "MediaPlayPause",
  mediaplaypause: "MediaPlayPause",
  mediastop: "MediaStop",
  medianext: "MediaNextTrack",
  mediaprev: "MediaPrevTrack",
  mediaprevious: "MediaPrevTrack",
  volumeup: "VolumeUp",
  volumedown: "VolumeDown",
  volumemute: "VolumeMute",
};

export function normalizeKeyName(key: string) {
  if (key === " ") return "Space";
  if (key === "Escape") return "Esc";
  if (/^(F1[3-9]|F2[0-4])$/i.test(key)) return key.toUpperCase();
  if (/^(MediaPlayPause|MediaStop|MediaNextTrack|MediaPrevTrack|MediaTrackNext|MediaTrackPrevious|VolumeUp|VolumeDown|VolumeMute)$/i.test(key)) {
    return key.replace(/^MediaTrack/, "Media");
  }
  if (key.length === 1) return key.toUpperCase();
  return key[0].toUpperCase() + key.slice(1);
}

function normalizePhysicalKey(event: ShortcutKeyboardEvent) {
  const code = event.code ?? "";
  const key = event.key;
  const hasModifier = event.ctrlKey || event.altKey || event.metaKey;

  // When modifiers are held, use physical code so Alt+5 isn't Alt+{ on AZERTY
  if (hasModifier) {
    if (/^Digit([0-9])$/.test(code)) return code.slice(5);
    if (/^Key([A-Z])$/.test(code)) return code.slice(3);
    if (/^Numpad[0-9]$/.test(code)) return `Num${code.slice(-1)}`;
    if (code === "NumpadAdd") return "NumAdd";
    if (code === "NumpadSubtract") return "NumSubtract";
    if (code === "NumpadMultiply") return "NumMultiply";
    if (code === "NumpadDivide") return "NumDivide";
    if (code === "NumpadDecimal") return "NumDecimal";
    if (code === "NumpadEnter") return "NumEnter";
  }

  // Prefer logical character for layout-specific keys (², é, è, à, etc.)
  if (key && key.length === 1 && key !== " ") {
    return key;
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return `Num${code.slice(-1)}`;
  }

  if (code === "NumpadAdd") return "NumAdd";
  if (code === "NumpadSubtract") return "NumSubtract";
  if (code === "NumpadMultiply") return "NumMultiply";
  if (code === "NumpadDivide") return "NumDivide";
  if (code === "NumpadDecimal") return "NumDecimal";
  if (code === "NumpadEnter") return "NumEnter";
  if (/^Digit([0-9])$/.test(code)) return code.slice(5);
  if (/^Key([A-Z])$/.test(code)) return code.slice(3);
  if (code === "Period") return ".";
  if (code === "Comma") return ",";
  if (code === "Slash") return "/";
  if (code === "Backslash") return "\\";
  if (code === "Semicolon") return ";";
  if (code === "Quote") return "²";
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";
  if (code === "Backquote") return "`";

  return normalizeKeyName(event.key);
}

export function eventToShortcut(event: ShortcutKeyboardEvent) {
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return "";
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(normalizePhysicalKey(event));
  return parts.join("+");
}

export function shortcutToTauriAccelerator(shortcut: string) {
  const rawParts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!rawParts.length) return "";

  const modifiers: string[] = [];
  let key = "";

  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (MODIFIER_ALIASES[lower]) {
      const modifier = MODIFIER_ALIASES[lower];
      if (!modifiers.includes(modifier)) modifiers.push(modifier);
      continue;
    }

    key = KEY_ALIASES[lower] ?? (part.length === 1 ? part.toUpperCase() : part);
    if (/^[0-9]$/.test(key)) key = `Digit${key}`;
    if (/^[A-Z]$/.test(key)) key = `Key${key}`;
  }

  return [...modifiers, key].filter(Boolean).join("+");
}

export function shortcutIsGameFriendly(shortcut: string) {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return parts.some((part) =>
    /^(f1[3-9]|f2[0-4])$/.test(part) ||
    [
      "mediaplaypause",
      "mediastop",
      "medianexttrack",
      "mediaprevtrack",
      "mediaprevious",
      "mediatracknext",
      "mediatrackprevious",
      "volumeup",
      "volumedown",
      "volumemute",
    ].includes(part),
  );
}

export function shortcutHasModifier(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => Boolean(MODIFIER_ALIASES[part.toLowerCase()]));
}

export function shortcutLooksReservedOnWindows(shortcut: string) {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const hasEscape = parts.includes("esc") || parts.includes("escape");
  if (!hasEscape) return false;

  return parts.some((part) => ["ctrl", "control", "cmdorcontrol", "commandorcontrol", "alt", "shift", "meta", "win", "windows"].includes(part));
}
