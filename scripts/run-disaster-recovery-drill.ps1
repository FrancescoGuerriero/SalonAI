param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [switch]$UseExistingBackup
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$BackupScript = Join-Path $ProjectRoot "scripts\backup-mongodb.ps1"
$RestoreTestScript = Join-Path $ProjectRoot "scripts\test-mongodb-restore.ps1"
$ReportRoot = Join-Path $ProjectRoot "backups\dr-drills"
$StartedAt = [DateTimeOffset]::UtcNow
$BackupCompletedAt = $null
$RestoreCompletedAt = $null
$Succeeded = $false

New-Item `
    -ItemType Directory `
    -Path $ReportRoot `
    -Force |
    Out-Null

try {
    if (-not $UseExistingBackup) {
        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $BackupScript `
            -ProjectRoot $ProjectRoot

        if ($LASTEXITCODE -ne 0) {
            throw "The disaster-recovery drill could not create a backup."
        }
    }

    $BackupCompletedAt = [DateTimeOffset]::UtcNow

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $RestoreTestScript `
        -ProjectRoot $ProjectRoot

    if ($LASTEXITCODE -ne 0) {
        throw "The isolated restore stage of the drill failed."
    }

    $RestoreCompletedAt = [DateTimeOffset]::UtcNow
    $Succeeded = $true
}
finally {
    $CompletedAt = [DateTimeOffset]::UtcNow
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

    $Report = [ordered]@{
        schemaVersion = 1
        phase = "7.10"
        drill = "mongodb-backup-and-isolated-restore"
        succeeded = $Succeeded
        usedExistingBackup = [bool]$UseExistingBackup
        startedAtUtc = $StartedAt.ToString("o")
        backupCompletedAtUtc = if ($null -ne $BackupCompletedAt) {
            $BackupCompletedAt.ToString("o")
        }
        else {
            $null
        }
        restoreCompletedAtUtc = if ($null -ne $RestoreCompletedAt) {
            $RestoreCompletedAt.ToString("o")
        }
        else {
            $null
        }
        completedAtUtc = $CompletedAt.ToString("o")
        rpoValidationSeconds = if ($null -ne $BackupCompletedAt) {
            [Math]::Round(
                ($BackupCompletedAt - $StartedAt).TotalSeconds,
                3
            )
        }
        else {
            $null
        }
        rtoValidationSeconds = if ($null -ne $RestoreCompletedAt) {
            [Math]::Round(
                ($RestoreCompletedAt - $StartedAt).TotalSeconds,
                3
            )
        }
        else {
            $null
        }
    }

    $ReportPath = Join-Path `
        $ReportRoot `
        "dr-drill-$Timestamp.json"

    $Report |
        ConvertTo-Json -Depth 10 |
        Set-Content `
            -LiteralPath $ReportPath `
            -Encoding utf8

    Write-Host "DR drill report: $ReportPath" -ForegroundColor DarkGray
}

if (-not $Succeeded) {
    exit 1
}

Write-Host ""
Write-Host "[PASS] SalonAI disaster-recovery drill succeeded." -ForegroundColor Green
