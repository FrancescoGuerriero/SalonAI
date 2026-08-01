param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$EnvironmentFile = ".env.production",
    [switch]$PullImages
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$EnvironmentPath = if ([System.IO.Path]::IsPathRooted($EnvironmentFile)) {
    $EnvironmentFile
}
else {
    Join-Path $ProjectRoot $EnvironmentFile
}

$ProductionCompose = Join-Path $ProjectRoot "docker-compose.production.yml"
$ObservabilityCompose = Join-Path $ProjectRoot "docker-compose.observability.yml"
$EnvironmentTest = Join-Path $ProjectRoot "scripts\deployment\Test-ProductionEnvironment.ps1"

foreach ($RequiredPath in @(
    $EnvironmentPath,
    $ProductionCompose,
    $ObservabilityCompose,
    $EnvironmentTest
)) {
    if (-not (Test-Path -LiteralPath $RequiredPath -PathType Leaf)) {
        throw "Production rehearsal prerequisite is missing: $RequiredPath"
    }
}

& powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File $EnvironmentTest `
    -ProjectRoot $ProjectRoot `
    -EnvironmentFile $EnvironmentPath

if ($LASTEXITCODE -ne 0) {
    throw "Production environment contract validation failed."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker is unavailable or Docker Desktop is not running."
}

$ComposeArguments = @(
    "compose",
    "--env-file", $EnvironmentPath,
    "-f", $ProductionCompose,
    "-f", $ObservabilityCompose
)

& docker @ComposeArguments config --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Merged production and observability Compose validation failed."
}

if ($PullImages) {
    & docker @ComposeArguments pull
    if ($LASTEXITCODE -ne 0) {
        throw "One or more immutable production images could not be pulled."
    }

    Write-Host "[PASS] Immutable production images are pullable." -ForegroundColor Green
}

Write-Host "[PASS] Merged production Compose configuration is valid." -ForegroundColor Green
Write-Host "[PASS] Rehearsal completed without starting or replacing containers." -ForegroundColor Green
