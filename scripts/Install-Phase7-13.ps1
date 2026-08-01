param(
    [string]$ProjectRoot = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI",
    [switch]$RunVerification
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-Path {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not found: $Path"
    }
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$PayloadRoot = Join-Path $PSScriptRoot "payload"

Write-Host ""
Write-Host "SalonAI Phase 7.13 installation" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

Assert-Path $PayloadRoot "Phase 7.13 payload"
Assert-Path (Join-Path $ProjectRoot "backend") "Backend directory"
Assert-Path (Join-Path $ProjectRoot "frontend") "Frontend directory"
Assert-Path (Join-Path $ProjectRoot "ai-service") "AI-service directory"
Assert-Path (Join-Path $ProjectRoot "config\security\trivyignore.yaml") "Phase 7.12 Trivy exception file"
Assert-Path (Join-Path $ProjectRoot "scripts\security\run-release-security-gate.ps1") "Phase 7.12 release gate"

$RelativeFiles = @(
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
    "scripts\verify-phase7-13.ps1",
    "docs\operations\phase7-13-ci-cd-release-automation.md",
    "docs\runbooks\phase7-13-ci-cd-failure.md"
)

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "backups\phase7-13-installer-$Timestamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

Write-Step "Backing up current files"

foreach ($RelativePath in $RelativeFiles) {
    $DestinationPath = Join-Path $ProjectRoot $RelativePath

    if (Test-Path -LiteralPath $DestinationPath) {
        $BackupPath = Join-Path $BackupRoot $RelativePath
        $BackupDirectory = Split-Path -Parent $BackupPath
        New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
        Copy-Item -LiteralPath $DestinationPath -Destination $BackupPath -Force
        Write-Host "[BACKUP] $RelativePath" -ForegroundColor DarkYellow
    }
}

Write-Step "Installing complete Phase 7.13 files"

foreach ($RelativePath in $RelativeFiles) {
    $SourcePath = Join-Path $PayloadRoot $RelativePath
    $DestinationPath = Join-Path $ProjectRoot $RelativePath

    Assert-Path $SourcePath "Payload file $RelativePath"

    $DestinationDirectory = Split-Path -Parent $DestinationPath
    New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
    Write-Host "[INSTALLED] $RelativePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "[PASS] Phase 7.13 CI/CD files installed." -ForegroundColor Green
Write-Host "Backup: $BackupRoot" -ForegroundColor DarkGray
Write-Host "No dependencies, containers, environment files or application source files were changed." -ForegroundColor DarkCyan

if ($RunVerification) {
    Write-Step "Running Phase 7.13 verification"

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File (Join-Path $ProjectRoot "scripts\verify-phase7-13.ps1") `
        -ProjectRoot $ProjectRoot

    if ($LASTEXITCODE -ne 0) {
        throw "Phase 7.13 verification failed with exit code $LASTEXITCODE."
    }
}

Write-Host ""
Write-Host "SalonAI Phase 7.13 installed successfully." -ForegroundColor Green
Write-Host "Commit and push the installed files before expecting GitHub Actions to run." -ForegroundColor Cyan
