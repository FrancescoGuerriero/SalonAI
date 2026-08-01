param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$Destination = "deployment-evidence\phase7-15\inputs.json",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Source = Join-Path $ProjectRoot "config\phase7-15.inputs.example.json"
$DestinationPath = if ([System.IO.Path]::IsPathRooted($Destination)) {
    $Destination
}
else {
    Join-Path $ProjectRoot $Destination
}

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Phase 7.15 input example is missing: $Source"
}

if ((Test-Path -LiteralPath $DestinationPath -PathType Leaf) -and -not $Force) {
    Write-Host "[SKIP] Input file already exists: $DestinationPath" -ForegroundColor Yellow
    exit 0
}

$DestinationDirectory = Split-Path -Parent $DestinationPath
New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
Copy-Item -LiteralPath $Source -Destination $DestinationPath -Force

Write-Host "[PASS] Created untracked Phase 7.15 input file." -ForegroundColor Green
Write-Host "Edit this file before the readiness run:"
Write-Host $DestinationPath
