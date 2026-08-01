param(
    [string]$ProjectRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "Phase 7.15 files are already installed in this checkout." -ForegroundColor Green
Write-Host "Create or review the ignored readiness input with:"
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$ProjectRoot\scripts\production\New-Phase7-15Input.ps1`" -ProjectRoot `"$ProjectRoot`""
Write-Host ""
Write-Host "Run the complete readiness assessment with:"
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$ProjectRoot\scripts\production\Invoke-Phase7-15Readiness.ps1`" -ProjectRoot `"$ProjectRoot`""
