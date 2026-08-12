param(
    [string]$ProjectRoot = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI",
    [string]$OutputDirectory = "$env:USERPROFILE\Downloads"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "SalonAI project folder not found: $ProjectRoot"
}

Set-Location -LiteralPath $ProjectRoot

$repositoryRoot = (git rev-parse --show-toplevel 2>$null)

if ($LASTEXITCODE -ne 0 -or -not $repositoryRoot) {
    throw "The selected project folder is not a Git repository."
}

$status = @(git status --porcelain)

if ($status.Count -gt 0) {
    Write-Host "Working tree is not clean." -ForegroundColor Yellow
    Write-Host "Commit or intentionally stash your changes before creating a release/share archive."
    Write-Host ""
    git status --short
    exit 2
}

$sha = (git rev-parse --short=12 HEAD).Trim()
$branch = (git branch --show-current).Trim()

if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "SalonAI-source-$branch-$sha-$timestamp.zip"
$outputPath = Join-Path $OutputDirectory $fileName

git archive `
    --format=zip `
    --output="$outputPath" `
    HEAD

if ($LASTEXITCODE -ne 0) {
    throw "git archive failed."
}

Write-Host ""
Write-Host "[PASS] Created tracked-source archive:" -ForegroundColor Green
Write-Host $outputPath
Write-Host ""
Write-Host "The archive contains tracked files from HEAD only."
Write-Host "It does not include .git, node_modules, virtual environments, build output, local .env files or untracked backups."
