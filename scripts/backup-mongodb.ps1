# SALONAI_PHASE_7_10_BACKUP_WRAPPER_VERSION=2

param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [int]$TimeoutSeconds = 300
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ProductionCompose = Join-Path $ProjectRoot "docker-compose.production.yml"
$ObservabilityCompose = Join-Path $ProjectRoot "docker-compose.observability.yml"
$ResilienceCompose = Join-Path $ProjectRoot "docker-compose.resilience.yml"
$EnvironmentFile = Join-Path $ProjectRoot ".env.production"
$BackupRoot = Join-Path $ProjectRoot "backups\mongodb"

function Assert-Path {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not found: $Path"
    }
}

function Test-ArchiveChecksum {
    param(
        [Parameter(Mandatory)]
        [string]$ArchivePath
    )

    $ChecksumPath = "$ArchivePath.sha256"
    Assert-Path $ChecksumPath "Backup checksum"

    $ChecksumLine = (
        Get-Content -LiteralPath $ChecksumPath -Raw
    ).Trim()

    $Expected = (
        $ChecksumLine -split "\s+"
    )[0].ToLowerInvariant()

    $Actual = (
        Get-FileHash `
            -LiteralPath $ArchivePath `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($Expected -ne $Actual) {
        throw "Backup checksum mismatch for $ArchivePath"
    }

    return $Actual
}

Assert-Path $ProjectRoot "SalonAI project root"
Assert-Path $ProductionCompose "Production Compose file"
Assert-Path $ObservabilityCompose "Observability Compose file"
Assert-Path $ResilienceCompose "Resilience Compose file"
Assert-Path $EnvironmentFile "Production environment file"

New-Item `
    -ItemType Directory `
    -Path $BackupRoot `
    -Force |
    Out-Null

Set-Location $ProjectRoot

Write-Host ""
Write-Host "SalonAI MongoDB backup" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

Write-Host ""
Write-Host "==> Starting backup service" -ForegroundColor Cyan

$PreviousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    $ComposeOutput = & docker compose `
        --env-file $EnvironmentFile `
        -f $ProductionCompose `
        -f $ObservabilityCompose `
        -f $ResilienceCompose `
        up -d mongo-backup `
        2>&1

    $ComposeExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $PreviousPreference
}

if ($ComposeExitCode -ne 0) {
    $ComposeOutput | ForEach-Object { Write-Host $_ }
    throw "Unable to start salonai-mongo-backup."
}

$Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$Running = $false

while ((Get-Date) -lt $Deadline) {
    $State = & docker inspect `
        salonai-mongo-backup `
        --format '{{.State.Running}}' `
        2>$null

    if ($LASTEXITCODE -eq 0 -and $State -eq "true") {
        $Running = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $Running) {
    throw "salonai-mongo-backup did not become ready to run a manual backup."
}

Write-Host ""
Write-Host "==> Creating backup" -ForegroundColor Cyan

$PreviousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    $Output = & docker exec `
        salonai-mongo-backup `
        /bin/bash `
        /opt/salonai/mongo-backup-once.sh `
        2>&1

    $BackupExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $PreviousPreference
}

if ($BackupExitCode -ne 0) {
    $Output | ForEach-Object { Write-Host $_ }
    throw "MongoDB backup command failed."
}

$Output | ForEach-Object { Write-Host $_ }

$LatestArchive = Get-ChildItem `
    -LiteralPath $BackupRoot `
    -Filter "salonai-mongodb-*.archive.gz" `
    -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if ($null -eq $LatestArchive) {
    throw "The backup service completed without creating an archive."
}

$ManifestPath = $LatestArchive.FullName.Replace(
    ".archive.gz",
    ".json"
)

Assert-Path $ManifestPath "Backup manifest"
$Checksum = Test-ArchiveChecksum $LatestArchive.FullName
$Manifest = Get-Content `
    -LiteralPath $ManifestPath `
    -Raw |
    ConvertFrom-Json

if ($Manifest.archive -ne $LatestArchive.Name) {
    throw "The backup manifest does not reference the created archive."
}

if (
    ([string]$Manifest.sha256).ToLowerInvariant() -ne
    $Checksum
) {
    throw "The backup manifest checksum does not match the archive."
}

Write-Host ""
Write-Host "[PASS] MongoDB backup created and verified." -ForegroundColor Green
Write-Host "Archive: $($LatestArchive.FullName)" -ForegroundColor DarkGray
Write-Host "SHA-256: $Checksum" -ForegroundColor DarkGray
Write-Host "Size: $($LatestArchive.Length) bytes" -ForegroundColor DarkGray
