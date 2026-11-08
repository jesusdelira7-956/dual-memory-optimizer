# ==============================================================================
# Dual-Memory Optimizer - 1-Line Chrome Extension Installer (Windows PowerShell)
# Usage:
#   irm https://raw.githubusercontent.com/jesusdelira7-956/dual-memory-optimizer/main/install-extension.ps1 | iex
# ==============================================================================

$ErrorActionPreference = "Stop"
$ZipUrl = "https://github.com/jesusdelira7-956/dual-memory-optimizer/archive/refs/heads/main.zip"
$InstallDir = Join-Path $env:LOCALAPPDATA "DualMemoryOptimizer"
$ExtDir = Join-Path $InstallDir "extension"
$TempZip = Join-Path $env:TEMP "dmo.zip"
$TempExtract = Join-Path $env:TEMP "dmo_extract"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  DUAL-MEMORY OPTIMIZER - WINDOWS CHROME EXTENSION INSTALLER" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

Write-Host "[*] Downloading latest release archive..."
Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip

if (Test-Path $TempExtract) { Remove-Item -Recurse -Force $TempExtract }
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }

Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force
$SubFolder = Get-ChildItem -Path $TempExtract | Select-Object -First 1
Move-Item -Path $SubFolder.FullName -Destination $InstallDir -Force

Remove-Item -Force $TempZip -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $TempExtract -ErrorAction SilentlyContinue

Set-Clipboard -Value $ExtDir

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  INSTALLATION READY!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  Extension Folder: $ExtDir"
Write-Host "  (Path is already copied to your clipboard!)"
Write-Host ""
Write-Host "  Final Step in Chrome:"
Write-Host "    1. Open chrome://extensions/"
Write-Host "    2. Turn on 'Developer mode' (top-right)"
Write-Host "    3. Click 'Load unpacked' and press Ctrl+V (Paste) -> Select Folder!"
Write-Host "======================================================================"

Start-Process "chrome.exe" "chrome://extensions/" -ErrorAction SilentlyContinue
