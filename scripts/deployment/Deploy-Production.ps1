param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$EnvironmentFile = ".env.production",
    [Parameter(Mandatory)][string]$ReleaseManifestPath,
    [switch]$SkipPull
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

function Test-ReleaseManifest {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][hashtable]$EnvironmentValues
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Release manifest is missing: $Path"
    }

    $Manifest = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json

    if ($Manifest.releaseTag -ne $EnvironmentValues["APP_VERSION"]) {
        throw "Release manifest tag does not match APP_VERSION."
    }

    if ($Manifest.sourceCommit -ne $EnvironmentValues["RELEASE_SOURCE_COMMIT"]) {
        throw "Release manifest commit does not match RELEASE_SOURCE_COMMIT."
    }

    $ExpectedImages = @{
        "ai-service" = $EnvironmentValues["AI_SERVICE_IMAGE"]
        "backend" = $EnvironmentValues["BACKEND_IMAGE"]
        "frontend" = $EnvironmentValues["FRONTEND_IMAGE"]
    }

    $ActualImages = @{}
    foreach ($Image in @($Manifest.images)) {
        $ActualImages[$Image.service] = $Image.immutableReference
    }

    foreach ($Service in $ExpectedImages.Keys) {
        if (-not $ActualImages.ContainsKey($Service)) {
            throw "Release manifest is missing $Service."
        }

        if ($ActualImages[$Service] -ne $ExpectedImages[$Service]) {
            throw "Release manifest image mismatch for $Service."
        }
    }

    return $Manifest
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

$ReleaseManifestPath = if ([System.IO.Path]::IsPathRooted($ReleaseManifestPath)) {
    $ReleaseManifestPath
}
else {
    Join-Path $ProjectRoot $ReleaseManifestPath
}

& (Join-Path $ProjectRoot "scripts\deployment\Test-ProductionEnvironment.ps1") `
    -ProjectRoot $ProjectRoot `
    -EnvironmentFile $EnvironmentPath

if ($LASTEXITCODE -ne 0) {
    throw "Production environment validation failed."
}

$EnvironmentValues = Read-EnvironmentFile -Path $EnvironmentPath
$Manifest = Test-ReleaseManifest `
    -Path $ReleaseManifestPath `
    -EnvironmentValues $EnvironmentValues

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
$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\$Timestamp"
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

$PreviousState = Join-Path $EvidenceDirectory "previous-services.json"
$DeploymentState = Join-Path $EvidenceDirectory "deployment-services.json"
$ImageState = Join-Path $EvidenceDirectory "deployment-images.txt"
$SmokeEvidence = Join-Path $EvidenceDirectory "smoke-tests.json"
$FailureEvidence = Join-Path $EvidenceDirectory "failure.json"

Push-Location $ProjectRoot
try {
    docker compose @ComposeArguments config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose configuration validation failed."
    }

    docker compose @ComposeArguments ps --format json |
        Set-Content -LiteralPath $PreviousState -Encoding utf8

    if (-not $SkipPull) {
        docker compose @ComposeArguments pull

        if ($LASTEXITCODE -ne 0) {
            throw "Image pull failed."
        }
    }

    docker compose @ComposeArguments up -d --no-build

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose deployment failed."
    }

    & (Join-Path $ProjectRoot "scripts\deployment\Test-ProductionSmoke.ps1") `
        -BaseUrl $EnvironmentValues["PUBLIC_BASE_URL"] `
        -EvidencePath $SmokeEvidence

    if ($LASTEXITCODE -ne 0) {
        throw "Production smoke testing failed."
    }

    docker compose @ComposeArguments ps --format json |
        Set-Content -LiteralPath $DeploymentState -Encoding utf8

    docker compose @ComposeArguments images |
        Set-Content -LiteralPath $ImageState -Encoding utf8

    $ManifestHash = (Get-FileHash `
        -LiteralPath $ReleaseManifestPath `
        -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    $DeploymentEvidence = [ordered]@{
        phase = "7.14"
        deployedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        releaseTag = $Manifest.releaseTag
        sourceCommit = $Manifest.sourceCommit
        releaseManifestSha256 = $ManifestHash
        baseUrl = $EnvironmentValues["PUBLIC_BASE_URL"]
        images = [ordered]@{
            aiService = $EnvironmentValues["AI_SERVICE_IMAGE"]
            backend = $EnvironmentValues["BACKEND_IMAGE"]
            frontend = $EnvironmentValues["FRONTEND_IMAGE"]
        }
        composeFiles = @(
            "docker-compose.production.yml",
            "docker-compose.observability.yml"
        )
        smokeEvidence = "smoke-tests.json"
    }

    [System.IO.File]::WriteAllText(
        (Join-Path $EvidenceDirectory "deployment.json"),
        ($DeploymentEvidence | ConvertTo-Json -Depth 8),
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "[PASS] Production deployment completed." -ForegroundColor Green
    Write-Host "Evidence: $EvidenceDirectory"
}
catch {
    $Failure = [ordered]@{
        phase = "7.14"
        failedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        releaseTag = $EnvironmentValues["APP_VERSION"]
        message = $_.Exception.Message
    }

    [System.IO.File]::WriteAllText(
        $FailureEvidence,
        ($Failure | ConvertTo-Json -Depth 5),
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "[FAIL] Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Use Rollback-Production.ps1 with the last verified release manifest." -ForegroundColor Yellow
    throw
}
finally {
    Pop-Location
}
