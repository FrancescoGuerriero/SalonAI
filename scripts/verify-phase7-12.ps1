
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))

# SALONAI_PHASE_7_12_VERIFY_VERSION=8
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Passed = 0
$Failed = 0
function Pass([string]$Message) { $script:Passed++; Write-Host "[PASS] $Message" -ForegroundColor Green }
function Fail([string]$Message) { $script:Failed++; Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "SalonAI Phase 7.12 verification" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot"

$Required = @(
    "config\security\release-policy.json",
    "config\security\dependency-exceptions.json",
    "config\security\trivyignore.yaml",
    "scripts\security\apply-phase7-12-dependency-remediation.ps1",
    "scripts\security\apply-phase7-12-tmp-patch.ps1",
    "scripts\security\apply-phase7-12-brace-patch.ps1",
    "scripts\security\read-package-lock-versions.cjs",
    "scripts\security\read-trivy-high-findings.cjs",
    "scripts\security\test-phase7-12-dependency-posture.ps1",
    "scripts\security\run-release-security-gate.ps1",
    "scripts\verify-phase7-12.ps1",
    "docs\operations\phase7-12-dependency-maintenance.md",
    "docs\runbooks\phase7-12-dependency-maintenance-failure.md"
)
Write-Host ""
Write-Host "==> Required files" -ForegroundColor Cyan
foreach ($Relative in $Required) {
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot $Relative)) { Pass $Relative } else { Fail $Relative }
}

Write-Host ""
Write-Host "==> Static controls" -ForegroundColor Cyan
try {
    $Policy = Get-Content -LiteralPath (Join-Path $ProjectRoot "config\security\release-policy.json") -Raw | ConvertFrom-Json
    if ($Policy.phase -eq "7.12" -and [int]$Policy.enforcement.maximumHighRepositoryVulnerabilities -eq 0) { Pass "High repository vulnerability threshold" } else { Fail "High repository vulnerability threshold" }
} catch { Fail "Release policy is readable" }
try {
    $Exceptions = Get-Content -LiteralPath (Join-Path $ProjectRoot "config\security\dependency-exceptions.json") -Raw | ConvertFrom-Json
    $Items = @($Exceptions.exceptions)
    if ($Items.Count -eq 2 -and @($Items | Where-Object { $_.id -eq "CVE-2026-14257" }).Count -eq 1 -and @($Items | Where-Object { $_.id -eq "GHSA-qwww-vcr4-c8h2" }).Count -eq 1) { Pass "Exactly two scoped dependency exceptions" } else { Fail "Exactly two scoped dependency exceptions" }
} catch { Fail "Dependency exceptions are readable" }
$Ignore = Get-Content -LiteralPath (Join-Path $ProjectRoot "config\security\trivyignore.yaml") -Raw
if ($Ignore -match 'pkg:npm/brace-expansion@1\.1\.16' -and $Ignore -match 'pkg:npm/react-router@7\.18\.1' -and $Ignore -match '2026-08-14T23:59:59Z' -and $Ignore -notmatch 'pkg:npm/tmp@0\.2\.6') { Pass "Only approved findings are excepted" } else { Fail "Only approved findings are excepted" }
$MainApply = Get-Content -LiteralPath (Join-Path $ProjectRoot "scripts\security\apply-phase7-12-dependency-remediation.ps1") -Raw
$TmpPatch = Get-Content -LiteralPath (Join-Path $ProjectRoot "scripts\security\apply-phase7-12-tmp-patch.ps1") -Raw
$Posture = Get-Content -LiteralPath (Join-Path $ProjectRoot "scripts\security\test-phase7-12-dependency-posture.ps1") -Raw
$Gate = Get-Content -LiteralPath (Join-Path $ProjectRoot "scripts\security\run-release-security-gate.ps1") -Raw
if ($MainApply -match 'npm\.cmd' -and $MainApply -match '"tmp"\s+"0\.2\.7"') { Pass "Main remediation pins tmp 0.2.7 using npm.cmd" } else { Fail "Main remediation pins tmp 0.2.7 using npm.cmd" }
if ($TmpPatch -match 'CVE-2026-49982' -and $TmpPatch -match 'tmp@0\.2\.6' -and $TmpPatch -match '0\.2\.7') { Pass "Targeted tmp patch control" } else { Fail "Targeted tmp patch control" }
if ($Posture -match 'Test-VersionAtLeast \$_ "0\.2\.7"' -and $Posture -match 'override is not pinned to 0\.2\.7') { Pass "Posture enforces patched tmp version" } else { Fail "Posture enforces patched tmp version" }
if ($Gate -match 'repository-baseline\.json' -and $Gate -match 'repository\.json' -and $Gate -match 'Remove-Item.+latest' -and $Gate -match 'repositoryBaseline') { Pass "Raw baseline, filtered scans and stale-report protection" } else { Fail "Raw baseline, filtered scans and stale-report protection" }

Write-Host ""
Write-Host "==> Syntax" -ForegroundColor Cyan
foreach ($Relative in @(
    "scripts\security\apply-phase7-12-dependency-remediation.ps1",
    "scripts\security\apply-phase7-12-tmp-patch.ps1",
    "scripts\security\apply-phase7-12-brace-patch.ps1",
    "scripts\security\test-phase7-12-dependency-posture.ps1",
    "scripts\security\run-release-security-gate.ps1",
    "scripts\verify-phase7-12.ps1"
)) {
    $Tokens=$null; $Errors=$null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $ProjectRoot $Relative),[ref]$Tokens,[ref]$Errors) | Out-Null
    if (@($Errors).Count -eq 0) { Pass "PowerShell syntax: $Relative" } else { Fail "PowerShell syntax: $Relative" }
}
$NodeCommand = (Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop).Source
foreach ($Relative in @("scripts\security\read-package-lock-versions.cjs","scripts\security\read-trivy-high-findings.cjs")) {
    & $NodeCommand --check (Join-Path $ProjectRoot $Relative) *> $null
    if ($LASTEXITCODE -eq 0) { Pass "Node syntax: $Relative" } else { Fail "Node syntax: $Relative" }
}

Write-Host ""
Write-Host "==> Dependency posture" -ForegroundColor Cyan
try { & (Join-Path $ProjectRoot "scripts\security\test-phase7-12-dependency-posture.ps1") -ProjectRoot $ProjectRoot; Pass "Dependency posture" } catch { Fail "Dependency posture - $($_.Exception.Message)" }

Write-Host ""
Write-Host "==> Live application health" -ForegroundColor Cyan
foreach ($Container in @("salonai-backend","salonai-frontend")) {
    $State = & docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $Container 2>$null
    if ($LASTEXITCODE -eq 0 -and ([string]$State).Trim() -eq "healthy") { Pass "$Container is healthy" } else { Fail "$Container is healthy" }
}

Write-Host ""
Write-Host "==> Enforced dependency-aware release gate" -ForegroundColor Cyan
$GateSucceeded = $false
try {
    & (Join-Path $ProjectRoot "scripts\security\run-release-security-gate.ps1") -ProjectRoot $ProjectRoot -Enforce
    if ($LASTEXITCODE -eq 0) { $GateSucceeded=$true; Pass "Release security gate" } else { Fail "Release security gate exited with code $LASTEXITCODE" }
} catch { Fail "Release security gate - $($_.Exception.Message)" }

$Latest = Join-Path $ProjectRoot "security-reports\release-gate\latest.json"
if ($GateSucceeded -and (Test-Path -LiteralPath $Latest)) {
    try {
        $Report = Get-Content -LiteralPath $Latest -Raw | ConvertFrom-Json
        $Blocked = $Report.PSObject.Properties["blocked"]
        $Repository = $Report.PSObject.Properties["repository"]
        $Baseline = $Report.PSObject.Properties["repositoryBaseline"]
        if ($null -ne $Blocked -and -not [bool]$Blocked.Value) { Pass "Release report is not blocked" } else { Fail "Release report is not blocked" }
        if ($null -ne $Repository -and $null -ne $Repository.Value -and $null -ne $Repository.Value.PSObject.Properties["highVulnerabilities"] -and [int]$Repository.Value.highVulnerabilities -eq 0) { Pass "No unapproved repository HIGH findings" } else { Fail "No unapproved repository HIGH findings" }
        if ($null -ne $Baseline -and $null -ne $Baseline.Value -and $null -ne $Baseline.Value.PSObject.Properties["highVulnerabilities"] -and [int]$Baseline.Value.highVulnerabilities -eq 2) { Pass "Exactly two approved raw dependency findings remain visible" } else { Fail "Exactly two approved raw dependency findings remain visible" }
    } catch { Fail "Release-gate report is complete and readable - $($_.Exception.Message)" }
} elseif (-not $GateSucceeded) {
    Fail "Release-gate report was not evaluated because the gate failed"
} else { Fail "Release-gate report exists" }

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Magenta
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Skipped: 0"
if ($Failed -gt 0) { exit 1 }
Write-Host ""
Write-Host "SalonAI Phase 7.12 verified successfully." -ForegroundColor Green
