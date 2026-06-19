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
  for (const file of missing) {
  }
  process.exit(1);
}

if (!fs.existsSync(vbcableInstaller)) {
} else {
}
