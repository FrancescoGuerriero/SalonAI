param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$InputFile = "deployment-evidence\phase7-16\cutover-inputs.json",
    [switch]$EnforceWindow,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$InputPath = if ([System.IO.Path]::IsPathRooted($InputFile)) {
    $InputFile
}
else {
    Join-Path $ProjectRoot $InputFile
}

$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\phase7-16"
$EvidenceJson = Join-Path $EvidenceDirectory "preflight-evidence.json"
$EvidenceMarkdown = Join-Path $EvidenceDirectory "preflight-summary.md"
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

$Checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet("PASS", "PENDING", "FAIL")][string]$Status,
        [Parameter(Mandatory)][string]$Detail
    )

    $Checks.Add([pscustomobject]@{
        name = $Name
        status = $Status
        detail = $Detail
    })
}

function Resolve-ProjectPath {
    param([Parameter(Mandatory)][string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required JSON file is missing: $Path"
    }

    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Test-ReleaseManifest {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Label
    )

    $Manifest = Read-JsonFile -Path $Path

    if ([int]$Manifest.schemaVersion -ne 1) {
        throw "$Label schemaVersion must be 1."
    }

    if ([string]$Manifest.releaseTag -notmatch "^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$") {
        throw "$Label releaseTag is invalid."
    }

    if ([string]$Manifest.sourceCommit -notmatch "^[a-f0-9]{40}$") {
        throw "$Label sourceCommit is invalid."
    }

    $Images = @($Manifest.images)
    if ($Images.Count -ne 3) {
        throw "$Label must contain exactly three images."
    }

    foreach ($Service in @("ai-service", "backend", "frontend")) {
        $Entry = @($Images | Where-Object { $_.service -eq $Service }) | Select-Object -First 1

        if ($null -eq $Entry) {
            throw "$Label is missing $Service."
        }

        if ([string]$Entry.immutableReference -notmatch "^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$") {
            throw "$Label contains an invalid immutable image for $Service."
        }
    }

    return $Manifest
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Phase 7.16 cutover input is missing: $InputPath"
}

try {
    $InputData = Read-JsonFile -Path $InputPath
    if ([int]$InputData.schemaVersion -ne 1 -or [string]$InputData.phase -ne "7.16") {
        throw "Cutover input identity is invalid."
    }
    Add-Check -Name "Cutover input identity" -Status "PASS" -Detail "Phase 7.16 input schema is valid."
}
catch {
    Add-Check -Name "Cutover input identity" -Status "FAIL" -Detail $_.Exception.Message
    $InputData = $null
}

if ($null -ne $InputData) {
    $ReadinessPath = Resolve-ProjectPath -Path ([string]$InputData.readinessEvidencePath)
    try {
        $Readiness = Read-JsonFile -Path $ReadinessPath
        if ([string]$Readiness.phase -ne "7.15" -or -not [bool]$Readiness.readyForGoLiveReview) {
            throw "Phase 7.15 evidence is not ready for go-live review."
        }
        Add-Check -Name "Phase 7.15 strict readiness" -Status "PASS" -Detail "Readiness evidence is approved."
    }
    catch {
        Add-Check -Name "Phase 7.15 strict readiness" -Status "PENDING" -Detail $_.Exception.Message
    }

    $ApprovalNames = @(
        "businessOwner",
        "technicalOwner",
        "securityOwner",
        "backupRestorePoint",
        "rollbackOwner",
        "customerCommunications"
    )

    foreach ($ApprovalName in $ApprovalNames) {
        $Property = $InputData.approvals.PSObject.Properties[$ApprovalName]
        if ($null -ne $Property -and [bool]$Property.Value) {
            Add-Check -Name "Approval: $ApprovalName" -Status "PASS" -Detail "Confirmed in the cutover input."
        }
        else {
            Add-Check -Name "Approval: $ApprovalName" -Status "PENDING" -Detail "Approval is not confirmed."
        }
    }

    if ([string]::IsNullOrWhiteSpace([string]$InputData.ticketReference) -or
        [string]$InputData.ticketReference -match "PENDING") {
        Add-Check -Name "Change ticket" -Status "PENDING" -Detail "Replace the placeholder change ticket reference."
    }
    else {
        Add-Check -Name "Change ticket" -Status "PASS" -Detail "A change ticket reference is present."
    }

    foreach ($OperatorName in @("primary", "rollback")) {
        $OperatorValue = [string]$InputData.operators.$OperatorName
        if ([string]::IsNullOrWhiteSpace($OperatorValue)) {
            Add-Check -Name "Operator: $OperatorName" -Status "PENDING" -Detail "Name the $OperatorName operator."
        }
        else {
            Add-Check -Name "Operator: $OperatorName" -Status "PASS" -Detail "Named operator is present."
        }
    }

    $BackupPath = Resolve-ProjectPath -Path ([string]$InputData.backupEvidencePath)
    try {
        $Backup = Read-JsonFile -Path $BackupPath
        if ([string]$Backup.status -notin @("PASS", "SUCCESS", "READY")) {
            throw "Backup evidence status is not successful."
        }

        $CompletedAt = [DateTimeOffset]::Parse([string]$Backup.completedAtUtc)
        $AgeHours = (([DateTimeOffset]::UtcNow - $CompletedAt.ToUniversalTime()).TotalHours)
        if ($AgeHours -lt 0 -or $AgeHours -gt [double]$InputData.maxBackupAgeHours) {
            throw "Backup evidence is outside the permitted age window."
        }

        if ([string]::IsNullOrWhiteSpace([string]$Backup.backupReference) -or
            [string]$Backup.backupReference -match "PENDING") {
            throw "Backup reference is missing."
        }

        if ([string]::IsNullOrWhiteSpace([string]$Backup.restoreTestReference) -or
            [string]$Backup.restoreTestReference -match "PENDING") {
            throw "Restore-test reference is missing."
        }

        Add-Check -Name "Recent backup and restore evidence" -Status "PASS" -Detail "Backup evidence is recent and includes a restore-test reference."
    }
    catch {
        Add-Check -Name "Recent backup and restore evidence" -Status "PENDING" -Detail $_.Exception.Message
    }

    $ReleasePath = Resolve-ProjectPath -Path ([string]$InputData.releaseManifestPath)
    $RollbackPath = Resolve-ProjectPath -Path ([string]$InputData.rollbackManifestPath)
    $Release = $null
    $Rollback = $null

    try {
        $Release = Test-ReleaseManifest -Path $ReleasePath -Label "Release manifest"
        $ReleaseHash = (Get-FileHash -LiteralPath $ReleasePath -Algorithm SHA256).Hash.ToLowerInvariant()

        if (-not [string]::IsNullOrWhiteSpace([string]$InputData.expectedReleaseManifestSha256) -and
            $ReleaseHash -ne ([string]$InputData.expectedReleaseManifestSha256).ToLowerInvariant()) {
            throw "Release manifest SHA-256 does not match the approved value."
        }

        if (-not [string]::IsNullOrWhiteSpace([string]$InputData.expectedSourceCommit) -and
            [string]$Release.sourceCommit -ne [string]$InputData.expectedSourceCommit) {
            throw "Release manifest source commit does not match the expected commit."
        }

        Add-Check -Name "Approved release manifest" -Status "PASS" -Detail "Release manifest identity and immutable images are valid."
    }
    catch {
        Add-Check -Name "Approved release manifest" -Status "PENDING" -Detail $_.Exception.Message
    }

    try {
        $Rollback = Test-ReleaseManifest -Path $RollbackPath -Label "Rollback manifest"

        if ($null -ne $Release -and [string]$Rollback.sourceCommit -eq [string]$Release.sourceCommit) {
            throw "Rollback manifest points to the same source commit as the release manifest."
        }

        Add-Check -Name "Rollback manifest" -Status "PASS" -Detail "Rollback manifest contains a distinct immutable release."
    }
    catch {
        Add-Check -Name "Rollback manifest" -Status "PENDING" -Detail $_.Exception.Message
    }

    try {
        $WindowStart = [DateTimeOffset]::Parse([string]$InputData.changeWindowStartUtc).ToUniversalTime()
        $WindowEnd = [DateTimeOffset]::Parse([string]$InputData.changeWindowEndUtc).ToUniversalTime()

        if ($WindowEnd -le $WindowStart) {
            throw "Change-window end must be after the start."
        }

        if ($EnforceWindow) {
            $Now = [DateTimeOffset]::UtcNow
            if ($Now -lt $WindowStart -or $Now -gt $WindowEnd) {
                throw "The current time is outside the approved change window."
            }
        }

        Add-Check -Name "Approved change window" -Status "PASS" -Detail "Change-window timestamps are valid."
    }
    catch {
        Add-Check -Name "Approved change window" -Status "PENDING" -Detail $_.Exception.Message
    }

    $EnvironmentPath = Resolve-ProjectPath -Path ([string]$InputData.environmentFile)
    if (-not (Test-Path -LiteralPath $EnvironmentPath -PathType Leaf)) {
        Add-Check -Name "Production environment" -Status "PENDING" -Detail "Production environment file is missing."
    }
    else {
        try {
            & git -C $ProjectRoot check-ignore --quiet -- $EnvironmentPath
            if ($LASTEXITCODE -ne 0) {
                throw "Production environment file is not ignored by Git."
            }

            & powershell `
                -NoProfile `
                -ExecutionPolicy Bypass `
                -File (Join-Path $ProjectRoot "scripts\deployment\Test-ProductionEnvironment.ps1") `
                -ProjectRoot $ProjectRoot `
                -EnvironmentFile $EnvironmentPath

            if ($LASTEXITCODE -ne 0) {
                throw "Production environment validation failed."
            }

            $ComposeArguments = @(
                "--env-file",
                $EnvironmentPath,
                "-f",
                (Join-Path $ProjectRoot "docker-compose.production.yml"),
                "-f",
                (Join-Path $ProjectRoot "docker-compose.observability.yml"),
                "config",
                "--quiet"
            )

            & docker compose @ComposeArguments
            if ($LASTEXITCODE -ne 0) {
                throw "Merged production Compose validation failed."
            }

            Add-Check -Name "Production environment and Compose" -Status "PASS" -Detail "Environment validation and merged Compose configuration passed."
        }
        catch {
            Add-Check -Name "Production environment and Compose" -Status "FAIL" -Detail $_.Exception.Message
        }
    }
}

$FailCount = @($Checks | Where-Object { $_.status -eq "FAIL" }).Count
$PendingCount = @($Checks | Where-Object { $_.status -eq "PENDING" }).Count
$PassCount = @($Checks | Where-Object { $_.status -eq "PASS" }).Count
$Ready = ($FailCount -eq 0 -and $PendingCount -eq 0)

$Evidence = [ordered]@{
    schemaVersion = 1
    phase = "7.16"
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    readyForCutover = $Ready
    passed = $PassCount
    pending = $PendingCount
    failed = $FailCount
    checks = $Checks
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $EvidenceJson,
    (($Evidence | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
    $Utf8NoBom
)

$Markdown = New-Object System.Collections.Generic.List[string]
$Markdown.Add("# SalonAI Phase 7.16 preflight summary")
$Markdown.Add("")
$Markdown.Add("- Generated: $($Evidence.generatedAtUtc)")
$Markdown.Add("- Ready for cutover: $Ready")
$Markdown.Add("- Passed: $PassCount")
$Markdown.Add("- Pending: $PendingCount")
$Markdown.Add("- Failed: $FailCount")
$Markdown.Add("")
$Markdown.Add("| Check | Status | Detail |")
$Markdown.Add("|---|---|---|")
foreach ($Check in $Checks) {
    $SafeDetail = ([string]$Check.detail).Replace("|", "\|")
    $Markdown.Add("| $($Check.name) | $($Check.status) | $SafeDetail |")
}

[System.IO.File]::WriteAllText(
    $EvidenceMarkdown,
    (($Markdown -join [Environment]::NewLine) + [Environment]::NewLine),
    $Utf8NoBom
)

Write-Host ""
Write-Host "Phase 7.16 preflight summary" -ForegroundColor Cyan
Write-Host "Passed:  $PassCount"
Write-Host "Pending: $PendingCount"
Write-Host "Failed:  $FailCount"
Write-Host "Evidence: $EvidenceMarkdown"

if ($Ready) {
    Write-Host "READY FOR CONTROLLED CUTOVER." -ForegroundColor Green
}
else {
    Write-Host "NOT READY FOR CONTROLLED CUTOVER." -ForegroundColor Yellow
}

if ($Strict -and -not $Ready) {
    exit 2
}
