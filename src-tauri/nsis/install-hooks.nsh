!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Vérification de VB-CABLE..."

  nsExec::ExecToStack '"$SYSDIR\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\\resources\\prereqs\\check-vbcable.ps1"'
  Pop $0

  IntCmp $0 0 vb_found vb_missing

  vb_found:
    DetailPrint "VB-CABLE déjà détecté sur cette machine."
    Goto vb_done

  vb_missing:
    DetailPrint "VB-CABLE non détecté."
    IfFileExists "$INSTDIR\resources\prereqs\vbcable\VBCABLE_Setup_x64.exe" 0 vb_payload_missing

    MessageBox MB_ICONQUESTION|MB_YESNO "VB-CABLE n'a pas été détecté sur ce PC. Voulez-vous lancer son installation maintenant ?$\r$\n$\r$\nAprès installation, un redémarrage Windows est recommandé avant d'utiliser Discord." IDYES vb_install IDNO vb_skip

  vb_install:
    ExecWait '"$INSTDIR\resources\prereqs\vbcable\VBCABLE_Setup_x64.exe"' $2
    MessageBox MB_ICONINFORMATION|MB_OK "L'installateur VB-CABLE a été lancé/terminé.$\r$\n$\r$\nRedémarre Windows avant d'utiliser Resonance avec Discord."
    Goto vb_done

  vb_skip:
    MessageBox MB_ICONEXCLAMATION|MB_OK "Resonance peut être installé sans VB-CABLE, mais le routage Discord ne fonctionnera pas tant qu'il ne sera pas installé."
    Goto vb_done

  vb_payload_missing:
    MessageBox MB_ICONEXCLAMATION|MB_YESNO "VB-CABLE n'a pas été détecté et le package officiel n'est pas inclus dans cet installateur.$\r$\n$\r$\nVeux-tu ouvrir le site officiel VB-Audio pour le télécharger maintenant ?" IDYES vb_open_url IDNO vb_skip_url

  vb_open_url:
    ExecShell "open" "https://vb-audio.com/Cable/"
    MessageBox MB_ICONINFORMATION|MB_OK "Télécharge et installe VB-CABLE, puis redémarre Windows avant d'utiliser Resonance avec Discord."
    Goto vb_done

  vb_skip_url:
    MessageBox MB_ICONEXCLAMATION|MB_OK "Resonance peut être installé sans VB-CABLE, mais le routage Discord ne fonctionnera pas tant qu'il ne sera pas installé."
    Goto vb_done

  vb_done:
!macroend
