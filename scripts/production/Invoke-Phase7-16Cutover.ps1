param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$InputFile = "deployment-evidence\phase7-16\cutover-inputs.json",
    [Parameter(Mandatory)][string]$ConfirmCutover,
    [switch]$SkipPull,
    [switch]$RollbackOnFailure,
    [string]$ConfirmRollback = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($ConfirmCutover -ne "DEPLOY-SALONAI-PRODUCTION") {
    throw "Cutover confirmation token is invalid."
}

if ($RollbackOnFailure -and $ConfirmRollback -ne "ROLLBACK-SALONAI-PRODUCTION") {
    throw "RollbackOnFailure requires the exact rollback confirmation token."
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$InputPath = if ([System.IO.Path]::IsPathRooted($InputFile)) {
    $InputFile
}
else {
    Join-Path $ProjectRoot $InputFile
}

$InputData = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json

function Resolve-ProjectPath {
    param([Parameter(Mandatory)][string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

$EnvironmentPath = Resolve-ProjectPath -Path ([string]$InputData.environmentFile)
$ReleaseManifestPath = Resolve-ProjectPath -Path ([string]$InputData.releaseManifestPath)
$RollbackManifestPath = Resolve-ProjectPath -Path ([string]$InputData.rollbackManifestPath)
$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\phase7-16"
$CutoverStarted = Join-Path $EvidenceDirectory "cutover-started.json"
$CutoverComplete = Join-Path $EvidenceDirectory "cutover-complete.json"
$CutoverFailure = Join-Path $EvidenceDirectory "cutover-failure.json"
$HypercareEvidence = Join-Path $EvidenceDirectory "hypercare.json"
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

& powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File (Join-Path $ProjectRoot "scripts\production\Test-Phase7-16Preflight.ps1") `
    -ProjectRoot $ProjectRoot `
    -InputFile $InputPath `
    -EnforceWindow `
    -Strict

if ($LASTEXITCODE -ne 0) {
    throw "Phase 7.16 strict preflight failed. No deployment was performed."
}

$StartedEvidence = [ordered]@{
    schemaVersion = 1
    phase = "7.16"
    startedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    ticketReference = [string]$InputData.ticketReference
    primaryOperator = [string]$InputData.operators.primary
    rollbackOperator = [string]$InputData.operators.rollback
    releaseManifestPath = $ReleaseManifestPath
    rollbackManifestPath = $RollbackManifestPath
}

[System.IO.File]::WriteAllText(
    $CutoverStarted,
    (($StartedEvidence | ConvertTo-Json -Depth 6) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
)

try {
    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File (Join-Path $ProjectRoot "scripts\deployment\Deploy-Production.ps1") `
        -ProjectRoot $ProjectRoot `
        -EnvironmentFile $EnvironmentPath `
        -ReleaseManifestPath $ReleaseManifestPath `
        -SkipPull:$SkipPull

    if ($LASTEXITCODE -ne 0) {
        throw "Production deployment script returned a non-zero exit code."
    }

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File (Join-Path $ProjectRoot "scripts\production\Watch-Phase7-16Hypercare.ps1") `
        -BaseUrl ([string]$InputData.hypercare.baseUrl) `
        -Samples ([int]$InputData.hypercare.samples) `
        -IntervalSeconds ([int]$InputData.hypercare.intervalSeconds) `
        -EvidencePath $HypercareEvidence

    if ($LASTEXITCODE -ne 0) {
        throw "Post-deployment hypercare failed."
    }

    $CompleteEvidence = [ordered]@{
        schemaVersion = 1
        phase = "7.16"
        completedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        ticketReference = [string]$InputData.ticketReference
        deploymentCompleted = $true
        hypercarePassed = $true
        releaseManifestSha256 = (Get-FileHash -LiteralPath $ReleaseManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    [System.IO.File]::WriteAllText(
        $CutoverComplete,
        (($CompleteEvidence | ConvertTo-Json -Depth 6) + [Environment]::NewLine),
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "[PASS] Phase 7.16 production cutover and hypercare completed." -ForegroundColor Green
    Write-Host "Evidence: $CutoverComplete"
}
catch {
    $FailureEvidence = [ordered]@{
        schemaVersion = 1
        phase = "7.16"
        failedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        ticketReference = [string]$InputData.ticketReference
        message = $_.Exception.Message
        rollbackRequested = [bool]$RollbackOnFailure
    }

    [System.IO.File]::WriteAllText(
        $CutoverFailure,
        (($FailureEvidence | ConvertTo-Json -Depth 6) + [Environment]::NewLine),
        (New-Object System.Text.UTF8Encoding($false))
    )

    if ($RollbackOnFailure) {
        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File (Join-Path $ProjectRoot "scripts\deployment\Rollback-Production.ps1") `
            -ProjectRoot $ProjectRoot `
            -EnvironmentFile $EnvironmentPath `
            -RollbackManifestPath $RollbackManifestPath

        if ($LASTEXITCODE -ne 0) {
            throw "Cutover failed and the confirmed rollback also failed. Review evidence immediately."
        }

        Write-Host "[PASS] Confirmed rollback completed after cutover failure." -ForegroundColor Yellow
    }

    throw
}
