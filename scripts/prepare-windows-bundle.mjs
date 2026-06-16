import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const requiredFiles = [
  path.join(projectRoot, "src-tauri", "resources", "prereqs", "check-vbcable.ps1"),
  path.join(projectRoot, "src-tauri", "nsis", "install-hooks.nsh"),
];
const vbcableInstaller = path.join(projectRoot, "src-tauri", "resources", "prereqs", "vbcable", "VBCABLE_Setup_x64.exe");

const missing = requiredFiles.filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error("\n[Resonance] Bundle Windows incomplet. Fichiers manquants :\n");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

if (!fs.existsSync(vbcableInstaller)) {
  console.warn("\n[Resonance] Attention : VBCABLE_Setup_x64.exe n'est pas embarqué.");
  console.warn("Le setup proposera d'ouvrir le site officiel si VB-CABLE est manquant.");
  console.warn("Pour embarquer l'installateur, place-le ici :");
  console.warn("src-tauri/resources/prereqs/vbcable/VBCABLE_Setup_x64.exe\n");
} else {
  console.log("[Resonance] Pré-requis bundle Windows OK.");
}
