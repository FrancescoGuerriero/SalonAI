param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [switch]$RunLiveChecks,

    [switch]$SkipImageScans
)

# SALONAI_PHASE_7_11_VERIFIER_VERSION=1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Passed = 0
$Failed = 0
$Skipped = 0

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    $script:Passed++
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Skip {
    param([string]$Message)
    $script:Skipped++
    Write-Host "[SKIP] $Message" -ForegroundColor Yellow
}

function Test-Check {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if ($Condition) {
        Write-Pass $Message
    }
    else {
        Write-Fail $Message
    }
}

function Get-FileText {
    param([string]$RelativePath)
    $Path = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    return Get-Content -LiteralPath $Path -Raw
}

function Invoke-ScriptCheck {
    param(
        [string]$Message,
        [string]$ScriptPath,
        [hashtable]$Parameters
    )

    try {
        & $ScriptPath @Parameters
        Write-Pass $Message
        return $true
    }
    catch {
        Write-Fail "$Message - $($_.Exception.Message)"
        return $false
    }
}

Write-Host ""
Write-Host "SalonAI Phase 7.11 verification" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

$RequiredFiles = @(
    "config\security\release-policy.json",
    "config\security\scan-exclusions.txt",
    "scripts\security\invoke-trivy.ps1",
    "scripts\security\test-compose-security.ps1",
    "scripts\security\test-production-secrets.ps1",
    "scripts\security\generate-sbom.ps1",
    "scripts\security\run-release-security-gate.ps1",
    "scripts\collect-phase7-11-security-snapshot.ps1",
    "scripts\verify-phase7-11.ps1",
    "docs\operations\production-security.md",
    "docs\operations\release-security-gates.md",
    "docs\operations\software-bill-of-materials.md",
    "docs\runbooks\security-gate-failure.md",
    "docs\runbooks\suspected-secret-exposure.md"
)

Write-Step "Required files"

foreach ($RelativePath in $RequiredFiles) {
    Test-Check `
        (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath)) `
        $RelativePath
}

Write-Step "Static security implementation"

$RunnerText = Get-FileText "scripts\security\invoke-trivy.ps1"
$ComposeText = Get-FileText "scripts\security\test-compose-security.ps1"
$SecretText = Get-FileText "scripts\security\test-production-secrets.ps1"
$SbomText = Get-FileText "scripts\security\generate-sbom.ps1"
$GateText = Get-FileText "scripts\security\run-release-security-gate.ps1"
$SnapshotText = Get-FileText "scripts\collect-phase7-11-security-snapshot.ps1"

Test-Check `
    ($RunnerText -match 'aquasec/trivy:0\.70\.0') `
    "Pinned Trivy scanner image"

Test-Check `
    ($RunnerText -match 'salonai-trivy-cache') `
    "Persistent Trivy vulnerability database cache"

Test-Check `
    ($RunnerText -match 'readonly') `
    "Read-only project scanner mount"

Test-Check `
    ($ComposeText -match 'no-new-privileges') `
    "Docker Compose privilege policy"

Test-Check `
    ($ComposeText -match 'internal-service-ports') `
    "Internal service exposure policy"

Test-Check `
    ($ComposeText -match 'docker-socket-read-only') `
    "Docker socket access policy"

Test-Check `
    ($SecretText -match 'secretValuesIncluded = \$false') `
    "Secret-safe environment audit reports"

Test-Check `
    ($SecretText -match 'ls-files --error-unmatch') `
    "Git tracking check for production environment files"

Test-Check `
    ($SbomText -match 'cyclonedx') `
    "CycloneDX SBOM generation"

Test-Check `
    ($GateText -match 'vuln,secret,misconfig') `
    "Repository vulnerability, secret and misconfiguration scan"

Test-Check `
    ($GateText -match 'maximumCriticalImageVulnerabilities') `
    "Image vulnerability release threshold"

Test-Check `
    ($GateText -match 'Mode:.*ENFORCE') `
    "Enforceable release-gate mode"

Test-Check `
    ($SnapshotText -match 'environmentValuesIncluded = \$false') `
    "Secret-safe security evidence snapshot"

Write-Step "PowerShell and policy syntax"

foreach ($RelativePath in @($RequiredFiles | Where-Object { $_ -like '*.ps1' })) {
    $Path = Join-Path $ProjectRoot $RelativePath
    $Tokens = $null
    $Errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $Path,
        [ref]$Tokens,
        [ref]$Errors
    )

    Test-Check `
        (@($Errors).Count -eq 0) `
        "PowerShell syntax: $RelativePath"
}

try {
    $Policy = Get-Content `
        -LiteralPath (Join-Path $ProjectRoot "config\security\release-policy.json") `
        -Raw | ConvertFrom-Json

    Test-Check ($Policy.schemaVersion -eq 1) "Release policy JSON syntax"
    Test-Check `
        ($Policy.trivyImage -eq "aquasec/trivy:0.70.0") `
        "Release policy scanner version"
}
catch {
    Write-Fail "Release policy JSON syntax - $($_.Exception.Message)"
}

if ($RunLiveChecks) {
    Write-Step "Live security controls"

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Fail "Docker is required for live security checks."
    }
    else {
        $ComposeAuditPath = Join-Path `
            $ProjectRoot `
            "scripts\security\test-compose-security.ps1"

        $SecretAuditPath = Join-Path `
            $ProjectRoot `
            "scripts\security\test-production-secrets.ps1"

        $GatePath = Join-Path `
            $ProjectRoot `
            "scripts\security\run-release-security-gate.ps1"

        $null = Invoke-ScriptCheck `
            "Docker Compose security audit completed" `
            $ComposeAuditPath `
            @{ ProjectRoot = $ProjectRoot }

        $null = Invoke-ScriptCheck `
            "Production secret audit completed" `
            $SecretAuditPath `
            @{ ProjectRoot = $ProjectRoot }

        $null = Invoke-ScriptCheck `
            "Trivy release security audit completed" `
            $GatePath `
            @{
                ProjectRoot = $ProjectRoot
                SkipImageScans = [bool]$SkipImageScans
            }

        Write-Step "Generated security evidence"

        $EvidenceFiles = @(
            "security-reports\compose\compose-security.json",
            "security-reports\secrets\production-environment-audit.json",
            "security-reports\trivy\repository.json",
            "security-reports\release-gate\latest.json",
            "security-reports\sbom\salonai-repository.cdx.json",
            "security-reports\sbom\manifest.json"
        )

        foreach ($RelativePath in $EvidenceFiles) {
            $Path = Join-Path $ProjectRoot $RelativePath
            Test-Check `
                ((Test-Path -LiteralPath $Path) -and (Get-Item -LiteralPath $Path).Length -gt 0) `
                $RelativePath
        }

        try {
            $GateSummary = Get-Content `
                -LiteralPath (Join-Path $ProjectRoot "security-reports\release-gate\latest.json") `
                -Raw | ConvertFrom-Json

            Test-Check `
                ($GateSummary.mode -eq "audit") `
                "Release gate audit mode evidence"

            Test-Check `
                ($null -ne $GateSummary.repository) `
                "Repository security summary"
        }
        catch {
            Write-Fail "Release gate evidence JSON - $($_.Exception.Message)"
        }
    }
}
else {
    Write-Skip "Live Docker Compose security audit"
    Write-Skip "Live production secret audit"
    Write-Skip "Live Trivy repository and image scan"
    Write-Skip "Live CycloneDX SBOM generation"
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Magenta
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Skipped: $Skipped"

if ($Failed -gt 0) {
    exit 1
}

Write-Host ""
Write-Host "SalonAI Phase 7.11 verified successfully." -ForegroundColor Green
exit 0
