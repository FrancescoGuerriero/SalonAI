param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    )
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SnapshotRoot = Join-Path `
    $ProjectRoot `
    "backups\dr-snapshots\$Timestamp"

New-Item `
    -ItemType Directory `
    -Path $SnapshotRoot `
    -Force |
    Out-Null

Set-Location $ProjectRoot

function Save-CommandOutput {
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    $Path = Join-Path $SnapshotRoot $Name

    try {
        & $Command 2>&1 |
            Out-String |
            Set-Content `
                -LiteralPath $Path `
                -Encoding utf8
    }
    catch {
        $_.Exception.ToString() |
            Set-Content `
                -LiteralPath $Path `
                -Encoding utf8
    }
}

Save-CommandOutput "docker-version.txt" {
    docker version
}

Save-CommandOutput "compose-config.yml" {
    docker compose `
        --env-file ".\.env.production" `
        -f ".\docker-compose.production.yml" `
        -f ".\docker-compose.observability.yml" `
        -f ".\docker-compose.resilience.yml" `
        config `
        --no-interpolate
}

Save-CommandOutput "compose-ps.txt" {
    docker compose `
        --env-file ".\.env.production" `
        -f ".\docker-compose.production.yml" `
        -f ".\docker-compose.observability.yml" `
        -f ".\docker-compose.resilience.yml" `
        ps --all
}

Save-CommandOutput "docker-volumes.txt" {
    docker volume ls
}

Save-CommandOutput "docker-images.txt" {
    docker images `
        --digests `
        --format "table {{.Repository}}\t{{.Tag}}\t{{.Digest}}\t{{.ID}}\t{{.Size}}"
}

Save-CommandOutput "mongo-backup-state.json" {
    docker inspect `
        salonai-mongo-backup `
        --format '{{json .State}}'
}

Save-CommandOutput "mongo-backup-image.txt" {
    docker inspect `
        salonai-mongo-backup `
        --format '{{.Config.Image}}'
}

Save-CommandOutput "mongo-backup-logs.txt" {
    docker logs salonai-mongo-backup --tail 250
}

$BackupRoot = Join-Path $ProjectRoot "backups\mongodb"

if (Test-Path -LiteralPath $BackupRoot) {
    $LatestArchive = Get-ChildItem `
        -LiteralPath $BackupRoot `
        -Filter "salonai-mongodb-*.archive.gz" `
        -File `
        -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -ne $LatestArchive) {
        $ManifestPath = $LatestArchive.FullName.Replace(
            ".archive.gz",
            ".json"
        )

        foreach ($Path in @(
            $ManifestPath,
            "$($LatestArchive.FullName).sha256"
        )) {
            if (Test-Path -LiteralPath $Path) {
                Copy-Item `
                    -LiteralPath $Path `
                    -Destination $SnapshotRoot `
                    -Force
            }
        }

        [ordered]@{
            archive = $LatestArchive.FullName
            sizeBytes = $LatestArchive.Length
            lastWriteTimeUtc = $LatestArchive.LastWriteTimeUtc.ToString("o")
            sha256 = (
                Get-FileHash `
                    -LiteralPath $LatestArchive.FullName `
                    -Algorithm SHA256
            ).Hash.ToLowerInvariant()
        } |
            ConvertTo-Json |
            Set-Content `
                -LiteralPath (
                    Join-Path $SnapshotRoot "latest-backup.json"
                ) `
                -Encoding utf8
    }
}

$EnvironmentPath = Join-Path $ProjectRoot ".env.production"

if (Test-Path -LiteralPath $EnvironmentPath) {
    Get-Content -LiteralPath $EnvironmentPath |
        Where-Object {
            $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*='
        } |
        ForEach-Object {
            ($_ -split '=', 2)[0].Trim()
        } |
        Sort-Object -Unique |
        Set-Content `
            -LiteralPath (
                Join-Path $SnapshotRoot "environment-variable-names.txt"
            ) `
            -Encoding utf8
}

$ZipPath = "$SnapshotRoot.zip"

Compress-Archive `
    -Path "$SnapshotRoot\*" `
    -DestinationPath $ZipPath `
    -Force

Write-Host ""
Write-Host "[PASS] Disaster-recovery snapshot collected." -ForegroundColor Green
Write-Host "Snapshot: $ZipPath" -ForegroundColor DarkGray
