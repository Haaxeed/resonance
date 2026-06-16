import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Smile, X } from "lucide-react";

interface EmojiOption {
  emoji: string;
  name: string;
  keywords: string;
}

const EMOJI_OPTIONS: EmojiOption[] = [
  // Musique / son
  { emoji: "\ud83c\udfb5", name: "note", keywords: "musique note son" },
  { emoji: "\ud83c\udfb6", name: "notes", keywords: "musique notes son" },
  { emoji: "\ud83d\udd0a", name: "volume", keywords: "son volume haut-parleur" },
  { emoji: "\ud83d\udce2", name: "megaphone", keywords: "son annonce megaphone" },
  { emoji: "\ud83c\udfa4", name: "micro", keywords: "micro chant voix" },
  { emoji: "\ud83c\udfa7", name: "casque", keywords: "casque audio ecoute" },
  { emoji: "\ud83c\udfba", name: "trompette", keywords: "trompette cuivre" },
  { emoji: "\ud83c\udfb7", name: "saxophone", keywords: "saxophone jazz" },
  { emoji: "\ud83c\udfb8", name: "guitare", keywords: "guitare rock" },
  { emoji: "\ud83e\udd41", name: "drum", keywords: "batterie drum percussions" },
  { emoji: "\ud83c\udfb9", name: "piano", keywords: "piano clavier" },
  { emoji: "\ud83d\udd14", name: "cloche", keywords: "cloche ring notification" },
  { emoji: "\ud83d\udea8", name: "alerte", keywords: "alerte sirene police" },
  { emoji: "\ud83d\udcef", name: "corne poste", keywords: "corne poste klaxon" },
  // Effets / impacts
  { emoji: "\ud83d\udca5", name: "impact", keywords: "impact explosion boom" },
  { emoji: "\u26a1", name: "eclair", keywords: "eclair foudre vitesse" },
  { emoji: "\ud83d\udd25", name: "feu", keywords: "feu flamme chaud" },
  { emoji: "\ud83d\udca3", name: "bombe", keywords: "bombe explosion" },
  { emoji: "\ud83d\udca6", name: "gouttes", keywords: "eau gouttes splash" },
  { emoji: "\ud83d\udca8", name: "vent", keywords: "vent fuite rapide" },
  { emoji: "\ud83d\udcab", name: "etincelle", keywords: "etincelle magie" },
  { emoji: "\ud83c\udf1f", name: "etoile", keywords: "etoile briller" },
  { emoji: "\u2b50", name: "star", keywords: "star etoile" },
  { emoji: "\u2728", name: "sparkles", keywords: "sparkles brillant" },
  // Gaming
  { emoji: "\ud83c\udfae", name: "manette", keywords: "jeu manette gaming" },
  { emoji: "\ud83c\udfaf", name: "cible", keywords: "cible viser" },
  { emoji: "\ud83c\udfb2", name: "des", keywords: "des chance random" },
  { emoji: "\ud83c\udfb0", name: "jackpot", keywords: "jackpot casino machine" },
  { emoji: "\ud83c\udfc6", name: "trophee", keywords: "trophee victoire gagne" },
  { emoji: "\ud83e\udd47", name: "medaille or", keywords: "or medaille victoire" },
  { emoji: "\ud83e\udd48", name: "medaille argent", keywords: "argent medaille" },
  { emoji: "\ud83e\udd49", name: "medaille bronze", keywords: "bronze medaille" },
  { emoji: "\ud83c\udf89", name: "party", keywords: "party fete confetti" },
  { emoji: "\ud83c\udf88", name: "ballon", keywords: "ballon fete" },
  { emoji: "\ud83e\udde8", name: "feu artifice", keywords: "feu artifice explosion" },
  // Animaux
  { emoji: "\ud83d\udc36", name: "chien", keywords: "chien aboiement" },
  { emoji: "\ud83d\udc31", name: "chat", keywords: "chat miaulement" },
  { emoji: "\ud83e\udd81", name: "lion", keywords: "lion rugissement" },
  { emoji: "\ud83d\udc38", name: "grenouille", keywords: "grenouille coassement" },
  { emoji: "\ud83d\udc37", name: "cochon", keywords: "cochon grognement" },
  { emoji: "\ud83d\udc2e", name: "vache", keywords: "vache meuglement" },
  { emoji: "\ud83d\udc34", name: "cheval", keywords: "cheval hennissement" },
  { emoji: "\ud83e\udd84", name: "licorne", keywords: "licorne magie" },
  { emoji: "\ud83d\udc19", name: "poulpe", keywords: "poulpe kraken" },
  { emoji: "\ud83d\udc27", name: "pingouin", keywords: "pingouin" },
  { emoji: "\ud83d\udc26", name: "oiseau", keywords: "oiseau chant" },
  { emoji: "\ud83d\udc0d", name: "serpent", keywords: "serpent sifflement" },
  { emoji: "\ud83d\udc3b", name: "ours", keywords: "ours grogne" },
  { emoji: "\ud83e\udd8a", name: "renard", keywords: "renard" },
  // Creatures / personnages
  { emoji: "\ud83d\udc7d", name: "alien", keywords: "alien extraterrestre" },
  { emoji: "\ud83d\udc7b", name: "fantome", keywords: "fantome halloween" },
  { emoji: "\ud83e\udd16", name: "robot", keywords: "robot bot voix" },
  { emoji: "\ud83e\udd21", name: "clown", keywords: "clown rire" },
  { emoji: "\ud83d\udc80", name: "crane", keywords: "crane mort danger" },
  { emoji: "\ud83e\udde0", name: "cerveau", keywords: "cerveau pense idee" },
  { emoji: "\ud83d\udc7a", name: "demon", keywords: "demon monstre" },
  { emoji: "\ud83e\uddcc", name: "ninja", keywords: "ninja stealth" },
  // Coeurs / emotions
  { emoji: "\u2764\ufe0f", name: "coeur", keywords: "coeur amour" },
  { emoji: "\ud83d\udc94", name: "coeur brise", keywords: "coeur brise triste" },
  { emoji: "\ud83d\udc9c", name: "coeur violet", keywords: "coeur violet" },
  { emoji: "\ud83d\udc99", name: "coeur bleu", keywords: "coeur bleu" },
  { emoji: "\ud83d\udc9a", name: "coeur vert", keywords: "coeur vert" },
  { emoji: "\ud83d\udc9b", name: "coeur jaune", keywords: "coeur jaune" },
  { emoji: "\ud83e\udd70", name: "amoureux", keywords: "amoureux yeux coeur" },
  { emoji: "\ud83d\ude02", name: "rire", keywords: "rire joyeux lol" },
  { emoji: "\ud83d\ude21", name: "colere", keywords: "colere enerve" },
  { emoji: "\ud83d\ude31", name: "peur", keywords: "peur cri surprise" },
  { emoji: "\ud83d\ude2d", name: "triste", keywords: "triste pleure" },
  { emoji: "\ud83e\udd22", name: "degoute", keywords: "degoute vomit" },
  { emoji: "\ud83d\udca4", name: "sommeil", keywords: "sommeil zzz" },
  // Nature / elements
  { emoji: "\u2600\ufe0f", name: "soleil", keywords: "soleil lumiere" },
  { emoji: "\ud83c\udf19", name: "lune", keywords: "lune nuit" },
  { emoji: "\u2601\ufe0f", name: "nuage", keywords: "nuage" },
  { emoji: "\u26c8\ufe0f", name: "orage", keywords: "orage tempete" },
  { emoji: "\u2744\ufe0f", name: "flocon", keywords: "flocon neige froid" },
  { emoji: "\ud83c\udf0a", name: "vague", keywords: "vague ocean mer" },
  { emoji: "\ud83c\udf08", name: "arc en ciel", keywords: "arc en ciel" },
  { emoji: "\ud83c\udf2b\ufe0f", name: "brouillard", keywords: "brouillard brume" },
  { emoji: "\ud83c\udf2a\ufe0f", name: "tornade", keywords: "tornade vent" },
  // Nourriture / boisson
  { emoji: "\ud83c\udf55", name: "pizza", keywords: "pizza" },
  { emoji: "\ud83c\udf54", name: "burger", keywords: "burger" },
  { emoji: "\ud83c\udf5f", name: "frites", keywords: "frites" },
  { emoji: "\ud83c\udf69", name: "donut", keywords: "donut" },
  { emoji: "\ud83c\udf6a", name: "cookie", keywords: "cookie" },
  { emoji: "\ud83c\udf6b", name: "chocolat", keywords: "chocolat" },
  { emoji: "\ud83c\udf7a", name: "biere", keywords: "biere" },
  { emoji: "\ud83c\udf77", name: "vin", keywords: "vin" },
  { emoji: "\u2615", name: "cafe", keywords: "cafe" },
  { emoji: "\ud83e\uddc3", name: "verre lait", keywords: "lait" },
  // Objets / outils
  { emoji: "\ud83d\udd28", name: "marteau", keywords: "marteau construction" },
  { emoji: "\u2694\ufe0f", name: "epee", keywords: "epee combat" },
  { emoji: "\ud83d\udee1\ufe0f", name: "bouclier", keywords: "bouclier defense" },
  { emoji: "\ud83c\udff9", name: "arc", keywords: "arc fleche" },
  { emoji: "\ud83d\udd0b", name: "batterie", keywords: "batterie energie" },
  { emoji: "\u26a0\ufe0f", name: "warning", keywords: "warning attention danger" },
  { emoji: "\ud83d\udeab", name: "interdit", keywords: "interdit stop" },
  { emoji: "\u2705", name: "check", keywords: "check valide ok" },
  { emoji: "\u274c", name: "croix", keywords: "croix erreur" },
  { emoji: "\u2753", name: "question", keywords: "question" },
  { emoji: "\u2757", name: "exclamation", keywords: "exclamation" },
  { emoji: "\ud83d\udca1", name: "idee", keywords: "idee ampoule" },
  { emoji: "\ud83d\udccb", name: "clipboard", keywords: "clipboard liste" },
  { emoji: "\ud83d\udcdd", name: "crayon", keywords: "crayon ecrire" },
  // Divers
  { emoji: "\ud83d\ude80", name: "fusee", keywords: "fusee decollage" },
  { emoji: "\u2708\ufe0f", name: "avion", keywords: "avion" },
  { emoji: "\ud83d\ude97", name: "voiture", keywords: "voiture klaxon" },
  { emoji: "\ud83d\udea9", name: "drapeau", keywords: "drapeau" },
  { emoji: "\ud83c\udf81", name: "cadeau", keywords: "cadeau surprise" },
  { emoji: "\ud83d\udc8e", name: "diamant", keywords: "diamant gemme" },
  { emoji: "\ud83d\udcb0", name: "argent", keywords: "argent cash" },
  { emoji: "\ud83c\udfac", name: "popcorn", keywords: "popcorn cinema" },
  { emoji: "\ud83c\udfad", name: "masque", keywords: "masque theatre" },
  { emoji: "\ud83d\udc51", name: "couronne", keywords: "couronne roi" },
  { emoji: "\ud83d\udc0e", name: "cheval", keywords: "cheval" },
  { emoji: "\ud83d\udc31\u200d\ud83d\udc64", name: "copycat", keywords: "copycat imiter" },
  { emoji: "\ud83e\udde9", name: "puzzle", keywords: "puzzle piece" },
  { emoji: "\ud83c\udfa2", name: "montagnes russes", keywords: "montagnes russes" },
  { emoji: "\ud83c\udfaa", name: "cirque", keywords: "cirque" },
  { emoji: "\ud83c\udf38", name: "fleur", keywords: "fleur rose" },
  { emoji: "\ud83c\udf40", name: "trefle", keywords: "trefle chance" },
  { emoji: "\ud83c\udf41", name: "feuille automne", keywords: "feuille automne" },
  { emoji: "\ud83c\udf43", name: "feuille", keywords: "feuille" },
  { emoji: "\ud83c\udf31", name: "plante", keywords: "plante nature" },
];

const CLOSE_OTHERS_EVENT = "sbu-close-emoji-pickers";

interface SoundIconPickerProps {
  icon: string | null;
  onChange: (icon: string | null) => void;
}

export default function SoundIconPicker({ icon, onChange }: SoundIconPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail !== id) {
        setOpen(false);
      }
    };
    window.addEventListener(CLOSE_OTHERS_EVENT, handler);
    return () => window.removeEventListener(CLOSE_OTHERS_EVENT, handler);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 288;
      const menuHeight = 360;
      let left = rect.left;
      let top = rect.bottom + 8;
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 16;
      }
      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 8;
      }
      if (top < 8) top = 8;
      setPosition({ top, left });
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EMOJI_OPTIONS;
    return EMOJI_OPTIONS.filter(
      (option) =>
        option.name.toLowerCase().includes(q) || option.keywords.toLowerCase().includes(q) || option.emoji.includes(q),
    );
  }, [query]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    setQuery("");
    if (next) {
      window.dispatchEvent(new CustomEvent(CLOSE_OTHERS_EVENT, { detail: id }));
    }
  };

  const menu = open ? (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[9999] flex w-72 flex-col rounded-2xl border border-white/10 bg-card/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center gap-2 border-b border-white/8 p-3">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un emoji..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
          {icon && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            >
              <X size={10} />
              Retirer
            </button>
          )}
        </div>
        <div className="custom-scrollbar max-h-80 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Aucun emoji trouv\u00e9</div>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {filtered.map((option) => (
                <button
                  key={option.emoji}
                  type="button"
                  title={option.name}
                  onClick={() => {
                    onChange(option.emoji);
                    setOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-white/10 ${
                    icon === option.emoji ? "bg-primary/20 ring-1 ring-primary/60" : ""
                  }`}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-background/60 text-lg transition hover:border-primary/50 hover:bg-background"
        title={icon ? "Changer l'ic\u00f4ne" : "Ajouter une ic\u00f4ne"}
      >
        {icon ? <span className="text-xl leading-none">{icon}</span> : <Smile size={18} className="text-muted-foreground" />}
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
