param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$InputFile = "deployment-evidence\phase7-15\inputs.json",
    [string]$EnvironmentFile = ".env.production",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-ProjectPath {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Path
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $Root $Path))
}

function New-RandomSecret {
    param([Parameter(Mandatory)][int]$Bytes)

    $Buffer = New-Object byte[] $Bytes
    $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Generator.GetBytes($Buffer)
    }
    finally {
        $Generator.Dispose()
    }

    return [Convert]::ToBase64String($Buffer).
        TrimEnd("=").
        Replace("+", "-").
        Replace("/", "_")
}

function Get-ManifestImage {
    param(
        [Parameter(Mandatory)]$Manifest,
        [Parameter(Mandatory)][string]$Service
    )

    $Entry = @($Manifest.images | Where-Object { $_.service -eq $Service }) |
        Select-Object -First 1

    if ($null -eq $Entry) {
        throw "Release manifest is missing image service: $Service"
    }

    $Reference = [string]$Entry.immutableReference
    if ($Reference -notmatch "^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$") {
        throw "Release manifest has an invalid immutable reference for $Service."
    }

    return $Reference
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$InputPath = Resolve-ProjectPath -Root $ProjectRoot -Path $InputFile
$EnvironmentPath = Resolve-ProjectPath -Root $ProjectRoot -Path $EnvironmentFile

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Phase 7.15 input file is missing: $InputPath"
}

$InputData = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
$ManifestPath = Resolve-ProjectPath -Root $ProjectRoot -Path ([string]$InputData.releaseManifestPath)

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "Release manifest is missing: $ManifestPath"
}

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

if ([int]$Manifest.schemaVersion -ne 1) {
    throw "Unsupported release manifest schema."
}

$ReleaseTag = [string]$Manifest.releaseTag
$SourceCommit = [string]$Manifest.sourceCommit
$Domain = [string]$InputData.domain
$TlsDirectory = [string]$InputData.tlsCertDirectory

if ($ReleaseTag -notmatch "^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$") {
    throw "The release manifest contains an invalid release tag."
}

if ($SourceCommit -notmatch "^[a-f0-9]{40}$") {
    throw "The release manifest contains an invalid source commit."
}

if ($Domain -match "example\.com" -or [string]::IsNullOrWhiteSpace($Domain)) {
    throw "Replace the placeholder production domain before generating .env.production."
}

if ((Test-Path -LiteralPath $EnvironmentPath -PathType Leaf) -and -not $Force) {
    throw "Production environment already exists. Use -Force only after backing up and reviewing it."
}

$IgnoredOutput = (& git -C $ProjectRoot check-ignore $EnvironmentPath 2>&1) -join "`n"
if ($LASTEXITCODE -ne 0) {
    throw "Refusing to create a production secret file that is not ignored by Git: $EnvironmentPath"
}

if (Test-Path -LiteralPath $EnvironmentPath -PathType Leaf) {
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupDirectory = Join-Path $ProjectRoot "backups\phase7-15-environment-$Timestamp"
    New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
    Copy-Item -LiteralPath $EnvironmentPath -Destination (Join-Path $BackupDirectory ".env.production") -Force
}

$MongoPassword = New-RandomSecret -Bytes 36
$JwtSecret = New-RandomSecret -Bytes 64
$GrafanaPassword = New-RandomSecret -Bytes 36

$Lines = @(
    "# SalonAI generated production environment",
    "# Generated locally. Never commit or print this file.",
    "",
    "APP_VERSION=$ReleaseTag",
    "RELEASE_SOURCE_COMMIT=$SourceCommit",
    "AI_SERVICE_IMAGE=$(Get-ManifestImage -Manifest $Manifest -Service 'ai-service')",
    "BACKEND_IMAGE=$(Get-ManifestImage -Manifest $Manifest -Service 'backend')",
    "FRONTEND_IMAGE=$(Get-ManifestImage -Manifest $Manifest -Service 'frontend')",
    "",
    "SALONAI_DOMAIN=$Domain",
    "PUBLIC_BASE_URL=https://$Domain",
    "FRONTEND_URL=https://$Domain",
    "",
    "MONGO_ROOT_USERNAME=salonai",
    "MONGO_ROOT_PASSWORD=$MongoPassword",
    "MONGO_DATABASE=salonai",
    "JWT_SECRET=$JwtSecret",
    "",
    "TLS_CERT_DIR=$TlsDirectory",
    "EDGE_HTTP_PORT=80",
    "EDGE_HTTPS_PORT=443",
    "",
    "PROMETHEUS_PORT=9090",
    "PROMETHEUS_RETENTION=15d",
    "ALERTMANAGER_PORT=9093",
    "BLACKBOX_PORT=9115",
    "LOKI_PORT=3100",
    "TEMPO_PORT=3200",
    "ALLOY_PORT=12345",
    "GRAFANA_PORT=3000",
    "GRAFANA_ADMIN_USER=admin",
    "GRAFANA_ADMIN_PASSWORD=$GrafanaPassword",
    "",
    "BACKEND_LOG_LEVEL=info",
    "SERVER_SHUTDOWN_TIMEOUT_MS=30000",
    "METRICS_ENABLED=true",
    "TRACING_ENABLED=true",
    "TRACE_EXPORT_TIMEOUT_MS=5000",
    "OTEL_TRACES_SAMPLER_ARG=0.1",
    "",
    "VITE_API_URL=/api",
    "VITE_AI_API_URL=/ai"
)

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $EnvironmentPath,
    (($Lines -join [Environment]::NewLine) + [Environment]::NewLine),
    $Utf8NoBom
)

Write-Host "[PASS] Created the ignored .env.production file." -ForegroundColor Green
Write-Host "[PASS] Generated strong local MongoDB, JWT and Grafana values without displaying them." -ForegroundColor Green
Write-Host "[NOTE] This does not rotate credentials in MongoDB Atlas or any external provider." -ForegroundColor Yellow
