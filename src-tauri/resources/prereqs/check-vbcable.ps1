$ErrorActionPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'

$patterns = @(
  'CABLE',
  'VB-Audio',
  'VB-CABLE',
  'VBAudio'
)

function Test-PatternMatch {
  param(
    [string[]]$Values,
    [string[]]$Needles
  )

  foreach ($value in $Values) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    foreach ($needle in $Needles) {
      if ($value -like "*$needle*") {
        return $true
      }
    }
  }

  return $false
}

# 1. Périphériques audio classiques
$deviceNames = @(
  Get-CimInstance Win32_SoundDevice 2>$null |
    Select-Object -ExpandProperty Name
)

if (Test-PatternMatch -Values $deviceNames -Needles $patterns) {
  exit 0
}

# 2. Périphériques Plug-and-Play (plus fiable avec Windows 10/11)
try {
  $pnpNames = @(
    Get-PnpDevice -Class AudioEndpoint 2>$null |
      Select-Object -ExpandProperty FriendlyName
  )
  if (Test-PatternMatch -Values $pnpNames -Needles $patterns) {
    exit 0
  }

  $pnpAll = @(
    Get-PnpDevice 2>$null |
      Select-Object -ExpandProperty FriendlyName
  )
  if (Test-PatternMatch -Values $pnpAll -Needles $patterns) {
    exit 0
  }
} catch {}

# 3. Entrées de désinstallation
$uninstallRoots = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

$displayNames = foreach ($root in $uninstallRoots) {
  Get-ItemProperty $root 2>$null |
    Select-Object -ExpandProperty DisplayName
}

if (Test-PatternMatch -Values $displayNames -Needles $patterns) {
  exit 0
}

# 4. Clés spécifiques VB-Audio dans le registre
$vbRegPaths = @(
  'HKLM:\SOFTWARE\VB-Audio',
  'HKLM:\SOFTWARE\WOW6432Node\VB-Audio',
  'HKCU:\SOFTWARE\VB-Audio'
)
foreach ($regPath in $vbRegPaths) {
  if (Test-Path $regPath) {
    exit 0
  }
}

# 5. Fichiers et dossiers connus
$knownPaths = @(
  "$env:ProgramFiles\VB\CABLE",
  "$env:ProgramFiles\VB-Audio\VB-CABLE",
  "$env:ProgramFiles(x86)\VB\CABLE",
  "$env:ProgramFiles(x86)\VB-Audio\VB-CABLE",
  "$env:WINDIR\System32\vbcable_controlpanel.exe",
  "$env:WINDIR\System32\vbaudio_cable64.dll",
  "$env:WINDIR\System32\vbaudio_cable64.sys",
  "$env:WINDIR\SysWOW64\vbaudio_cable32.dll",
  "$env:WINDIR\SysWOW64\vbaudio_cable32.sys",
  "$env:WINDIR\System32\DriverStore\FileRepository"
)

foreach ($path in $knownPaths) {
  if (Test-Path $path) {
    if ($path -like '*FileRepository') {
      $match = Get-ChildItem $path -Directory 2>$null | Where-Object {
        $_.Name -like '*vbaudio*' -or $_.Name -like '*vbcable*'
      } | Select-Object -First 1

      if ($match) {
        exit 0
      }
    } else {
      exit 0
    }
  }
}

# 6. Services/drivers système
try {
  $driverNames = @(
    Get-WmiObject Win32_SystemDriver 2>$null |
      Select-Object -ExpandProperty Name
  )
  if (Test-PatternMatch -Values $driverNames -Needles @('vbaudio', 'vbcable', 'CABLE')) {
    exit 0
  }
} catch {}

exit 1
