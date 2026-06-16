import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

interface EmojiEntry {
  char: string;
  keywords: string[];
}

const EMOJI_CATEGORIES: { name: string; emojis: EmojiEntry[] }[] = [
  {
    name: "Fréquents",
    emojis: [
      { char: "😂", keywords: ["rire", "joyeux", "mdr", "lol", "larmes", "drole"] },
      { char: "🔥", keywords: ["feu", "hot", "tendance", "cool", "bruler"] },
      { char: "❤️", keywords: ["coeur", "amour", "love", "aime", "rouge"] },
      { char: "👍", keywords: ["ok", "oui", "approve", "pouce", "top"] },
      { char: "🎉", keywords: ["fete", "party", "celebration", "confetti", "gagner"] },
      { char: "😱", keywords: ["peur", "choque", "omg", "surpris", "horreur"] },
      { char: "😎", keywords: ["cool", "lunettes", "soleil", "detendu", "style"] },
      { char: "🤔", keywords: ["pense", "reflechir", "question", "hm", "doute"] },
      { char: "😡", keywords: ["colere", "enerve", "rage", "rouge", "fache"] },
      { char: "😭", keywords: ["pleurer", "triste", "larmes", "chagrin", "bouh"] },
      { char: "✨", keywords: ["magie", "briller", "etoile", "sparkle", "premium"] },
      { char: "💯", keywords: ["cent", "parfait", "score", "100", "reussite"] },
      { char: "💀", keywords: ["mort", "skull", "crane", "rip", "game over"] },
      { char: "👻", keywords: ["fantome", "ghost", "halloween", "invisible"] },
      { char: "😈", keywords: ["diable", "mechant", "malin", "demon", "troll"] },
      { char: "🤣", keywords: ["rire", "mort de rire", "mdr", "ptdr", "drole"] },
      { char: "🥰", keywords: ["amour", "affection", "coeur", "mignon", "sourire"] },
      { char: "😍", keywords: ["amour", "admirer", "coeur", "beau", "sourire"] },
      { char: "🤩", keywords: ["wow", "etoiles", "admiration", "genial", "starstruck"] },
      { char: "😏", keywords: ["malice", "sourire", "complice", "provoc"] },
      { char: "🙄", keywords: ["rouler yeux", "exasperation", "serieux", "pfft"] },
      { char: "😴", keywords: ["dormir", "sommeil", "fatigue", "ennui", "zzz"] },
      { char: "🤯", keywords: ["explosion", "choc", "esprit", "wow", "dingue"] },
      { char: "🥳", keywords: ["fete", "chapeau", "celebrer", "joyeux", "anniversaire"] },
      { char: "😇", keywords: ["ange", "innocent", "halo", "saint", "bon"] },
      { char: "🤠", keywords: ["cowboy", "chapeau", "western", "yeehaw"] },
      { char: "🥸", keywords: ["deguisement", "moustache", "lunettes", "spy"] },
      { char: "🤡", keywords: ["clown", "rigolo", "triste", "circus"] },
      { char: "💩", keywords: ["caca", "merde", "poop", "mauvais", "nul"] },
      { char: "🤖", keywords: ["robot", "bot", "ia", "android", "metal"] },
      { char: "👽", keywords: ["alien", "extraterrestre", "ovni", "space"] },
      { char: "👾", keywords: ["monstre", "alien", "jeu", "retro", "space invader"] },
    ],
  },
  {
    name: "Musique & son",
    emojis: [
      { char: "🎵", keywords: ["note", "musique", "melodie", "chant"] },
      { char: "🎶", keywords: ["notes", "musique", "chanson", "melodie"] },
      { char: "🎹", keywords: ["piano", "clavier", "musique", "instrument"] },
      { char: "🎺", keywords: ["trompette", "jazz", "instrument", "cuivre"] },
      { char: "🎷", keywords: ["saxophone", "jazz", "instrument", "saxo"] },
      { char: "🎸", keywords: ["guitare", "rock", "instrument", "musique"] },
      { char: "🎻", keywords: ["violon", "orchestre", "instrument", "classique"] },
      { char: "🥁", keywords: ["batterie", "tambour", "percussion", "rythme"] },
      { char: "🪕", keywords: ["banjo", "folk", "instrument", "corde"] },
      { char: "🎼", keywords: ["partition", "musique", "notes", "classique"] },
      { char: "🎤", keywords: ["micro", "chant", "karaoke", "voix", "microphone"] },
      { char: "🎧", keywords: ["casque", "ecoute", "audio", "music"] },
      { char: "📻", keywords: ["radio", "fm", "musique", "ondes"] },
      { char: "📢", keywords: ["haut parleur", "annonce", "son", "megaphone"] },
      { char: "🔔", keywords: ["cloche", "notification", "alerte", "sonnerie"] },
      { char: "🔕", keywords: ["silence", "cloche barree", "mute", "pas de son"] },
      { char: "🔊", keywords: ["volume", "haut parleur", "son fort", "audio"] },
      { char: "🔉", keywords: ["volume", "son moyen", "haut parleur"] },
      { char: "🔈", keywords: ["volume", "son faible", "haut parleur"] },
      { char: "📣", keywords: ["megaphone", "crier", "annonce", "manifestation"] },
      { char: "🎚️", keywords: ["egaliseur", "mixeur", "glissiere", "reglage"] },
      { char: "🎛️", keywords: ["table de mixage", "boutons", "audio", "controle"] },
      { char: "🎙️", keywords: ["micro studio", "podcast", "radio", "voix"] },
      { char: "📯", keywords: ["cor", "poste", "instrument", "classique"] },
      { char: "🪗", keywords: ["accordeon", "instrument", "folk", "musette"] },
      { char: "🪘", keywords: ["bongo", "tambour", "percussion", "rythme"] },
      { char: "🪇", keywords: ["maracas", "percussion", "shaker", "fete"] },
      { char: "🪈", keywords: ["flute", "instrument", "vent", "musique"] },
    ],
  },
  {
    name: "Gaming & stream",
    emojis: [
      { char: "🎮", keywords: ["manette", "jeu", "gaming", "console", "jouer"] },
      { char: "🎲", keywords: ["de", "hasard", "jeu", "role", "dnd"] },
      { char: "🃏", keywords: ["carte", "joker", "jeu", "tarot"] },
      { char: "🎰", keywords: ["casino", "machine a sous", "jackpot", "jeu"] },
      { char: "🎯", keywords: ["cible", "fleche", "precis", "objectif", "dards"] },
      { char: "🛡️", keywords: ["bouclier", "defense", "armure", "rpg", "protection"] },
      { char: "⚔️", keywords: ["epees", "combat", "guerre", "medieval", "duel"] },
      { char: "🔫", keywords: ["pistolet", "tir", "fps", "arme", "water gun"] },
      { char: "💥", keywords: ["explosion", "boom", "impact", "detruire", "puissance"] },
      { char: "👾", keywords: ["monstre", "jeu", "retro", "alien"] },
      { char: "🐉", keywords: ["dragon", "fantasy", "rpg", "feu", "boss"] },
      { char: "🐺", keywords: ["loup", "garou", "meute", "animaux", "foret"] },
      { char: "🦁", keywords: ["lion", "roi", "animaux", "force", "courage"] },
      { char: "🐯", keywords: ["tigre", "fauve", "animaux", "force"] },
      { char: "🦊", keywords: ["renard", "rusé", "animaux", "orange"] },
      { char: "🐱", keywords: ["chat", "miaou", "animaux", "mignon"] },
      { char: "🐶", keywords: ["chien", "toutou", "animaux", "fidèle"] },
      { char: "🤖", keywords: ["robot", "bot", "ia", "gaming"] },
      { char: "👹", keywords: ["ogre", "monstre", "japon", "mechant"] },
      { char: "👺", keywords: ["tengu", "demon", "japon", "masque"] },
      { char: "🧙", keywords: ["magicien", "sorcier", "rpg", "sort", "fantasy"] },
      { char: "🧛", keywords: ["vampire", "sang", "fantasy", "halloween"] },
      { char: "🧟", keywords: ["zombie", "mort vivant", "horreur", "infection"] },
      { char: "🦸", keywords: ["super heros", "hero", "pouvoir", "comics"] },
      { char: "🦹", keywords: ["super mechant", "vilain", "comics", "crime"] },
      { char: "🏆", keywords: ["trophee", "victoire", "gagner", "champion", "coupe"] },
      { char: "🥇", keywords: ["medaille or", "premier", "victoire", "1er"] },
      { char: "🥈", keywords: ["medaille argent", "deuxieme", "2eme"] },
      { char: "🥉", keywords: ["medaille bronze", "troisieme", "3eme"] },
      { char: "🏅", keywords: ["medaille", "recompense", "sport", "gagner"] },
    ],
  },
  {
    name: "Nature",
    emojis: [
      { char: "🔥", keywords: ["feu", "flamme", "bruler", "chaud"] },
      { char: "💧", keywords: ["goutte", "eau", "pluie", "liquide"] },
      { char: "🌊", keywords: ["vague", "ocean", "mer", "surf", "eau"] },
      { char: "⚡", keywords: ["eclair", "tonnerre", "electricite", "rapide", "energie"] },
      { char: "❄️", keywords: ["flocon", "neige", "froid", "hiver", "glace"] },
      { char: "🌪️", keywords: ["tornade", "vent", "tempete", "cyclone"] },
      { char: "🌈", keywords: ["arc en ciel", "couleurs", "pluie", "gay"] },
      { char: "☀️", keywords: ["soleil", "ete", "chaud", "lumiere", "journee"] },
      { char: "🌙", keywords: ["lune", "nuit", "croissant", "rever"] },
      { char: "⭐", keywords: ["etoile", "nuit", "briller", "espace"] },
      { char: "🌟", keywords: ["etoile brillante", "sparkle", "magie", "reussite"] },
      { char: "☁️", keywords: ["nuage", "ciel", "meteo", "nuageux"] },
      { char: "🌧️", keywords: ["pluie", "nuage", "meteo", "triste"] },
      { char: "⛈️", keywords: ["orage", "eclair", "pluie", "tempete", "nuage"] },
      { char: "🌩️", keywords: ["eclair", "tonnerre", "orage", "nuage"] },
      { char: "🌸", keywords: ["fleur cerisier", "sakura", "printemps", "rose"] },
      { char: "🌺", keywords: ["hibiscus", "fleur", "tropical", "ete"] },
      { char: "🌹", keywords: ["rose", "amour", "fleur", "romantique"] },
      { char: "🌻", keywords: ["tournesol", "soleil", "fleur", "ete"] },
      { char: "🌲", keywords: ["sapin", "arbre", "foret", "nature", "pin"] },
      { char: "🌳", keywords: ["arbre", "feuilles", "nature", "vert"] },
      { char: "🍁", keywords: ["feuille erable", "automne", "canada", "orange"] },
      { char: "🍄", keywords: ["champignon", "foret", "nature", "mario"] },
      { char: "🌵", keywords: ["cactus", "desert", "sec", "plante"] },
      { char: "🌴", keywords: ["palmier", "plage", "tropical", "vacances", "ete"] },
      { char: "🌿", keywords: ["herbe", "plante", "nature", "vert", "feuille"] },
      { char: "🍀", keywords: ["trefle", "chance", "vert", "irlande", "portebonheur"] },
    ],
  },
  {
    name: "Objets & symboles",
    emojis: [
      { char: "💡", keywords: ["ampoule", "idee", "lumiere", "penser"] },
      { char: "🔦", keywords: ["lampe torche", "lumiere", "nuit", "explorer"] },
      { char: "⚡", keywords: ["eclair", "energie", "rapide", "pouvoir"] },
      { char: "🔋", keywords: ["batterie", "pile", "charge", "energie"] },
      { char: "💰", keywords: ["argent", "richesse", "sac", "billets", "gain"] },
      { char: "💎", keywords: ["diamant", "gemme", "riche", "precieux", "cristal"] },
      { char: "👑", keywords: ["couronne", "roi", "reine", "royal", "premier"] },
      { char: "🏆", keywords: ["trophee", "victoire", "champion"] },
      { char: "🗝️", keywords: ["vieille cle", "secret", "vintage", "fermer"] },
      { char: "🔑", keywords: ["cle", "ouvrir", "acces", "solution"] },
      { char: "🔒", keywords: ["cadenas", "verrouille", "securite", "prive"] },
      { char: "🔓", keywords: ["cadenas ouvert", "deverrouille", "acces", "libre"] },
      { char: "🔔", keywords: ["cloche", "notification", "alerte"] },
      { char: "📢", keywords: ["haut parleur", "annonce", "public"] },
      { char: "📱", keywords: ["telephone", "mobile", "smartphone", "portable"] },
      { char: "💻", keywords: ["ordinateur", "pc", "laptop", "travail"] },
      { char: "🖥️", keywords: ["ecran", "ordinateur fixe", "desktop"] },
      { char: "🖨️", keywords: ["imprimante", "papier", "bureau"] },
      { char: "🕹️", keywords: ["joystick", "arcade", "retro", "jeu"] },
      { char: "💿", keywords: ["cd", "disque", "musique", "dvd"] },
      { char: "💾", keywords: ["disquette", "sauvegarde", "retro", "data"] },
      { char: "🎥", keywords: ["camera video", "film", "cinema", "tournage"] },
      { char: "📷", keywords: ["appareil photo", "photo", "image"] },
      { char: "📸", keywords: ["photo flash", "appareil", "selfie"] },
      { char: "🔭", keywords: ["telescope", "espace", "etoiles", "observer"] },
      { char: "🔬", keywords: ["microscope", "science", "labo", "recherche"] },
      { char: "🧲", keywords: ["aimant", "magnet", "attirer", "metal"] },
      { char: "🧿", keywords: ["nazar", "oeil", "protection", "turquie", "amulette"] },
      { char: "🎁", keywords: ["cadeau", "offrir", "anniversaire", "surprise"] },
      { char: "🎀", keywords: ["ruban", "noeud", "decoration", "rose"] },
      { char: "🎊", keywords: ["confetti", "fete", "celebration", "joyeux"] },
      { char: "🎋", keywords: ["tanabata", "arbre souhaits", "japon", "bambou"] },
    ],
  },
  {
    name: "Couleurs",
    emojis: [
      { char: "❤️", keywords: ["coeur rouge", "amour", "romantique", "rouge"] },
      { char: "🧡", keywords: ["coeur orange", "amour", "chaleur", "orange"] },
      { char: "💛", keywords: ["coeur jaune", "amitie", "soleil", "joie", "jaune"] },
      { char: "💚", keywords: ["coeur vert", "nature", "espoir", "vert"] },
      { char: "💙", keywords: ["coeur bleu", "calme", "tristesse", "bleu"] },
      { char: "💜", keywords: ["coeur violet", "amour", "purple", "violet"] },
      { char: "🖤", keywords: ["coeur noir", "sombre", "noir", "heart"] },
      { char: "🤍", keywords: ["coeur blanc", "pure", "blanc", "amour"] },
      { char: "🤎", keywords: ["coeur marron", "marron", "chocolat", "brown"] },
      { char: "💖", keywords: ["coeur etincelant", "amour", "briller", "sparkle"] },
      { char: "💗", keywords: ["coeur grandissant", "amour", "affection", "croissant"] },
      { char: "💘", keywords: ["coeur fleche", "amour", "cupidon", "fleche"] },
      { char: "💝", keywords: ["coeur ruban", "cadeau", "amour", "noeud"] },
      { char: "💟", keywords: ["coeur decoration", "amour", "ornement", "coeur"] },
      { char: "🔴", keywords: ["cercle rouge", "rouge", "record", "stop"] },
      { char: "🟠", keywords: ["cercle orange", "orange", "warning"] },
      { char: "🟡", keywords: ["cercle jaune", "jaune", "attention"] },
      { char: "🟢", keywords: ["cercle vert", "vert", "go", "valide"] },
      { char: "🔵", keywords: ["cercle bleu", "bleu", "info"] },
      { char: "🟣", keywords: ["cercle violet", "violet", "purple"] },
      { char: "⚫", keywords: ["cercle noir", "noir", "pause"] },
      { char: "⚪", keywords: ["cercle blanc", "blanc", "vide"] },
      { char: "🟤", keywords: ["cercle marron", "marron", "brown"] },
      { char: "⬛", keywords: ["carre noir", "noir", "stop"] },
      { char: "⬜", keywords: ["carre blanc", "blanc", "vide"] },
      { char: "🟥", keywords: ["carre rouge", "rouge", "danger"] },
      { char: "🟧", keywords: ["carre orange", "orange", "warning"] },
      { char: "🟨", keywords: ["carre jaune", "jaune", "attention"] },
      { char: "🟩", keywords: ["carre vert", "vert", "valide", "go"] },
      { char: "🟦", keywords: ["carre bleu", "bleu", "info"] },
      { char: "🟪", keywords: ["carre violet", "violet", "purple"] },
    ],
  },
  {
    name: "Flèches & formes",
    emojis: [
      { char: "➡️", keywords: ["fleche droite", "droite", "avancer", "next"] },
      { char: "⬅️", keywords: ["fleche gauche", "gauche", "retour", "precedent"] },
      { char: "⬆️", keywords: ["fleche haut", "haut", "monter", "top"] },
      { char: "⬇️", keywords: ["fleche bas", "bas", "descendre", "bottom"] },
      { char: "↗️", keywords: ["fleche haut droite", "augmenter", "diagnoale"] },
      { char: "↘️", keywords: ["fleche bas droite", "descendre", "diagonale"] },
      { char: "↙️", keywords: ["fleche bas gauche", "retour", "diagonale"] },
      { char: "↖️", keywords: ["fleche haut gauche", "augmenter", "diagonale"] },
      { char: "🔁", keywords: ["repeter", "loop", "boucle", "reload"] },
      { char: "🔂", keywords: ["repeter une fois", "loop", "recharge"] },
      { char: "▶️", keywords: ["lecture", "play", "triangle", "demarrer"] },
      { char: "⏸️", keywords: ["pause", "arreter temporairement", "player"] },
      { char: "⏹️", keywords: ["stop", "arreter", "carre"] },
      { char: "⏺️", keywords: ["record", "enregistrer", "rond"] },
      { char: "⏭️", keywords: ["suivant", "next", "piste suivante"] },
      { char: "⏮️", keywords: ["precedent", "previous", "piste precedente"] },
      { char: "🔀", keywords: ["melanger", "shuffle", "aleatoire", "croise"] },
      { char: "🔃", keywords: ["reload", "rafraichir", "actualiser", "rotation"] },
      { char: "🔄", keywords: ["rotation", "refresh", "sync", "synchroniser"] },
      { char: "🔼", keywords: ["haut", "monter", "fleche haut", "top"] },
      { char: "🔽", keywords: ["bas", "descendre", "fleche bas", "bottom"] },
      { char: "✅", keywords: ["valide", "check", "ok", "confirmer", "vert"] },
      { char: "❌", keywords: ["croix", "erreur", "annuler", "non", "rouge"] },
      { char: "⭕", keywords: ["rond", "circle", "japon", "correct"] },
      { char: "🚫", keywords: ["interdit", "defense", "stop", "barre"] },
      { char: "💢", keywords: ["coup de tete", "colere", "veine", "stress"] },
      { char: "♨️", keywords: ["sources chaudes", "vapeur", "eau chaude", "onsen"] },
      { char: "💠", keywords: ["diamant forme", "geometrie", "bleu", "crystal"] },
      { char: "🔷", keywords: ["losange bleu", "geometrie", "bleu", "diamant"] },
      { char: "🔶", keywords: ["losange orange", "geometrie", "orange", "diamant"] },
      { char: "🔸", keywords: ["petit losange orange", "geometrie", "orange"] },
      { char: "🔹", keywords: ["petit losange bleu", "geometrie", "bleu"] },
    ],
  },
  {
    name: "Nourriture & boisson",
    emojis: [
      { char: "🍕", keywords: ["pizza", "italie", "fromage", "manger"] },
      { char: "🍔", keywords: ["hamburger", "burger", "fast food", "manger"] },
      { char: "🍟", keywords: ["frites", "pommes de terre", "fast food"] },
      { char: "🌭", keywords: ["hot dog", "sandwich", "saucisse", "fast food"] },
      { char: "🍿", keywords: ["popcorn", "cinema", "film", "snack"] },
      { char: "🍩", keywords: ["donut", "beignet", "sucre", "dessert"] },
      { char: "🍪", keywords: ["cookie", "biscuit", "chocolat", "gouter"] },
      { char: "🍫", keywords: ["chocolat", "barre", "sucre", "dessert"] },
      { char: "🍬", keywords: ["bonbon", "sucre", "doux", "enfant"] },
      { char: "🍭", keywords: ["sucette", "bonbon", "sucre", "dessert"] },
      { char: "🍺", keywords: ["biere", "boire", "alcool", "bar", "pression"] },
      { char: "🍻", keywords: ["chopes", "biere", "trinquer", "alcool", "fete"] },
      { char: "🥂", keywords: ["sante", "trinquer", "champagne", "verres", "celebrer"] },
      { char: "🍷", keywords: ["vin", "verre", "alcool", "rouge", "boire"] },
      { char: "🥃", keywords: ["whisky", "verre", "alcool", "spiritueux"] },
      { char: "🍸", keywords: ["cocktail", "verre", "alcool", "plage", "fete"] },
      { char: "🍹", keywords: ["cocktail tropical", "jus", "fruit", "vacances", "plage"] },
      { char: "☕", keywords: ["cafe", "the", "chaud", "tasse", "matin"] },
      { char: "🍵", keywords: ["the", "tasse", "chaud", "boisson", "japon"] },
      { char: "🧃", keywords: ["boite", "jus", "carton", "paille", "enfant"] },
      { char: "🥤", keywords: ["gobelet", "soda", "paille", "boire", "fast food"] },
      { char: "🧋", keywords: ["bubble tea", "boba", "the", "perles", "taiwan"] },
      { char: "🍾", keywords: ["champagne", "bouteille", "celebrer", "nouvel an"] },
      { char: "🥡", keywords: ["boite emporter", "nourriture", "asiatique", "chinois"] },
      { char: "🍱", keywords: ["bento", "japonais", "repas", "riz", "dejeuner"] },
      { char: "🍣", keywords: ["sushi", "japonais", "poisson", "riz", "mer"] },
      { char: "🍜", keywords: ["ramen", "nouilles", "japonais", "soupe", "chaud"] },
      { char: "🌮", keywords: ["taco", "mexicain", "nourriture", "epice"] },
      { char: "🌯", keywords: ["burrito", "mexicain", "nourriture", "sandwich"] },
      { char: "🥗", keywords: ["salade", "legumes", "vert", "sain", "manger"] },
      { char: "🍎", keywords: ["pomme", "fruit", "rouge", "sante"] },
      { char: "🍌", keywords: ["banane", "fruit", "jaune", "potassium"] },
    ],
  },
];

interface EmojiPickerProps {
  value?: string | null;
  onSelect: (emoji: string | null) => void;
  onClose: () => void;
}

export default function EmojiPicker({ value, onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

  const filtered = query.trim()
    ? allEmojis.filter(
        (entry) =>
          entry.char.includes(query.trim()) ||
          entry.keywords.some((kw) => kw.toLowerCase().includes(query.trim().toLowerCase())),
      )
    : null;

  return (
    <div
      data-emoji-picker
      ref={ref}
      className="glass-card absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-3 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icône</span>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-white/10">
          <X size={14} />
        </button>
      </div>

      <div className="relative mb-2">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher..."
          className="w-full rounded-lg border border-white/8 bg-background/60 py-1 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {value && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-2 py-1">
          <span className="text-xs text-muted-foreground">Actuel</span>
          <span className="text-lg">{value}</span>
        </div>
      )}

      <div className="max-h-52 overflow-y-auto pr-1">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Aucun emoji</p>
          ) : (
            <div className="grid grid-cols-6 gap-1">
              {filtered.map((entry) => (
                <button
                  key={entry.char}
                  onClick={() => onSelect(entry.char)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-lg transition hover:bg-white/10",
                    value === entry.char && "bg-primary/20 ring-1 ring-primary/40",
                  )}
                >
                  {entry.char}
                </button>
              ))}
            </div>
          )
        ) : (
          EMOJI_CATEGORIES.map((category) => (
            <div key={category.name} className="mb-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{category.name}</span>
              <div className="mt-1 grid grid-cols-6 gap-1">
                {category.emojis.map((entry) => (
                  <button
                    key={entry.char}
                    onClick={() => onSelect(entry.char)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-lg text-lg transition hover:bg-white/10",
                      value === entry.char && "bg-primary/20 ring-1 ring-primary/40",
                    )}
                  >
                    {entry.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {value && (
        <button
          onClick={() => onSelect(null)}
          className="mt-2 w-full rounded-lg border border-white/10 py-1 text-xs text-muted-foreground transition hover:bg-white/10"
        >
          Retirer l'icône
        </button>
      )}
    </div>
  );
}
