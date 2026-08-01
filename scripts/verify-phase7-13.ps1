param(
    [string]$ProjectRoot = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Passed = 0
$Failed = 0
$Skipped = 0

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([Parameter(Mandatory)][string]$Message)
    $script:Passed++
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([Parameter(Mandatory)][string]$Message)
    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Test-Check {
    param(
        [Parameter(Mandatory)][bool]$Condition,
        [Parameter(Mandatory)][string]$Message
    )
    if ($Condition) { Write-Pass $Message } else { Write-Fail $Message }
}

function Get-Text {
    param([Parameter(Mandatory)][string]$RelativePath)
    $Path = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    return Get-Content -LiteralPath $Path -Raw
}

Write-Host ""
Write-Host "SalonAI Phase 7.13 verification" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

$RequiredFiles = @(
    ".github\workflows\ci.yml",
    ".github\workflows\codeql.yml",
    ".github\workflows\release.yml",
    ".github\dependabot.yml",
    ".github\dependency-review-config.yml",
    ".github\CODEOWNERS",
    "config\release\phase7-13-policy.json",
    "scripts\ci\validate-release-tag.mjs",
    "scripts\ci\write-image-evidence.mjs",
    "scripts\ci\create-release-manifest.mjs",
    "scripts\ci\check-workflow-security.mjs",
    "scripts\release\publish-release-tag.ps1",
    "scripts\release\verify-ghcr-attestations.ps1",
    "docs\operations\phase7-13-ci-cd-release-automation.md",
    "docs\runbooks\phase7-13-ci-cd-failure.md",
    "config\security\trivyignore.yaml",
    "scripts\security\run-release-security-gate.ps1"
)

Write-Step "Required files"
foreach ($RelativePath in $RequiredFiles) {
    Test-Check (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath)) $RelativePath
}

Write-Step "Application release inputs"
foreach ($RelativePath in @(
    "backend\package-lock.json",
    "backend\Dockerfile.production",
    "frontend\package-lock.json",
    "frontend\Dockerfile.production",
    "ai-service\Dockerfile.production"
)) {
    Test-Check (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath)) $RelativePath
}

$Ci = Get-Text ".github\workflows\ci.yml"
$Codeql = Get-Text ".github\workflows\codeql.yml"
$Release = Get-Text ".github\workflows\release.yml"
$Dependabot = Get-Text ".github\dependabot.yml"
$PolicyText = Get-Text "config\release\phase7-13-policy.json"

Write-Step "CI controls"
Test-Check ($Ci -match "pull_request:") "Pull-request CI trigger"
Test-Check ($Ci -match "push:") "Main-branch CI trigger"
Test-Check ($Ci -match "npm run validate") "Backend validation job"
Test-Check ($Ci -match "npm run build") "Frontend production-build job"
Test-Check ($Ci -match "python -m pytest") "AI-service test job"
Test-Check ($Ci -match "dependency-review-action@v4\.8\.3") "Dependency review enforcement"
Test-Check ($Ci -match "aquasecurity/trivy-action@v0\.36\.0") "Trivy repository gate"
Test-Check ($Ci -match "config/security/trivyignore.yaml") "Controlled dependency exceptions used in CI"
Test-Check ($Ci -match "github/codeql-action/upload-sarif@v4") "Trivy SARIF publication"
Test-Check ($Ci -match "CI complete") "Aggregate required-check job"

Write-Step "Code scanning controls"
Test-Check ($Codeql -match "javascript-typescript") "CodeQL JavaScript analysis"
Test-Check ($Codeql -match "python") "CodeQL Python analysis"
Test-Check ($Codeql -match "security-extended") "CodeQL security-extended queries"
Test-Check ($Codeql -match "schedule:") "Scheduled CodeQL scan"
Test-Check ($Codeql -match "security-events:\s*write") "CodeQL security-event permission"

Write-Step "Release and supply-chain controls"
Test-Check ($Release -match "tags:") "Semantic release-tag trigger"
Test-Check ($Release -match "id-token:\s*write") "OIDC permission"
Test-Check ($Release -match "attestations:\s*write") "Attestation permission"
Test-Check ($Release -match "packages:\s*write") "GHCR publication permission"
Test-Check ($Release -match "docker/build-push-action@v7\.2\.0") "Production image build and push"
Test-Check ($Release -match "backend/Dockerfile.production") "Backend production image"
Test-Check ($Release -match "frontend/Dockerfile.production") "Frontend production image"
Test-Check ($Release -match "ai-service/Dockerfile.production") "AI-service production image"
Test-Check ($Release -match "format:\s*cyclonedx") "CycloneDX SBOM generation"
Test-Check ($Release -match "actions/attest@v4") "Signed build provenance"
Test-Check ($Release -match "sbom-path:") "Signed SBOM attestation"
Test-Check ($Release -match "create-release-manifest.mjs") "Release manifest generation"
Test-Check ($Release -match "rollback-metadata.json") "Rollback metadata publication"
Test-Check ($Release -match "gh release create") "GitHub release publication"

Write-Step "Workflow security"
$AllWorkflowText = "$Ci`n$Codeql`n$Release"
Test-Check ($AllWorkflowText -notmatch "pull_request_target:") "No pull_request_target execution"
Test-Check ($AllWorkflowText -notmatch "persist-credentials:\s*true") "Checkout credentials are not persisted"
Test-Check ($AllWorkflowText -notmatch "uses:\s*[^\s]+@(main|master|latest)\b") "No floating main, master or latest action references"
Test-Check ($Release -notmatch "environment:\s*production") "Release workflow does not pretend to deploy to an unconfigured environment"

Write-Step "Automated dependency maintenance"
Test-Check ($Dependabot -match "package-ecosystem:\s*github-actions") "GitHub Actions updates"
Test-Check (([regex]::Matches($Dependabot, "package-ecosystem:\s*npm")).Count -eq 2) "Backend and frontend npm updates"
Test-Check ($Dependabot -match "package-ecosystem:\s*pip") "AI-service Python updates"
Test-Check (([regex]::Matches($Dependabot, "package-ecosystem:\s*docker")).Count -eq 3) "Three Dockerfile update streams"
Test-Check ($Dependabot -match "timezone:\s*Europe/London") "London maintenance schedule"

Write-Step "Configuration validity"
try {
    $Policy = $PolicyText | ConvertFrom-Json
    Write-Pass "Release policy JSON"
    Test-Check ($Policy.phase -eq "7.13") "Release policy phase identity"
    Test-Check (@($Policy.services).Count -eq 3) "Three governed release services"
    Test-Check ($Policy.security.trivyIgnoreFile -eq "config/security/trivyignore.yaml") "Phase 7.12 exception continuity"
}
catch {
    Write-Fail "Release policy JSON - $($_.Exception.Message)"
}

Write-Step "Script syntax"
$PowerShellFiles = @(
    "scripts\release\publish-release-tag.ps1",
    "scripts\release\verify-ghcr-attestations.ps1",
    "scripts\verify-phase7-13.ps1"
)
foreach ($RelativePath in $PowerShellFiles) {
    $Tokens = $null
    $Errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        (Join-Path $ProjectRoot $RelativePath),
        [ref]$Tokens,
        [ref]$Errors
    )
    Test-Check (@($Errors).Count -eq 0) "PowerShell syntax: $RelativePath"
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $Node) {
    $Skipped += 4
    Write-Host "[SKIP] Node.js syntax and workflow-security execution" -ForegroundColor Yellow
}
else {
    foreach ($RelativePath in @(
        "scripts\ci\validate-release-tag.mjs",
        "scripts\ci\write-image-evidence.mjs",
        "scripts\ci\create-release-manifest.mjs",
        "scripts\ci\check-workflow-security.mjs"
    )) {
        & node --check (Join-Path $ProjectRoot $RelativePath)
        Test-Check ($LASTEXITCODE -eq 0) "Node syntax: $RelativePath"
    }

    Push-Location $ProjectRoot
    try {
        & node ".\scripts\ci\check-workflow-security.mjs"
        Test-Check ($LASTEXITCODE -eq 0) "Workflow security policy execution"

        & node ".\scripts\ci\validate-release-tag.mjs" "v7.13.0" | Out-Null
        Test-Check ($LASTEXITCODE -eq 0) "Valid release-tag acceptance"

        $InvalidTagStdOut = Join-Path ([System.IO.Path]::GetTempPath()) ("salonai-phase7-13-invalid-tag-{0}.out" -f [guid]::NewGuid().ToString("N"))
        $InvalidTagStdErr = Join-Path ([System.IO.Path]::GetTempPath()) ("salonai-phase7-13-invalid-tag-{0}.err" -f [guid]::NewGuid().ToString("N"))

        try {
            $InvalidTagProcess = Start-Process `
                -FilePath $Node.Source `
                -ArgumentList @(
                    (Join-Path $ProjectRoot "scripts\ci\validate-release-tag.mjs"),
                    "release-latest"
                ) `
                -NoNewWindow `
                -Wait `
                -PassThru `
                -RedirectStandardOutput $InvalidTagStdOut `
                -RedirectStandardError $InvalidTagStdErr

            Test-Check ($InvalidTagProcess.ExitCode -ne 0) "Invalid release-tag rejection"
        }
        finally {
            Remove-Item -LiteralPath $InvalidTagStdOut -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $InvalidTagStdErr -Force -ErrorAction SilentlyContinue
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Skipped: $Skipped"

if ($Failed -gt 0) {
    Write-Host "Phase 7.13 verification failed." -ForegroundColor Red
    exit 1
}

Write-Host "`nSalonAI Phase 7.13 verified successfully." -ForegroundColor Green
exit 0
