import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Headphones, Mic, AlertCircle } from "lucide-react";

export default function AudioSetup() {
  const { devices, settings, fetchDevices, restartAudioEngine } = useAppStore();

  useEffect(() => {
    fetchDevices();
  }, []);

  const inputs = devices.filter((d) => d.device_type === "input");
  const outputs = devices.filter((d) => d.device_type === "output");

  const setInput = async (id: string) => {
    if (!settings) return;
    const next = { ...settings, input_device_id: id };
    await useAppStore.getState().saveSettings(next);
    await restartAudioEngine(next.input_device_id, next.output_device_id);
  };

  const setOutput = async (id: string) => {
    if (!settings) return;
    const next = { ...settings, output_device_id: id };
    await useAppStore.getState().saveSettings(next);
    await restartAudioEngine(next.input_device_id, next.output_device_id);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Configuration audio</h1>

      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle size={16} />
          <span>
            Sélectionne ton <b>micro</b> en entrée et <b>CABLE Input 16ch (VB-Audio)</b> en sortie Resonance. Ensuite, dans Discord, utilise <b>CABLE Output (VB-Audio)</b> comme micro.
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Mic size={18} /> Entrée (ton micro)
        </div>
        <select
          className="w-full px-3 py-2 rounded-lg bg-muted text-sm"
          value={settings?.input_device_id || ""}
          onChange={(e) => setInput(e.target.value)}
        >
          <option value="">Default</option>
          {inputs.map((d) => (
            <option key={d.id} value={d.id}>{d.name}{d.is_default ? " (Default)" : ""}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Headphones size={18} /> Sortie Resonance (vers Discord / câble virtuel)
        </div>
        <select
          className="w-full px-3 py-2 rounded-lg bg-muted text-sm"
          value={settings?.output_device_id || ""}
          onChange={(e) => setOutput(e.target.value)}
        >
          <option value="">Default</option>
          {outputs.map((d) => (
            <option key={d.id} value={d.id}>{d.name}{d.is_default ? " (Default)" : ""}</option>
          ))}
        </select>
      </div>

      <div className="bg-muted/50 rounded-2xl p-5 text-sm space-y-2">
        <h3 className="font-semibold">Guide de configuration Discord</h3>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Installe VB-Audio Virtual Cable si ce n&apos;est pas déjà fait.</li>
          <li>Dans Resonance, mets ton <b>micro</b> en entrée.</li>
          <li>Dans Resonance, sélectionne <b>CABLE Input 16ch (VB-Audio)</b> comme <b>sortie Resonance</b>.</li>
          <li>Dans le mixer Resonance, mets le <b>micro à 0</b>.</li>
          <li>Ouvre Discord → Paramètres → Voix &amp; Vidéo.</li>
          <li>Mets <b>Périphérique d&apos;entrée</b> sur <b>CABLE Output (VB-Audio)</b>.</li>
          <li>Désactive la détection automatique et mets le <b>slider de détection micro au minimum</b>.</li>
          <li>Le son de la soundboard part maintenant correctement dans Discord.</li>
        </ol>
      </div>
    </div>
  );
}
