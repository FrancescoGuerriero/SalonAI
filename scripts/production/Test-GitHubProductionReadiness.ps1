param(
    [string]$Repository = "FrancescoGuerriero/SalonAI",
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RequiredSecretNames = @(
    "PRODUCTION_HOST",
    "PRODUCTION_USER",
    "PRODUCTION_SSH_KEY",
    "PRODUCTION_KNOWN_HOSTS"
)

$Gh = Get-Command gh -ErrorAction SilentlyContinue
if ($null -eq $Gh) {
    throw "GitHub CLI is not installed or not available on PATH."
}

& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated."
}

$EnvironmentJson = & gh api "repos/$Repository/environments/$Environment" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "GitHub environment '$Environment' is not configured or is inaccessible."
}

$EnvironmentData = $EnvironmentJson | ConvertFrom-Json
if ([string]$EnvironmentData.name -ne $Environment) {
    throw "GitHub returned the wrong production environment."
}

$SecretsJson = & gh api "repos/$Repository/environments/$Environment/secrets?per_page=100" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Unable to list GitHub production environment secret names."
}

$ConfiguredSecretNames = @(
    ($SecretsJson | ConvertFrom-Json).secrets |
        ForEach-Object { [string]$_.name }
)
$MissingSecretNames = @(
    $RequiredSecretNames |
        Where-Object { $_ -notin $ConfiguredSecretNames }
)

if ($MissingSecretNames.Count -gt 0) {
    throw "Missing GitHub production environment secrets: $($MissingSecretNames -join ', ')"
}

Write-Host "[PASS] GitHub production environment exists." -ForegroundColor Green
Write-Host "[PASS] GitHub-hosted SSH deployment secrets are configured." -ForegroundColor Green
