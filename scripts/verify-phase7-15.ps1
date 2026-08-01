param(
    [string]$ProjectRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Passed = 0
$Failed = 0

function Check {
    param(
        [Parameter(Mandatory)][bool]$Condition,
        [Parameter(Mandatory)][string]$Name
    )

    if ($Condition) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }
}

function Read-Text {
    param([Parameter(Mandatory)][string]$RelativePath)

    $Path = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ""
    }

    return Get-Content -LiteralPath $Path -Raw
}

Write-Host ""
Write-Host "SalonAI Phase 7.15 static verification" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host ""

$RequiredFiles = @(
    "config\phase7-15.inputs.example.json",
    "config\release\phase7-15-policy.json",
    "scripts\production\New-Phase7-15Input.ps1",
    "scripts\production\New-ProductionEnvironment.ps1",
    "scripts\production\Test-GitHubProductionReadiness.ps1",
    "scripts\production\Invoke-ProductionRehearsal.ps1",
    "scripts\production\Invoke-Phase7-15Readiness.ps1",
    "scripts\verify-phase7-15.ps1",
    "docs\operations\phase7-15-production-readiness.md",
    "docs\runbooks\phase7-15-go-live-blocker.md"
)

Write-Host "==> Required files"
foreach ($RelativePath in $RequiredFiles) {
    Check `
        (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath) -PathType Leaf) `
        $RelativePath
}

Write-Host ""
Write-Host "==> Phase 7.14 continuity"
foreach ($RelativePath in @(
    ".github\workflows\deploy-production.yml",
    "docker-compose.production.yml",
    "docker-compose.observability.yml",
    "scripts\deployment\Test-ProductionEnvironment.ps1",
    "scripts\deployment\Deploy-Production.ps1",
    "scripts\deployment\Rollback-Production.ps1",
    "scripts\verify-phase7-14.ps1"
)) {
    Check `
        (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath) -PathType Leaf) `
        $RelativePath
}

Write-Host ""
Write-Host "==> Policy validity"
try {
    $Policy = Read-Text "config\release\phase7-15-policy.json" | ConvertFrom-Json
    Check ([string]$Policy.phase -eq "7.15") "Phase identity"
    Check ([bool]$Policy.production.httpsRequired) "HTTPS required"
    Check ([bool]$Policy.production.immutableImageDigestsRequired) "Immutable image digests required"
    Check ([bool]$Policy.production.releaseManifestRequired) "Release manifest required"
    Check ([bool]$Policy.production.credentialRotationEvidenceRequired) "Credential rotation evidence required"
    Check (-not [bool]$Policy.production.deploymentDuringThisPhase) "Readiness phase does not deploy"
}
catch {
    Check $false "Phase 7.15 policy JSON"
}

Write-Host ""
Write-Host "==> Safe input defaults"
try {
    $InputExample = Read-Text "config\phase7-15.inputs.example.json" | ConvertFrom-Json
    Check ([string]$InputExample.domain -match "example\.com") "Domain remains a placeholder"
    Check (-not [bool]$InputExample.mongoCredentialRotationConfirmed) "MongoDB rotation is not pre-confirmed"
    Check (-not [bool]$InputExample.jwtCredentialRotationConfirmed) "JWT rotation is not pre-confirmed"
    Check (-not [bool]$InputExample.githubEnvironmentConfigured) "GitHub environment is not pre-confirmed"
    Check (-not [bool]$InputExample.selfHostedRunnerConfigured) "Runner is not pre-confirmed"
    Check (-not [bool]$InputExample.dnsConfigured) "DNS is not pre-confirmed"
    Check (-not [bool]$InputExample.tlsConfigured) "TLS is not pre-confirmed"
}
catch {
    Check $false "Phase 7.15 input example JSON"
}

Write-Host ""
Write-Host "==> Non-destructive rehearsal controls"
$Rehearsal = Read-Text "scripts\production\Invoke-ProductionRehearsal.ps1"
Check ($Rehearsal -match "config --quiet") "Compose config validation"
Check ($Rehearsal -notmatch "--remove-orphans") "No remove-orphans usage"
Check ($Rehearsal -notmatch "(?m)^\s*& docker .* compose .* up") "No Compose up invocation"
Check ($Rehearsal -notmatch "(?m)^\s*& docker .* compose .* down") "No Compose down invocation"
Check ($Rehearsal -notmatch "Deploy-Production\.ps1") "No production deploy invocation"

Write-Host ""
Write-Host "==> Secret safety"
$EnvironmentScript = Read-Text "scripts\production\New-ProductionEnvironment.ps1"
Check ($EnvironmentScript -match "RandomNumberGenerator") "Cryptographic secret generation"
Check ($EnvironmentScript -match "check-ignore") "Git ignore enforcement"
Check ($EnvironmentScript.Contains('UTF8Encoding($false)')) "No-BOM environment output"
Check ($EnvironmentScript -notmatch "Write-Host.*(MongoPassword|JwtSecret|GrafanaPassword)") "Generated secrets are not printed"
Check ($EnvironmentScript -match "does not rotate credentials") "External rotation limitation is explicit"

Write-Host ""
Write-Host "==> GitHub control-plane validation"
$GitHubScript = Read-Text "scripts\production\Test-GitHubProductionReadiness.ps1"
Check ($GitHubScript -match "gh auth status") "GitHub CLI authentication check"
Check ($GitHubScript.Contains('environments/$Environment')) "GitHub environment lookup"
Check ($GitHubScript -match "actions/runners") "Self-hosted runner lookup"
Check ($GitHubScript -match "online") "Runner online-state enforcement"

Write-Host ""
Write-Host "==> Evidence and strict gate"
$Readiness = Read-Text "scripts\production\Invoke-Phase7-15Readiness.ps1"
Check ($Readiness -match "readiness-evidence\.json") "JSON evidence output"
Check ($Readiness -match "readiness-summary\.md") "Markdown evidence output"
Check ($Readiness -match "readyForGoLiveReview") "Go-live readiness decision"
Check ($Readiness.Contains('if ($Strict -and -not $Ready)')) "Strict non-ready exit gate"
Check ($Readiness -match "Resolve-DnsName") "DNS resolution check"
Check ($Readiness -match "immutableReference") "Release manifest digest validation"

Write-Host ""
Write-Host "==> PowerShell syntax"
foreach ($RelativePath in @($RequiredFiles | Where-Object { $_ -like "*.ps1" })) {
    $Path = Join-Path $ProjectRoot $RelativePath
    $Tokens = $null
    $Errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $Path,
        [ref]$Tokens,
        [ref]$Errors
    ) | Out-Null

    Check ($Errors.Count -eq 0) "PowerShell syntax: $RelativePath"
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"

if ($Failed -gt 0) {
    throw "SalonAI Phase 7.15 static verification failed."
}

Write-Host ""
Write-Host "SalonAI Phase 7.15 static verification passed." -ForegroundColor Green
