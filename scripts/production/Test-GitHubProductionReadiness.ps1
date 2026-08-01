param(
    [string]$Repository = "FrancescoGuerriero/SalonAI",
    [string]$Environment = "production",
    [string]$RunnerLabel = "salonai-production"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

$RunnersJson = & gh api "repos/$Repository/actions/runners?per_page=100" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Unable to query repository self-hosted runners."
}

$Runners = ($RunnersJson | ConvertFrom-Json).runners
$MatchingRunner = @(
    $Runners | Where-Object {
        $Labels = @($_.labels | ForEach-Object { [string]$_.name })
        $Labels -contains $RunnerLabel
    }
) | Select-Object -First 1

if ($null -eq $MatchingRunner) {
    throw "No self-hosted runner has the required label: $RunnerLabel"
}

if ([string]$MatchingRunner.status -ne "online") {
    throw "The '$RunnerLabel' runner exists but is not online."
}

Write-Host "[PASS] GitHub production environment exists." -ForegroundColor Green
Write-Host "[PASS] Required self-hosted runner is online." -ForegroundColor Green
