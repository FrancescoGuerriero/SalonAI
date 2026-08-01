[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [switch]$RunEnforcedGate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

$Passed = 0
$Failed = 0

function Add-Pass {
    param([string]$Message)
    $script:Passed++
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Add-Fail {
    param([string]$Message)
    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Test-FileContains {
    param([string]$RelativePath, [string]$Pattern, [string]$Description)
    $Path = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Add-Fail "$Description - file missing"
        return
    }
    $Content = Get-Content -LiteralPath $Path -Raw
    if ($Content -match $Pattern) { Add-Pass $Description } else { Add-Fail $Description }
}

Write-Host ""
Write-Host "SalonAI Phase 7.11 remediation verification" -ForegroundColor White
Write-Host "Project: $ProjectRoot"

Write-Host ""
Write-Host "==> Source hardening"
Test-FileContains "backend\Dockerfile.production" 'FROM(?:\s+--platform=\S+)?\s+node:22\.23\.1-alpine3\.24' "Pinned patched backend base image"
Test-FileContains "backend\Dockerfile.production" 'apk upgrade --no-cache' "Backend operating-system package upgrade"
Test-FileContains "backend\Dockerfile.production" '/usr/local/lib/node_modules/npm' "Backend runtime removes bundled npm"
Test-FileContains "frontend\Dockerfile.production" 'FROM(?:\s+--platform=\S+)?\s+nginxinc/nginx-unprivileged:1\.31\.3-alpine3\.24' "Pinned compatible unprivileged frontend base image"
Test-FileContains "frontend\Dockerfile.production" 'apk upgrade --no-cache' "Frontend operating-system package upgrade"
Test-FileContains "frontend\Dockerfile.production" '(?m)^USER\s+101\s*$' "Frontend runtime runs as non-root UID 101"
Test-FileContains "ai-service\Dockerfile" 'USER\s+10001:10001' "AI development image runs as non-root"

Write-Host ""
Write-Host "==> Live hardened services"
foreach ($Container in @("salonai-backend", "salonai-frontend")) {
    try {
        $StateJson = docker inspect $Container --format '{{json .State}}' 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $StateJson) {
            Add-Fail "$Container exists"
            continue
        }
        $State = $StateJson | ConvertFrom-Json
        if ($State.Running -eq $true) { Add-Pass "$Container is running" } else { Add-Fail "$Container is running" }
        if ($null -ne $State.Health -and $State.Health.Status -eq "healthy") {
            Add-Pass "$Container is healthy"
        }
        else {
            Add-Fail "$Container is healthy"
        }
    }
    catch {
        Add-Fail "$Container inspection failed"
    }
}

try {
    $FrontendUser = (docker inspect salonai-frontend --format '{{.Config.User}}' 2>$null).Trim()
    if ($FrontendUser -match '^101(?::101)?$') {
        Add-Pass "Frontend container runs as UID 101"
    }
    else {
        Add-Fail "Frontend container user is '$FrontendUser'"
    }
}
catch {
    Add-Fail "Unable to inspect frontend container user"
}

if ($RunEnforcedGate) {
    Write-Host ""
    Write-Host "==> Enforced release gate"
    $GateScript = Join-Path $ProjectRoot "scripts\security\run-release-security-gate.ps1"
    try {
        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $GateScript `
            -ProjectRoot $ProjectRoot `
            -Enforce

        if ($LASTEXITCODE -eq 0) {
            Add-Pass "Release security gate passed"
        }
        else {
            Add-Fail "Release security gate exited with code $LASTEXITCODE"
        }
    }
    catch {
        Add-Fail "Release security gate - $($_.Exception.Message)"
    }

    $LatestReport = Join-Path $ProjectRoot "security-reports\release-gate\latest.json"
    if (Test-Path -LiteralPath $LatestReport -PathType Leaf) {
        try {
            $Report = Get-Content -LiteralPath $LatestReport -Raw | ConvertFrom-Json
            $ImageCritical = @($Report.images | ForEach-Object { [int]$_.criticalVulnerabilities } | Measure-Object -Sum).Sum
            if ($null -eq $ImageCritical) { $ImageCritical = 0 }
            if ([int]$ImageCritical -eq 0) { Add-Pass "No critical image vulnerabilities" } else { Add-Fail "Critical image vulnerabilities: $ImageCritical" }
            if ([int]$Report.repository.highMisconfigurations -eq 0 -and [int]$Report.repository.criticalMisconfigurations -eq 0) {
                Add-Pass "No high or critical repository misconfigurations"
            }
            else {
                Add-Fail "Repository misconfigurations remain"
            }
            if (-not [bool]$Report.blocked) { Add-Pass "Release report is not blocked" } else { Add-Fail "Release report remains blocked" }
        }
        catch {
            Add-Fail "Unable to parse latest release-gate report"
        }
    }
    else {
        Add-Fail "Latest release-gate report is missing"
    }
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Skipped: 0"

if ($Failed -gt 0) {
    exit 1
}

Write-Host ""
Write-Host "SalonAI Phase 7.11 security remediation verified successfully." -ForegroundColor Green
exit 0
