import { useState } from "react";
import { ArrowRight, Mic, Zap, Headphones } from "lucide-react";

interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Bienvenue sur Resonance",
      desc: "Une soundboard faible latence pour Discord et les jeux. Tu mixes tes sons et tu les envoies comme un micro virtuel.",
      icon: Zap,
    },
    {
      title: "Routage audio",
      desc: "Resonance doit sortir sur VB-Cable. Utilise CABLE Input 16ch en sortie Resonance, puis CABLE Output comme entrée dans Discord.",
      icon: Headphones,
    },
    {
      title: "Prêt",
      desc: "On configure maintenant tes périphériques et ton premier board.",
      icon: Mic,
    },
  ];

  const s = steps[step];

  return (
    <div className="h-screen flex items-center justify-center bg-background text-foreground">
      <div className="max-w-md w-full flex flex-col items-center gap-6 p-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <s.icon size={32} />
        </div>
        <h1 className="text-2xl font-bold text-center">{s.title}</h1>
        <p className="text-center text-muted-foreground leading-relaxed">{s.desc}</p>
        <div className="flex gap-2 mt-4">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <button
          onClick={() => { if (step < steps.length - 1) setStep(step + 1); else onDone(); }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          {step < steps.length - 1 ? "Suivant" : "Commencer"} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
