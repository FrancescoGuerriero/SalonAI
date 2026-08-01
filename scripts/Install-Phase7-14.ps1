param(
    [string]$ProjectRoot = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ExpectedRemote = "https://github.com/FrancescoGuerriero/SalonAI.git"
$ExpectedBranch = "phase-7.14-production-deployment"
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadRoot = Join-Path $PackageRoot "payload"

function Get-CompatibleRelativePath {
    param(
        [Parameter(Mandatory)][string]$BasePath,
        [Parameter(Mandatory)][string]$TargetPath
    )

    $TrimCharacters = [char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )

    $BaseFullPath = [System.IO.Path]::GetFullPath($BasePath).TrimEnd($TrimCharacters)
    $TargetFullPath = [System.IO.Path]::GetFullPath($TargetPath)
    $BasePrefix = $BaseFullPath + [System.IO.Path]::DirectorySeparatorChar

    if (-not $TargetFullPath.StartsWith(
        $BasePrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Target path is outside the base path. Base: $BaseFullPath Target: $TargetFullPath"
    }

    return $TargetFullPath.Substring($BasePrefix.Length)
}

function Invoke-Git {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $Output = & git -C $ProjectRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git -C `"$ProjectRoot`" $($Arguments -join ' ')`n$($Output -join [Environment]::NewLine)"
    }
    return @($Output)
}

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project directory does not exist: $ProjectRoot"
}
if (-not (Test-Path -LiteralPath $PayloadRoot -PathType Container)) {
    throw "Package payload is missing: $PayloadRoot"
}

$PathTrimCharacters = [char[]]@(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
)
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd($PathTrimCharacters)
$GitRoot = ((Invoke-Git -Arguments @("rev-parse", "--show-toplevel")) -join "").Trim()
$GitRoot = [System.IO.Path]::GetFullPath($GitRoot).TrimEnd($PathTrimCharacters)
if (-not $GitRoot.Equals($ProjectRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Incorrect Git root: $GitRoot"
}

$Remote = ((Invoke-Git -Arguments @("remote", "get-url", "origin")) -join "").Trim()
if ($Remote -ne $ExpectedRemote) {
    throw "Incorrect origin remote: $Remote"
}

$Branch = ((Invoke-Git -Arguments @("branch", "--show-current")) -join "").Trim()
if ($Branch -ne $ExpectedBranch) {
    throw "Incorrect branch. Expected '$ExpectedBranch'; found '$Branch'."
}

$Status = Invoke-Git -Arguments @("status", "--porcelain")
if (-not [string]::IsNullOrWhiteSpace(($Status -join ""))) {
    throw "Working tree is not clean."
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "backups\phase7-14-install-$Timestamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$Installed = 0
$BackedUp = 0
Get-ChildItem -LiteralPath $PayloadRoot -File -Recurse |
    Sort-Object FullName |
    ForEach-Object {
        $RelativePath = Get-CompatibleRelativePath -BasePath $PayloadRoot -TargetPath $_.FullName
        $Destination = Join-Path $ProjectRoot $RelativePath

        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
            $BackupPath = Join-Path $BackupRoot $RelativePath
            New-Item -ItemType Directory -Path (Split-Path -Parent $BackupPath) -Force | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $BackupPath -Force
            $BackedUp++
        }

        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Force
        $Installed++
    }

Write-Host "Files installed: $Installed" -ForegroundColor Green
Write-Host "Existing files backed up: $BackedUp"
Write-Host "Backup directory: $BackupRoot"

$Verifier = Join-Path $ProjectRoot "scripts\verify-phase7-14.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $Verifier -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
    throw "Phase 7.14 verification failed. Nothing was staged, committed or pushed."
}

Write-Host "[PASS] Phase 7.14 installation and verification completed." -ForegroundColor Green
