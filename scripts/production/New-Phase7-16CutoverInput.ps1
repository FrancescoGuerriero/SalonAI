param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$Destination = "deployment-evidence\phase7-16\cutover-inputs.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Source = Join-Path $ProjectRoot "config\phase7-16.cutover.example.json"
$DestinationPath = if ([System.IO.Path]::IsPathRooted($Destination)) {
    $Destination
}
else {
    Join-Path $ProjectRoot $Destination
}

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Phase 7.16 example input is missing: $Source"
}

if (Test-Path -LiteralPath $DestinationPath -PathType Leaf) {
    throw "Cutover input already exists: $DestinationPath"
}

$DestinationDirectory = Split-Path -Parent $DestinationPath
New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null

Copy-Item -LiteralPath $Source -Destination $DestinationPath -Force

& git -C $ProjectRoot check-ignore --quiet -- $DestinationPath
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $DestinationPath -Force -ErrorAction SilentlyContinue
    throw "The cutover input path is not ignored by Git. No file was retained."
}

Write-Host "[PASS] Created ignored Phase 7.16 cutover input." -ForegroundColor Green
Write-Host "Edit before running preflight:"
Write-Host $DestinationPath
