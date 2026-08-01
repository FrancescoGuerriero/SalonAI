param(
    [string]$ProjectRoot = (
        Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    ),

    [switch]$Enforce,

    [switch]$SkipImageScans
)

# SALONAI_PHASE_7_12_RELEASE_GATE_VERSION=3

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ReportsRoot = Join-Path $ProjectRoot "security-reports"
$TrivyRoot = Join-Path $ReportsRoot "trivy"
$GateRoot = Join-Path $ReportsRoot "release-gate"
$PolicyPath = Join-Path $ProjectRoot "config\security\release-policy.json"
$Runner = Join-Path $PSScriptRoot "invoke-trivy.ps1"
$ComposeAudit = Join-Path $PSScriptRoot "test-compose-security.ps1"
$SecretAudit = Join-Path $PSScriptRoot "test-production-secrets.ps1"
$SbomScript = Join-Path $PSScriptRoot "generate-sbom.ps1"
$IgnorePath = Join-Path $ProjectRoot "config\security\trivyignore.yaml"
$ExceptionPath = Join-Path $ProjectRoot "config\security\dependency-exceptions.json"
$PostureScript = Join-Path $PSScriptRoot "test-phase7-12-dependency-posture.ps1"

foreach ($Directory in @($ReportsRoot, $TrivyRoot, $GateRoot)) {
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
}


# Remove any stale report from an earlier gate run. A failed scan must never
# leave the verifier reading evidence from a previous phase or execution.
$LatestPath = Join-Path $GateRoot "latest.json"
Remove-Item -LiteralPath $LatestPath -Force -ErrorAction SilentlyContinue

foreach ($Path in @(
    $PolicyPath,
    $Runner,
    $ComposeAudit,
    $SecretAudit,
    $SbomScript,
    $IgnorePath,
    $ExceptionPath,
    $PostureScript
)) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Phase 7.11 dependency was not found: $Path"
    }
}

$Policy = Get-Content -LiteralPath $PolicyPath -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "SalonAI Phase 7.12 release security gate" -ForegroundColor Magenta
Write-Host "Mode: $(if ($Enforce) { 'ENFORCE' } else { 'AUDIT' })"

& $PostureScript -ProjectRoot $ProjectRoot
& $ComposeAudit -ProjectRoot $ProjectRoot -Enforce:$Enforce
& $SecretAudit -ProjectRoot $ProjectRoot -Enforce:$Enforce

$SkipArguments = @(
    "--skip-dirs", "/workspace/.git",
    "--skip-dirs", "/workspace/backups",
    "--skip-dirs", "/workspace/security-reports",
    "--skip-dirs", "/workspace/backend/node_modules",
    "--skip-dirs", "/workspace/frontend/node_modules",
    "--skip-dirs", "/workspace/frontend/dist",
    "--skip-dirs", "/workspace/ai-service/.venv",
    "--skip-files", "/workspace/.env.production",
    "--skip-files", "/workspace/backend/.env.production",
    "--skip-files", "/workspace/ai-service/.env.production"
)

Write-Host ""
Write-Host "==> Scanning unfiltered repository dependency baseline" -ForegroundColor Cyan
$BaselineArguments = @(
    "fs", "--quiet", "--no-progress", "--timeout", "15m",
    "--scanners", "vuln", "--severity", "HIGH,CRITICAL", "--ignore-unfixed",
    "--format", "json", "--output", "/reports/trivy/repository-baseline.json"
) + $SkipArguments + @("/workspace")
& $Runner -ProjectRoot $ProjectRoot -ReportsRoot $ReportsRoot -TrivyArguments $BaselineArguments

Write-Host "==> Scanning repository vulnerabilities, secrets and configuration" -ForegroundColor Cyan

$RepositoryArguments = @(
    "fs",
    "--quiet",
    "--no-progress",
    "--timeout", "15m",
    "--scanners", "vuln,secret,misconfig",
    "--severity", "HIGH,CRITICAL",
    "--ignore-unfixed",
    "--ignorefile", "/config/trivyignore.yaml",
    "--format", "json",
    "--output", "/reports/trivy/repository.json"
) + $SkipArguments + @("/workspace")

& $Runner `
    -ProjectRoot $ProjectRoot `
    -ReportsRoot $ReportsRoot `
    -TrivyArguments $RepositoryArguments

function Get-PropertyArray {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return @()
    }

    $Property = $Object.PSObject.Properties[$Name]

    if ($null -eq $Property -or $null -eq $Property.Value) {
        return @()
    }

    return @($Property.Value)
}

function Get-TrivySummary {
    param([string]$Path)

    $Document = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    $Summary = [ordered]@{
        criticalVulnerabilities = 0
        highVulnerabilities = 0
        secrets = 0
        criticalMisconfigurations = 0
        highMisconfigurations = 0
    }

    foreach ($Result in @(Get-PropertyArray $Document "Results")) {
        foreach ($Vulnerability in @(Get-PropertyArray $Result "Vulnerabilities")) {
            if ($Vulnerability.Severity -eq "CRITICAL") {
                $Summary.criticalVulnerabilities++
            }
            elseif ($Vulnerability.Severity -eq "HIGH") {
                $Summary.highVulnerabilities++
            }
        }

        $Summary.secrets += @(Get-PropertyArray $Result "Secrets").Count

        foreach ($Misconfiguration in @(Get-PropertyArray $Result "Misconfigurations")) {
            if ($Misconfiguration.Status -and $Misconfiguration.Status -ne "FAIL") {
                continue
            }

            if ($Misconfiguration.Severity -eq "CRITICAL") {
                $Summary.criticalMisconfigurations++
            }
            elseif ($Misconfiguration.Severity -eq "HIGH") {
                $Summary.highMisconfigurations++
            }
        }
    }

    return [pscustomobject]$Summary
}

$RepositoryReport = Join-Path $TrivyRoot "repository.json"
$RepositoryBaselineReport = Join-Path $TrivyRoot "repository-baseline.json"

foreach ($ExpectedReport in @($RepositoryReport, $RepositoryBaselineReport)) {
    if (-not (Test-Path -LiteralPath $ExpectedReport)) {
        throw "Trivy did not produce the expected report: $ExpectedReport"
    }
}

$RepositorySummary = Get-TrivySummary $RepositoryReport
$RepositoryBaselineSummary = Get-TrivySummary $RepositoryBaselineReport
$ImageSummaries = [System.Collections.Generic.List[object]]::new()

$AppVersion = "7.2.0"
$EnvironmentFile = Join-Path $ProjectRoot ".env.production"

if (Test-Path -LiteralPath $EnvironmentFile) {
    $VersionLine = Get-Content -LiteralPath $EnvironmentFile |
        Where-Object { $_ -match '^\s*APP_VERSION\s*=' } |
        Select-Object -First 1

    if ($VersionLine) {
        $ParsedVersion = ($VersionLine.Split('=', 2)[1]).Trim().Trim('"').Trim("'")

        if ($ParsedVersion) {
            $AppVersion = $ParsedVersion
        }
    }
}

if (-not $SkipImageScans) {
    $Images = [ordered]@{
        backend = "salonai/backend:$AppVersion"
        frontend = "salonai/frontend:$AppVersion"
        aiService = "salonai/ai-service:$AppVersion"
    }

    foreach ($ImageProperty in $Images.GetEnumerator()) {
        $ImageName = $ImageProperty.Value
        $Slug = $ImageProperty.Key

        $global:LASTEXITCODE = 0
        & docker image inspect $ImageName *> $null

        if ($LASTEXITCODE -ne 0) {
            $ImageSummaries.Add([pscustomobject]@{
                image = $ImageName
                scanned = $false
                criticalVulnerabilities = 0
                highVulnerabilities = 0
                reason = "local image not found"
            })
            continue
        }

        Write-Host "==> Scanning image $ImageName" -ForegroundColor Cyan

        $ImageArguments = @(
            "image",
            "--quiet",
            "--no-progress",
            "--timeout", "15m",
            "--scanners", "vuln",
            "--severity", "HIGH,CRITICAL",
            "--ignore-unfixed",
            "--ignorefile", "/config/trivyignore.yaml",
            "--format", "json",
            "--output", "/reports/trivy/image-$Slug.json",
            $ImageName
        )

        & $Runner `
            -ProjectRoot $ProjectRoot `
            -ReportsRoot $ReportsRoot `
            -UseDockerSocket `
            -TrivyArguments $ImageArguments

        $ImageReport = Join-Path $TrivyRoot "image-$Slug.json"
        $ImageSummary = Get-TrivySummary $ImageReport

        $ImageSummaries.Add([pscustomobject]@{
            image = $ImageName
            scanned = $true
            criticalVulnerabilities = $ImageSummary.criticalVulnerabilities
            highVulnerabilities = $ImageSummary.highVulnerabilities
            report = "image-$Slug.json"
        })
    }
}

& $SbomScript `
    -ProjectRoot $ProjectRoot `
    -SkipImages:$SkipImageScans

$ComposeReport = Get-Content `
    -LiteralPath (Join-Path $ReportsRoot "compose\compose-security.json") `
    -Raw | ConvertFrom-Json

$SecretReport = Get-Content `
    -LiteralPath (Join-Path $ReportsRoot "secrets\production-environment-audit.json") `
    -Raw | ConvertFrom-Json

$ImageCritical = (
    $ImageSummaries | Measure-Object -Property criticalVulnerabilities -Sum
).Sum

if ($null -eq $ImageCritical) {
    $ImageCritical = 0
}

$MisconfigurationTotal = `
    $RepositorySummary.criticalMisconfigurations + `
    $RepositorySummary.highMisconfigurations

$BlockedReasons = [System.Collections.Generic.List[string]]::new()

if (
    $Policy.enforcement.blockDetectedSecrets -and
    $RepositorySummary.secrets -gt 0
) {
    $BlockedReasons.Add("Repository secret findings exceed policy.")
}

if (
    $RepositorySummary.criticalVulnerabilities -gt
    $Policy.enforcement.maximumCriticalRepositoryVulnerabilities
) {
    $BlockedReasons.Add("Critical repository vulnerabilities exceed policy.")
}

if (
    $RepositorySummary.highVulnerabilities -gt
    $Policy.enforcement.maximumHighRepositoryVulnerabilities
) {
    $BlockedReasons.Add("Unapproved high repository vulnerabilities exceed policy.")
}

if (
    $ImageCritical -gt
    $Policy.enforcement.maximumCriticalImageVulnerabilities
) {
    $BlockedReasons.Add("Critical image vulnerabilities exceed policy.")
}

if (
    $MisconfigurationTotal -gt
    $Policy.enforcement.maximumHighOrCriticalMisconfigurations
) {
    $BlockedReasons.Add("High or critical misconfigurations exceed policy.")
}

if (
    $Policy.enforcement.blockTrackedProductionEnvironmentFiles -and
    $SecretReport.summary.critical -gt 0
) {
    $BlockedReasons.Add("Production environment controls exceed policy.")
}

if ($ComposeReport.summary.critical -gt 0) {
    $BlockedReasons.Add("Critical Docker Compose controls exceed policy.")
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Summary = [ordered]@{
    schemaVersion = 1
    phase = "7.12"
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    mode = $(if ($Enforce) { "enforce" } else { "audit" })
    trivyImage = $Policy.trivyImage
    repository = $RepositorySummary
    repositoryBaseline = $RepositoryBaselineSummary
    dependencyExceptionFile = "config/security/dependency-exceptions.json"
    images = @($ImageSummaries)
    compose = $ComposeReport.summary
    productionSecrets = $SecretReport.summary
    blocked = ($BlockedReasons.Count -gt 0)
    blockedReasons = @($BlockedReasons)
}

$TimestampPath = Join-Path $GateRoot "release-gate-$Timestamp.json"

$Summary | ConvertTo-Json -Depth 12 | Set-Content `
    -LiteralPath $LatestPath `
    -Encoding utf8

Copy-Item -LiteralPath $LatestPath -Destination $TimestampPath -Force

Write-Host ""
Write-Host "Release security summary" -ForegroundColor Magenta
Write-Host "Repository critical vulnerabilities: $($RepositorySummary.criticalVulnerabilities)"
Write-Host "Repository high vulnerabilities (raw): $($RepositoryBaselineSummary.highVulnerabilities)"
Write-Host "Repository high vulnerabilities (unapproved): $($RepositorySummary.highVulnerabilities)"
Write-Host "Detected secrets: $($RepositorySummary.secrets)"
Write-Host "High/critical misconfigurations: $MisconfigurationTotal"
Write-Host "Image critical vulnerabilities: $ImageCritical"
Write-Host "Report: $LatestPath" -ForegroundColor DarkGray

if ($BlockedReasons.Count -eq 0) {
    Write-Host "[PASS] Release security policy passed." -ForegroundColor Green
}
elseif ($Enforce) {
    foreach ($Reason in $BlockedReasons) {
        Write-Host "[BLOCK] $Reason" -ForegroundColor Red
    }

    throw "Release security gate blocked the release."
}
else {
    foreach ($Reason in $BlockedReasons) {
        Write-Host "[AUDIT] $Reason" -ForegroundColor Yellow
    }

    Write-Host "[PASS] Security audit completed; enforcement was not requested." -ForegroundColor Green
}
