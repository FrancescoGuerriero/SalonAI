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

function Read-ProjectFile {
    param([Parameter(Mandatory)][string]$RelativePath)

    $Path = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ""
    }

    return Get-Content -LiteralPath $Path -Raw
}

$RequiredFiles = @(
    "config\phase7-16.cutover.example.json",
    "config\phase7-16.backup-evidence.example.json",
    "config\release\phase7-16-policy.json",
    "scripts\production\New-Phase7-16CutoverInput.ps1",
    "scripts\production\Test-Phase7-16Preflight.ps1",
    "scripts\production\Invoke-Phase7-16DryRun.ps1",
    "scripts\production\Invoke-Phase7-16Cutover.ps1",
    "scripts\production\Watch-Phase7-16Hypercare.ps1",
    "scripts\production\Close-Phase7-16Cutover.ps1",
    "scripts\verify-phase7-16.ps1",
    "docs\operations\phase7-16-production-cutover.md",
    "docs\runbooks\phase7-16-cutover-failure.md"
)

Write-Host ""
Write-Host "SalonAI Phase 7.16 static verification" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"

Write-Host ""
Write-Host "==> Required files" -ForegroundColor Cyan
foreach ($RelativePath in $RequiredFiles) {
    Check (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath) -PathType Leaf) $RelativePath
}

Write-Host ""
Write-Host "==> Phase 7.15 continuity" -ForegroundColor Cyan
foreach ($RelativePath in @(
    "config\release\phase7-15-policy.json",
    "scripts\production\Invoke-Phase7-15Readiness.ps1",
    "scripts\production\Invoke-ProductionRehearsal.ps1",
    "scripts\verify-phase7-15.ps1",
    "scripts\deployment\Deploy-Production.ps1",
    "scripts\deployment\Rollback-Production.ps1",
    "scripts\deployment\Test-ProductionSmoke.ps1"
)) {
    Check (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath) -PathType Leaf) $RelativePath
}

Write-Host ""
Write-Host "==> Policy validity" -ForegroundColor Cyan
try {
    $Policy = Get-Content -LiteralPath (Join-Path $ProjectRoot "config\release\phase7-16-policy.json") -Raw | ConvertFrom-Json
    Check ([string]$Policy.phase -eq "7.16") "Phase identity"
    Check ([string]$Policy.dependsOn.phase -eq "7.15") "Phase 7.15 dependency"
    Check ([bool]$Policy.production.strictPhase715ReadinessRequired) "Strict readiness required"
    Check ([bool]$Policy.production.rollbackManifestRequired) "Rollback manifest required"
    Check ([bool]$Policy.production.recentBackupEvidenceRequired) "Recent backup evidence required"
    Check ([bool]$Policy.production.changeWindowRequired) "Change window required"
    Check (-not [bool]$Policy.production.installerDeploys) "Installer does not deploy"
    Check (-not [bool]$Policy.production.dryRunDeploys) "Dry run does not deploy"
}
catch {
    Check $false "Phase 7.16 policy JSON"
}

$Preflight = Read-ProjectFile -RelativePath "scripts\production\Test-Phase7-16Preflight.ps1"
$DryRun = Read-ProjectFile -RelativePath "scripts\production\Invoke-Phase7-16DryRun.ps1"
$Cutover = Read-ProjectFile -RelativePath "scripts\production\Invoke-Phase7-16Cutover.ps1"
$Hypercare = Read-ProjectFile -RelativePath "scripts\production\Watch-Phase7-16Hypercare.ps1"
$Closure = Read-ProjectFile -RelativePath "scripts\production\Close-Phase7-16Cutover.ps1"
$NewInput = Read-ProjectFile -RelativePath "scripts\production\New-Phase7-16CutoverInput.ps1"

Write-Host ""
Write-Host "==> Preflight controls" -ForegroundColor Cyan
Check ($Preflight.Contains('readyForGoLiveReview')) "Phase 7.15 readiness evidence validation"
Check ($Preflight.Contains('expectedReleaseManifestSha256')) "Approved manifest checksum validation"
Check ($Preflight.Contains('Rollback manifest points to the same source commit')) "Distinct rollback release enforcement"
Check ($Preflight.Contains('maxBackupAgeHours')) "Backup age enforcement"
Check ($Preflight.Contains('restoreTestReference')) "Restore-test evidence enforcement"
Check ($Preflight.Contains('EnforceWindow')) "Change-window enforcement"
Check ($Preflight.Contains('docker compose @ComposeArguments')) "Merged Compose validation"
Check ($Preflight.Contains('check-ignore')) "Environment Git-ignore enforcement"

Write-Host ""
Write-Host "==> Non-destructive defaults" -ForegroundColor Cyan
Check (-not $DryRun.Contains('Deploy-Production.ps1')) "Dry run does not call deployment"
Check (-not $DryRun.Contains('Rollback-Production.ps1')) "Dry run does not call rollback"
Check (-not $Preflight.Contains('Deploy-Production.ps1')) "Preflight does not call deployment"
Check (-not $Preflight.Contains('Rollback-Production.ps1')) "Preflight does not call rollback"
Check (-not $NewInput.Contains('Deploy-Production.ps1')) "Input generator does not deploy"
Check (-not $DryRun.Contains('docker compose up')) "Dry run contains no Compose up"
Check (-not $Preflight.Contains('docker compose up')) "Preflight contains no Compose up"

Write-Host ""
Write-Host "==> Explicit cutover and rollback controls" -ForegroundColor Cyan
Check ($Cutover.Contains('DEPLOY-SALONAI-PRODUCTION')) "Exact cutover confirmation token"
Check ($Cutover.Contains('ROLLBACK-SALONAI-PRODUCTION')) "Exact rollback confirmation token"
Check ($Cutover.Contains('Test-Phase7-16Preflight.ps1')) "Strict preflight invocation"
Check ($Cutover.Contains('-EnforceWindow')) "Cutover enforces change window"
Check ($Cutover.Contains('-Strict')) "Cutover enforces strict readiness"
Check ($Cutover.Contains('Deploy-Production.ps1')) "Dedicated deployment invocation"
Check ($Cutover.Contains('Rollback-Production.ps1')) "Confirmed rollback invocation"
Check ($Cutover.Contains('Watch-Phase7-16Hypercare.ps1')) "Post-deployment hypercare invocation"
Check (-not $Cutover.Contains('--remove-orphans')) "No remove-orphans usage"

Write-Host ""
Write-Host "==> Hypercare and closure evidence" -ForegroundColor Cyan
Check ($Hypercare.Contains('/healthz')) "Edge hypercare endpoint"
Check ($Hypercare.Contains('/api/health/ready')) "Backend hypercare endpoint"
Check ($Hypercare.Contains('/ai/health')) "AI-service hypercare endpoint"
Check ($Hypercare.Contains('durationMilliseconds')) "Hypercare latency evidence"
Check ($Closure.Contains('CLOSE-SUCCESS')) "Successful closure decision"
Check ($Closure.Contains('CLOSE-ROLLED-BACK')) "Rolled-back closure decision"
Check ($Closure.Contains('hypercare.json')) "Closure requires hypercare evidence"

Write-Host ""
Write-Host "==> Safe input defaults" -ForegroundColor Cyan
try {
    $InputExample = Get-Content -LiteralPath (Join-Path $ProjectRoot "config\phase7-16.cutover.example.json") -Raw | ConvertFrom-Json
    Check ([string]$InputExample.domain -match "example\.com") "Domain remains a placeholder"
    Check ([string]$InputExample.ticketReference -match "PENDING") "Change ticket remains pending"
    Check (-not [bool]$InputExample.approvals.businessOwner) "Business approval not pre-confirmed"
    Check (-not [bool]$InputExample.approvals.technicalOwner) "Technical approval not pre-confirmed"
    Check (-not [bool]$InputExample.approvals.securityOwner) "Security approval not pre-confirmed"
    Check (-not [bool]$InputExample.approvals.backupRestorePoint) "Backup approval not pre-confirmed"
    Check ([string]::IsNullOrWhiteSpace([string]$InputExample.operators.primary)) "Primary operator not invented"
    Check ([string]::IsNullOrWhiteSpace([string]$InputExample.operators.rollback)) "Rollback operator not invented"
}
catch {
    Check $false "Phase 7.16 example input JSON"
}

Write-Host ""
Write-Host "==> PowerShell syntax" -ForegroundColor Cyan
foreach ($RelativePath in @(
    "scripts\production\New-Phase7-16CutoverInput.ps1",
    "scripts\production\Test-Phase7-16Preflight.ps1",
    "scripts\production\Invoke-Phase7-16DryRun.ps1",
    "scripts\production\Invoke-Phase7-16Cutover.ps1",
    "scripts\production\Watch-Phase7-16Hypercare.ps1",
    "scripts\production\Close-Phase7-16Cutover.ps1",
    "scripts\verify-phase7-16.ps1"
)) {
    $Path = Join-Path $ProjectRoot $RelativePath
    $Tokens = $null
    $Errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $Path,
        [ref]$Tokens,
        [ref]$Errors
    )
    Check ($Errors.Count -eq 0) "PowerShell syntax: $RelativePath"
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"

if ($Failed -gt 0) {
    Write-Host "SalonAI Phase 7.16 static verification failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SalonAI Phase 7.16 static verification passed." -ForegroundColor Green
