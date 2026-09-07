$log = "C:\Project\collaboard\scripts\enable-wsl-features.log"
function Log($m) { Add-Content -Path $log -Value "$(Get-Date -Format o) $m" }
Set-Content -Path $log -Value "$(Get-Date -Format o) start"
try {
  Log "enabling Microsoft-Windows-Subsystem-Linux"
  $r1 = dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
  Log ($r1 -join "`n")
  Log "enabling VirtualMachinePlatform"
  $r2 = dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
  Log ($r2 -join "`n")
  Log "wsl --install --no-distribution"
  $r3 = wsl.exe --install --no-distribution --no-launch 2>&1
  Log ($r3 | Out-String)
  Log "done"
} catch {
  Log "error: $_"
  exit 1
}
