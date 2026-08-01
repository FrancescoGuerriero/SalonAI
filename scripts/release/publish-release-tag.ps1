param(
    [Parameter(Mandatory)][string]$Version,
    [string]$ProjectRoot = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI",
    [switch]$AllowDirtyWorkingTree
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Version = $Version.Trim()

if ($Version.StartsWith("v")) {
    $Tag = $Version
}
else {
    $Tag = "v$Version"
}

if ($Tag -notmatch '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
    throw "Version must use MAJOR.MINOR.PATCH format, for example 7.3.0."
}

Push-Location $ProjectRoot
try {
    if (-not (Test-Path -LiteralPath ".git")) {
        throw "Project root is not a Git working tree: $ProjectRoot"
    }

    $Branch = (git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $Branch -ne "main") {
        throw "Release tags must be created from the main branch. Current branch: $Branch"
    }

    $Status = @(git status --porcelain)
    if (-not $AllowDirtyWorkingTree -and $Status.Count -gt 0) {
        throw "The working tree is not clean. Commit or stash changes before creating $Tag."
    }

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File ".\scripts\verify-phase7-13.ps1" `
        -ProjectRoot $ProjectRoot

    if ($LASTEXITCODE -ne 0) {
        throw "Phase 7.13 verification failed. The release tag was not created."
    }

    git fetch origin main --tags
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to fetch origin/main and tags."
    }

    $LocalHead = (git rev-parse HEAD).Trim()
    $RemoteMain = (git rev-parse origin/main).Trim()
    if ($LocalHead -ne $RemoteMain) {
        throw "Local main is not aligned with origin/main. Local: $LocalHead Remote: $RemoteMain"
    }

    git rev-parse --verify "refs/tags/$Tag" 2>$null
    if ($LASTEXITCODE -eq 0) {
        throw "Tag already exists locally: $Tag"
    }

    git tag -a $Tag -m "SalonAI release $Tag"
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to create annotated tag $Tag."
    }

    git push origin $Tag
    if ($LASTEXITCODE -ne 0) {
        git tag -d $Tag | Out-Null
        throw "Unable to push $Tag. The local tag was removed."
    }

    Write-Host ""
    Write-Host "[PASS] Published $Tag to origin." -ForegroundColor Green
    Write-Host "The SalonAI Release GitHub Actions workflow has been triggered." -ForegroundColor Cyan
}
finally {
    Pop-Location
}
