param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$InputFile = "deployment-evidence\phase7-16\cutover-inputs.json",
    [Parameter(Mandatory)][string]$ClosureDecision,
    [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($ClosureDecision -notin @("CLOSE-SUCCESS", "CLOSE-ROLLED-BACK")) {
    throw "ClosureDecision must be CLOSE-SUCCESS or CLOSE-ROLLED-BACK."
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\phase7-16"
$InputPath = if ([System.IO.Path]::IsPathRooted($InputFile)) {
    $InputFile
}
else {
    Join-Path $ProjectRoot $InputFile
}

$InputData = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
$HypercarePath = Join-Path $EvidenceDirectory "hypercare.json"
$CompletePath = Join-Path $EvidenceDirectory "cutover-complete.json"
$FailurePath = Join-Path $EvidenceDirectory "cutover-failure.json"
$ClosurePath = Join-Path $EvidenceDirectory "cutover-closure.json"

if ($ClosureDecision -eq "CLOSE-SUCCESS") {
    if (-not (Test-Path -LiteralPath $CompletePath -PathType Leaf)) {
        throw "Successful closure requires cutover-complete.json."
    }

    if (-not (Test-Path -LiteralPath $HypercarePath -PathType Leaf)) {
        throw "Successful closure requires hypercare.json."
    }

    $Hypercare = Get-Content -LiteralPath $HypercarePath -Raw | ConvertFrom-Json
    if (-not [bool]$Hypercare.passed) {
        throw "Successful closure requires passed hypercare evidence."
    }
}
else {
    if (-not (Test-Path -LiteralPath $FailurePath -PathType Leaf)) {
        throw "Rolled-back closure requires cutover-failure.json."
    }
}

$Closure = [ordered]@{
    schemaVersion = 1
    phase = "7.16"
    closedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    decision = $ClosureDecision
    ticketReference = [string]$InputData.ticketReference
    primaryOperator = [string]$InputData.operators.primary
    rollbackOperator = [string]$InputData.operators.rollback
    notes = $Notes
}

[System.IO.File]::WriteAllText(
    $ClosurePath,
    (($Closure | ConvertTo-Json -Depth 6) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "[PASS] Phase 7.16 cutover closure evidence created." -ForegroundColor Green
Write-Host "Evidence: $ClosurePath"
