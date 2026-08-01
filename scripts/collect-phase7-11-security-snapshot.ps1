param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    )
)

# SALONAI_PHASE_7_11_SNAPSHOT_VERSION=1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ReportsRoot = Join-Path $ProjectRoot "security-reports"

if (-not (Test-Path -LiteralPath $ReportsRoot)) {
    throw "Security reports were not found: $ReportsRoot"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$WorkRoot = Join-Path $env:TEMP "SalonAI-Phase7-11-Security-$Timestamp"
$SnapshotRoot = Join-Path $WorkRoot "snapshot"
$OutputPath = Join-Path $ProjectRoot (
    "SalonAI-Phase7-11-Security-Snapshot-$Timestamp.zip"
)

try {
    New-Item -ItemType Directory -Path $SnapshotRoot -Force | Out-Null

    Copy-Item `
        -LiteralPath $ReportsRoot `
        -Destination (Join-Path $SnapshotRoot "security-reports") `
        -Recurse `
        -Force

    Copy-Item `
        -LiteralPath (Join-Path $ProjectRoot "config\security") `
        -Destination (Join-Path $SnapshotRoot "security-policy") `
        -Recurse `
        -Force

    $Metadata = [ordered]@{
        schemaVersion = 1
        phase = "7.11"
        generatedAtUtc = [DateTime]::UtcNow.ToString("o")
        projectPathIncluded = $false
        environmentValuesIncluded = $false
        productionDataIncluded = $false
    }

    $Metadata | ConvertTo-Json -Depth 5 | Set-Content `
        -LiteralPath (Join-Path $SnapshotRoot "snapshot-metadata.json") `
        -Encoding utf8

    $global:LASTEXITCODE = 0
    $Images = & docker image ls `
        --filter "reference=salonai/*" `
        --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}" `
        2>$null

    if ($LASTEXITCODE -eq 0) {
        $Images | Set-Content `
            -LiteralPath (Join-Path $SnapshotRoot "salonai-images.txt") `
            -Encoding utf8
    }

    Compress-Archive `
        -Path (Join-Path $SnapshotRoot "*") `
        -DestinationPath $OutputPath `
        -CompressionLevel Optimal `
        -Force

    Write-Host "[PASS] Security evidence snapshot created." -ForegroundColor Green
    Write-Host "Snapshot: $OutputPath" -ForegroundColor DarkGray
}
finally {
    Remove-Item -LiteralPath $WorkRoot -Recurse -Force -ErrorAction SilentlyContinue
}
