param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [Parameter(Mandatory)][string]$EnvironmentFile,
    [Parameter(Mandatory)][string]$RollbackManifestPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Read-EnvironmentFile {
    param([Parameter(Mandatory)][string]$Path)

    $Values = @{}

    foreach ($RawLine in Get-Content -LiteralPath $Path) {
        $Line = $RawLine.Trim()

        if ([string]::IsNullOrWhiteSpace($Line) -or $Line.StartsWith("#")) {
            continue
        }

        $Separator = $Line.IndexOf("=")
        if ($Separator -lt 1) {
            throw "Invalid environment line: $RawLine"
        }

        $Values[$Line.Substring(0, $Separator).Trim()] =
            $Line.Substring($Separator + 1).Trim()
    }

    return $Values
}

function Set-EnvironmentValue {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Value
    )

    $Lines = @(
        Get-Content -LiteralPath $Path |
            Where-Object { $_ -notmatch "^\s*$([regex]::Escape($Name))=" }
    )

    $Lines += "$Name=$Value"

    [System.IO.File]::WriteAllLines(
        $Path,
        [string[]]$Lines,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Read-ReleaseManifest {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Rollback release manifest is missing: $Path"
    }

    $Manifest = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json

    if ($Manifest.releaseTag -notmatch "^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$") {
        throw "Rollback release tag is invalid."
    }

    if ($Manifest.sourceCommit -notmatch "^[a-f0-9]{40}$") {
        throw "Rollback source commit is invalid."
    }

    $Images = @{}
    foreach ($Image in @($Manifest.images)) {
        if ($Image.service -notin @("ai-service", "backend", "frontend")) {
            throw "Unexpected rollback service: $($Image.service)"
        }

        if ($Image.immutableReference -notmatch "^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$") {
            throw "Invalid rollback image reference for $($Image.service)."
        }

        $Images[$Image.service] = $Image.immutableReference
    }

    foreach ($Service in @("ai-service", "backend", "frontend")) {
        if (-not $Images.ContainsKey($Service)) {
            throw "Rollback manifest is missing $Service."
        }
    }

    return [pscustomobject]@{
        Manifest = $Manifest
        Images = $Images
    }
}

function Ensure-DockerNetwork {
    param([Parameter(Mandatory)][string]$Name)

    docker network inspect $Name *> $null
    if ($LASTEXITCODE -ne 0) {
        docker network create $Name *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create Docker network: $Name"
        }
    }
}

function Ensure-DockerVolume {
    param([Parameter(Mandatory)][string]$Name)

    docker volume inspect $Name *> $null
    if ($LASTEXITCODE -ne 0) {
        docker volume create $Name *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create Docker volume: $Name"
        }
    }
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ComposeFile = Join-Path $ProjectRoot "docker-compose.production.yml"
$ObservabilityFile = Join-Path $ProjectRoot "docker-compose.observability.yml"

$EnvironmentPath = if ([System.IO.Path]::IsPathRooted($EnvironmentFile)) {
    $EnvironmentFile
}
else {
    Join-Path $ProjectRoot $EnvironmentFile
}

$RollbackManifestPath = if ([System.IO.Path]::IsPathRooted($RollbackManifestPath)) {
    $RollbackManifestPath
}
else {
    Join-Path $ProjectRoot $RollbackManifestPath
}

if (-not (Test-Path -LiteralPath $EnvironmentPath -PathType Leaf)) {
    throw "Production environment file is missing: $EnvironmentPath"
}

$OriginalEnvironment = Read-EnvironmentFile -Path $EnvironmentPath
$Rollback = Read-ReleaseManifest -Path $RollbackManifestPath

$BackupPath = "$EnvironmentPath.before-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $EnvironmentPath -Destination $BackupPath -Force

Set-EnvironmentValue -Path $EnvironmentPath -Name "APP_VERSION" -Value $Rollback.Manifest.releaseTag
Set-EnvironmentValue -Path $EnvironmentPath -Name "RELEASE_SOURCE_COMMIT" -Value $Rollback.Manifest.sourceCommit
Set-EnvironmentValue -Path $EnvironmentPath -Name "AI_SERVICE_IMAGE" -Value $Rollback.Images["ai-service"]
Set-EnvironmentValue -Path $EnvironmentPath -Name "BACKEND_IMAGE" -Value $Rollback.Images["backend"]
Set-EnvironmentValue -Path $EnvironmentPath -Name "FRONTEND_IMAGE" -Value $Rollback.Images["frontend"]

& (Join-Path $ProjectRoot "scripts\deployment\Test-ProductionEnvironment.ps1") `
    -ProjectRoot $ProjectRoot `
    -EnvironmentFile $EnvironmentPath

Ensure-DockerNetwork -Name "salonai-private"
Ensure-DockerVolume -Name "salonai-prometheus-data"

$ComposeArguments = @(
    "--env-file",
    $EnvironmentPath,
    "-f",
    $ComposeFile
)

if (Test-Path -LiteralPath $ObservabilityFile -PathType Leaf) {
    $ComposeArguments += @("-f", $ObservabilityFile)
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\rollback-$Timestamp"
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

Push-Location $ProjectRoot
try {
    docker compose @ComposeArguments config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Rollback Compose configuration validation failed."
    }

    docker compose @ComposeArguments pull
    if ($LASTEXITCODE -ne 0) {
        throw "Rollback image pull failed."
    }

    docker compose @ComposeArguments up -d --no-build
    if ($LASTEXITCODE -ne 0) {
        throw "Rollback deployment failed."
    }

    $RollbackEnvironment = Read-EnvironmentFile -Path $EnvironmentPath

    & (Join-Path $ProjectRoot "scripts\deployment\Test-ProductionSmoke.ps1") `
        -BaseUrl $RollbackEnvironment["PUBLIC_BASE_URL"] `
        -EvidencePath (Join-Path $EvidenceDirectory "smoke-tests.json")

    $Evidence = [ordered]@{
        phase = "7.14"
        rolledBackAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        releaseTag = $Rollback.Manifest.releaseTag
        sourceCommit = $Rollback.Manifest.sourceCommit
        releaseManifestSha256 = (
            Get-FileHash -LiteralPath $RollbackManifestPath -Algorithm SHA256
        ).Hash.ToLowerInvariant()
        environmentBackup = $BackupPath
    }

    [System.IO.File]::WriteAllText(
        (Join-Path $EvidenceDirectory "rollback.json"),
        ($Evidence | ConvertTo-Json -Depth 6),
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "[PASS] Rollback to $($Rollback.Manifest.releaseTag) completed." -ForegroundColor Green
    Write-Host "Environment backup: $BackupPath"
}
catch {
    Write-Host "[FAIL] Rollback failed. Restoring the previous environment." -ForegroundColor Red
    Copy-Item -LiteralPath $BackupPath -Destination $EnvironmentPath -Force

    try {
        docker compose @ComposeArguments pull
        docker compose @ComposeArguments up -d --no-build

        if ($OriginalEnvironment.ContainsKey("PUBLIC_BASE_URL")) {
            & (Join-Path $ProjectRoot "scripts\deployment\Test-ProductionSmoke.ps1") `
                -BaseUrl $OriginalEnvironment["PUBLIC_BASE_URL"]
        }

        Write-Host "[PASS] Previous production environment was restored." -ForegroundColor Green
    }
    catch {
        Write-Host "[FAIL] Previous production environment could not be restored automatically." -ForegroundColor Red
    }

    throw
}
finally {
    Pop-Location
}
