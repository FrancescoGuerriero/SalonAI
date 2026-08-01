param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$EnvironmentFile = ".env.production"
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

        $Name = $Line.Substring(0, $Separator).Trim()
        $Value = $Line.Substring($Separator + 1).Trim()
        $Values[$Name] = $Value
    }

    return $Values
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$EnvironmentPath = if ([System.IO.Path]::IsPathRooted($EnvironmentFile)) {
    $EnvironmentFile
}
else {
    Join-Path $ProjectRoot $EnvironmentFile
}

if (-not (Test-Path -LiteralPath $EnvironmentPath -PathType Leaf)) {
    throw "Production environment file is missing: $EnvironmentPath"
}

$Values = Read-EnvironmentFile -Path $EnvironmentPath

$Required = @(
    "APP_VERSION",
    "RELEASE_SOURCE_COMMIT",
    "AI_SERVICE_IMAGE",
    "BACKEND_IMAGE",
    "FRONTEND_IMAGE",
    "SALONAI_DOMAIN",
    "PUBLIC_BASE_URL",
    "FRONTEND_URL",
    "MONGO_ROOT_USERNAME",
    "MONGO_ROOT_PASSWORD",
    "MONGO_DATABASE",
    "JWT_SECRET",
    "TLS_CERT_DIR",
    "GRAFANA_ADMIN_USER",
    "GRAFANA_ADMIN_PASSWORD"
)

foreach ($Name in $Required) {
    if (-not $Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
        throw "Required production variable is missing: $Name"
    }

    if ($Values[$Name] -match "CHANGE_ME|<[^>]+>|example\.com") {
        throw "Production variable still contains a placeholder: $Name"
    }
}

if ($Values["APP_VERSION"] -notmatch "^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$") {
    throw "APP_VERSION must be an immutable semantic release tag such as v7.14.0."
}

if ($Values["RELEASE_SOURCE_COMMIT"] -notmatch "^[a-f0-9]{40}$") {
    throw "RELEASE_SOURCE_COMMIT must be a full lowercase Git commit SHA."
}

foreach ($Name in @("AI_SERVICE_IMAGE", "BACKEND_IMAGE", "FRONTEND_IMAGE")) {
    if ($Values[$Name] -notmatch "^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$") {
        throw "$Name must be an immutable GHCR image@sha256 reference."
    }
}

$PublicUri = $null
$FrontendUri = $null

if (-not [System.Uri]::TryCreate(
    $Values["PUBLIC_BASE_URL"],
    [System.UriKind]::Absolute,
    [ref]$PublicUri
)) {
    throw "PUBLIC_BASE_URL is not a valid absolute URL."
}

if (-not [System.Uri]::TryCreate(
    $Values["FRONTEND_URL"],
    [System.UriKind]::Absolute,
    [ref]$FrontendUri
)) {
    throw "FRONTEND_URL is not a valid absolute URL."
}

if ($PublicUri.Scheme -ne "https") {
    throw "PUBLIC_BASE_URL must use HTTPS."
}

if ($FrontendUri.Scheme -ne "https") {
    throw "FRONTEND_URL must use HTTPS."
}

if ($PublicUri.DnsSafeHost -ne $Values["SALONAI_DOMAIN"]) {
    throw "PUBLIC_BASE_URL host must match SALONAI_DOMAIN."
}

if ($FrontendUri.DnsSafeHost -ne $Values["SALONAI_DOMAIN"]) {
    throw "FRONTEND_URL host must match SALONAI_DOMAIN."
}

if ($Values["MONGO_ROOT_PASSWORD"].Length -lt 24) {
    throw "MONGO_ROOT_PASSWORD must be at least 24 characters."
}

if ($Values["JWT_SECRET"].Length -lt 64) {
    throw "JWT_SECRET must be at least 64 characters."
}

if ($Values["GRAFANA_ADMIN_PASSWORD"].Length -lt 24) {
    throw "GRAFANA_ADMIN_PASSWORD must be at least 24 characters."
}

$TlsDirectory = $Values["TLS_CERT_DIR"]
if (-not [System.IO.Path]::IsPathRooted($TlsDirectory)) {
    $TlsDirectory = Join-Path $ProjectRoot $TlsDirectory
}

foreach ($CertificateFile in @("fullchain.pem", "privkey.pem")) {
    $CertificatePath = Join-Path $TlsDirectory $CertificateFile

    if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) {
        throw "Required TLS file is missing: $CertificatePath"
    }

    if ((Get-Item -LiteralPath $CertificatePath).Length -eq 0) {
        throw "Required TLS file is empty: $CertificatePath"
    }
}

Write-Host "[PASS] Production environment contract is valid." -ForegroundColor Green
Write-Host "[PASS] Immutable release image references are configured." -ForegroundColor Green
Write-Host "[PASS] Required TLS certificate files exist." -ForegroundColor Green
