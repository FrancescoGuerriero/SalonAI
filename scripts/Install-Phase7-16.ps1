param(
    [Parameter(Mandatory)][string]$ProjectRoot,
    [Parameter(Mandatory)][string]$PayloadRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$PayloadRoot = [System.IO.Path]::GetFullPath($PayloadRoot)
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDirectory = Join-Path $ProjectRoot "backups\phase7-16-install-$Timestamp"
$Installed = 0
$BackedUp = 0

$RelativeFiles = @(
    "config\phase7-16.cutover.example.json",
    "config\phase7-16.backup-evidence.example.json",
    "config\release\phase7-16-policy.json",
    "scripts\production\New-Phase7-16CutoverInput.ps1",
    "scripts\production\Test-Phase7-16Preflight.ps1",
    "scripts\production\Invoke-Phase7-16DryRun.ps1",
    "scripts\production\Invoke-Phase7-16Cutover.ps1",
    "scripts\production\Watch-Phase7-16Hypercare.ps1",
    "scripts\production\Close-Phase7-16Cutover.ps1",
    "scripts\verify-phase7-16.ps1",
    "docs\operations\phase7-16-production-cutover.md",
    "docs\runbooks\phase7-16-cutover-failure.md",
    "scripts\Install-Phase7-16.ps1"
)

foreach ($RelativeFile in $RelativeFiles) {
    $Source = Join-Path $PayloadRoot $RelativeFile
    $Destination = Join-Path $ProjectRoot $RelativeFile

    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        throw "Payload file is missing: $RelativeFile"
    }

    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        $BackupPath = Join-Path $BackupDirectory $RelativeFile
        New-Item -ItemType Directory -Path (Split-Path -Parent $BackupPath) -Force | Out-Null
        Copy-Item -LiteralPath $Destination -Destination $BackupPath -Force
        $BackedUp++
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    $Installed++
}

Write-Host ""
Write-Host "Phase 7.16 files installed." -ForegroundColor Green
Write-Host "Files installed: $Installed"
Write-Host "Files backed up: $BackedUp"
if ($BackedUp -gt 0) {
    Write-Host "Backup directory: $BackupDirectory"
}
