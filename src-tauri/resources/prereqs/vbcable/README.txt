Prérequis Windows intégrés au setup Resonance

But
- embarquer le check VB-CABLE dans le bundle Tauri/NSIS ;
- lancer l'installateur officiel seulement si VB-CABLE n'est pas déjà installé sur la machine cible.

Fichiers attendus ici
- VBCABLE_Setup_x64.exe

Optionnel mais recommandé depuis le ZIP officiel VB-CABLE
- VBCABLE_Setup.exe
- VBCABLE_ControlPanel.exe
- *.cat
- *.dll
- *.inf
- *.sys

Source
- télécharger l'archive officielle depuis vb-audio.com
- extraire son contenu dans ce dossier `vbcable/`

Important
- ne pas lancer l'exécutable directement depuis le ZIP ; VB-Audio demande les fichiers extraits dans un dossier local.
- après installation de VB-CABLE sur le PC cible, un redémarrage Windows est recommandé.
