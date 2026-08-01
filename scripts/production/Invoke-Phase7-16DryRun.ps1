param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$InputFile = "deployment-evidence\phase7-16\cutover-inputs.json",
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\phase7-16"
$DryRunEvidence = Join-Path $EvidenceDirectory "dry-run.json"
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

& powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File (Join-Path $ProjectRoot "scripts\production\Test-Phase7-16Preflight.ps1") `
    -ProjectRoot $ProjectRoot `
    -InputFile $InputFile `
    -Strict:$Strict

$PreflightExitCode = $LASTEXITCODE
if ($Strict -and $PreflightExitCode -ne 0) {
    throw "Phase 7.16 strict preflight did not pass. No deployment was performed."
}

$InputPath = if ([System.IO.Path]::IsPathRooted($InputFile)) {
    $InputFile
}
else {
    Join-Path $ProjectRoot $InputFile
}

$InputData = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json

$DryRun = [ordered]@{
    schemaVersion = 1
    phase = "7.16"
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    deploymentPerformed = $false
    preflightExitCode = $PreflightExitCode
    releaseManifestPath = [string]$InputData.releaseManifestPath
    rollbackManifestPath = [string]$InputData.rollbackManifestPath
    environmentFile = [string]$InputData.environmentFile
    changeWindowStartUtc = [string]$InputData.changeWindowStartUtc
    changeWindowEndUtc = [string]$InputData.changeWindowEndUtc
    requiredCutoverToken = "DEPLOY-SALONAI-PRODUCTION"
    requiredRollbackToken = "ROLLBACK-SALONAI-PRODUCTION"
    nextCommand = "Invoke-Phase7-16Cutover.ps1 with explicit confirmation after every preflight check passes"
}

[System.IO.File]::WriteAllText(
    $DryRunEvidence,
    (($DryRun | ConvertTo-Json -Depth 6) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "[PASS] Phase 7.16 dry run completed." -ForegroundColor Green
Write-Host "No deployment was performed."
Write-Host "Evidence: $DryRunEvidence"
