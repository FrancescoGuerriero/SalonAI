param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [switch]$RunLiveChecks
)

# SALONAI_PHASE_7_10_VERIFIER_VERSION=4

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Passed = 0
$Failed = 0
$Skipped = 0

$ProductionCompose = Join-Path $ProjectRoot "docker-compose.production.yml"
$ObservabilityCompose = Join-Path $ProjectRoot "docker-compose.observability.yml"
$ResilienceCompose = Join-Path $ProjectRoot "docker-compose.resilience.yml"
$EnvironmentFile = Join-Path $ProjectRoot ".env.production"

function Write-Step {
    param([string]$Message)

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)

    $script:Passed++
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)

    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Skip {
    param([string]$Message)

    $script:Skipped++
    Write-Host "[SKIP] $Message" -ForegroundColor Yellow
}

function Test-Check {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if ($Condition) {
        Write-Pass $Message
    }
    else {
        Write-Fail $Message
    }
}

function Get-FileText {
    param([string]$RelativePath)

    $Path = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    return Get-Content -LiteralPath $Path -Raw
}

function Invoke-NativeCheck {
    param(
        [string]$Message,
        [scriptblock]$Command
    )

    $PreviousPreference = $ErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"
        $global:LASTEXITCODE = 0
        $Output = & $Command 2>&1
        $ExitCode = $LASTEXITCODE
    }
    catch {
        $ErrorActionPreference = $PreviousPreference
        Write-Fail "$Message - $($_.Exception.Message)"
        return $false
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    if ($ExitCode -eq 0) {
        if ($Output) {
            $Output | ForEach-Object {
                Write-Host "  $_" -ForegroundColor DarkGray
            }
        }

        Write-Pass $Message
        return $true
    }

    if ($Output) {
        $Output | ForEach-Object {
            Write-Host "  $_" -ForegroundColor DarkYellow
        }
    }

    Write-Fail "$Message exited with code $ExitCode"
    return $false
}

function Get-ContainerState {
    param([string]$ContainerName)

    try {
        $Json = & docker inspect `
            $ContainerName `
            --format '{{json .State}}' `
            2>$null

        if ($LASTEXITCODE -ne 0 -or -not $Json) {
            return $null
        }

        return $Json | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Test-BackupChecksum {
    param([string]$ArchivePath)

    $ChecksumPath = "$ArchivePath.sha256"

    if (-not (Test-Path -LiteralPath $ChecksumPath)) {
        return $false
    }

    try {
        $Expected = (
            (
                Get-Content `
                    -LiteralPath $ChecksumPath `
                    -Raw
            ).Trim() -split "\s+"
        )[0].ToLowerInvariant()

        $Actual = (
            Get-FileHash `
                -LiteralPath $ArchivePath `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

        return $Expected -eq $Actual
    }
    catch {
        return $false
    }
}

Write-Host ""
Write-Host "SalonAI Phase 7.10 verification" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

Write-Step "Required files"

$RequiredFiles = @(
    "docker-compose.resilience.yml",
    "config\phase7-10.env.example",
    "scripts\resilience\mongo-backup-common.sh",
    "scripts\resilience\mongo-backup-once.sh",
    "scripts\resilience\mongo-backup-loop.sh",
    "scripts\backup-mongodb.ps1",
    "scripts\test-mongodb-restore.ps1",
    "scripts\restore-mongodb.ps1",
    "scripts\mirror-mongodb-backups.ps1",
    "scripts\run-disaster-recovery-drill.ps1",
    "scripts\collect-phase7-10-dr-snapshot.ps1",
    "scripts\register-phase7-10-scheduled-tasks.ps1",
    "scripts\verify-phase7-10.ps1",
    "docs\operations\backup-and-restore.md",
    "docs\operations\disaster-recovery.md",
    "docs\runbooks\mongodb-backup-failure.md",
    "docs\runbooks\mongodb-production-restore.md"
)

foreach ($RelativePath in $RequiredFiles) {
    Test-Check `
        (Test-Path -LiteralPath (
            Join-Path $ProjectRoot $RelativePath
        )) `
        $RelativePath
}

Write-Step "Static backup and resilience configuration"

$ComposeText = Get-FileText "docker-compose.resilience.yml"
$CommonText = Get-FileText "scripts\resilience\mongo-backup-common.sh"
$LoopText = Get-FileText "scripts\resilience\mongo-backup-loop.sh"
$BackupText = Get-FileText "scripts\backup-mongodb.ps1"
$RestoreTestText = Get-FileText "scripts\test-mongodb-restore.ps1"
$ProductionRestoreText = Get-FileText "scripts\restore-mongodb.ps1"
$MirrorText = Get-FileText "scripts\mirror-mongodb-backups.ps1"
$DrillText = Get-FileText "scripts\run-disaster-recovery-drill.ps1"
$SnapshotText = Get-FileText "scripts\collect-phase7-10-dr-snapshot.ps1"

Test-Check `
    ($ComposeText -match '(?m)^\s*mongo-backup:\s*$') `
    "Dedicated MongoDB backup service"

Test-Check `
    ($ComposeText -match 'image:\s*mongo:7\.0') `
    "Pinned MongoDB backup image"

Test-Check `
    ($ComposeText -match 'restart:\s*unless-stopped') `
    "Automatic backup-service restart policy"

Test-Check `
    ($ComposeText -match 'read_only:\s*true') `
    "Read-only backup container filesystem"

Test-Check `
    ($ComposeText -match 'cap_drop:[\s\S]*?- ALL') `
    "Backup container capability drop"

Test-Check `
    ($ComposeText -match '\./backups/mongodb:/backups') `
    "Host-accessible backup storage"

Test-Check `
    ($ComposeText -match 'last-success\.epoch') `
    "Backup-service health check"

Test-Check `
    ($CommonText -match 'mongodump') `
    "MongoDB logical backup command"

Test-Check `
    ($CommonText -match 'sha256sum') `
    "Backup checksum generation"

Test-Check `
    ($CommonText -match 'apply_retention') `
    "Backup retention enforcement"

Test-Check `
    ($CommonText -match 'sourceDatabaseStatsObservedAfterDump') `
    "Backup source-statistics manifest"

Test-Check `
    ($LoopText -match 'MONGO_BACKUP_INTERVAL_SECONDS') `
    "Automated backup schedule"

Test-Check `
    (
        $BackupText -match 'Test-ArchiveChecksum' -and
        $BackupText -match 'SALONAI_PHASE_7_10_BACKUP_WRAPPER_VERSION=2'
    ) `
    "Manual backup checksum verification"

Test-Check `
    (
        $RestoreTestText -match 'salonai-restore-test-' -and
        $RestoreTestText -match 'mongorestore' -and
        $RestoreTestText -match 'SALONAI_PHASE_7_10_RESTORE_TEST_VERSION=4' -and
        $RestoreTestText -match 'SALONAI_RESTORE_DATABASE' -and
        $RestoreTestText -match 'salonai-restore-validation\.js'
    ) `
    "Isolated restore test"

Test-Check `
    (
        $ProductionRestoreText -match 'ConfirmRestore' -and
        $ProductionRestoreText -match 'ConfirmDataLoss'
    ) `
    "Guarded production restore"

Test-Check `
    ($MirrorText -match 'Destination') `
    "Off-host backup mirroring"

Test-Check `
    ($DrillText -match 'rtoValidationSeconds') `
    "Disaster-recovery drill timing"

Test-Check `
    ($SnapshotText -match 'environment-variable-names') `
    "Secret-safe disaster-recovery snapshot"

Write-Step "Docker Compose and script validation"

$DockerCommand = Get-Command docker -ErrorAction SilentlyContinue

if ($null -eq $DockerCommand) {
    Write-Skip "Combined Docker Compose configuration"
    Write-Skip "Backup shell syntax"
}
else {
    $null = Invoke-NativeCheck `
        "Combined production, observability and resilience configuration" `
        {
            & docker compose `
                --env-file $EnvironmentFile `
                -f $ProductionCompose `
                -f $ObservabilityCompose `
                -f $ResilienceCompose `
                config --quiet
        }

    $ResilienceScripts = Join-Path `
        $ProjectRoot `
        "scripts\resilience"

    $Mount = "${ResilienceScripts}:/scripts:ro"

    $null = Invoke-NativeCheck `
        "Backup shell syntax" `
        {
            & docker run `
                --rm `
                --entrypoint /bin/bash `
                -v $Mount `
                mongo:7.0 `
                -n `
                /scripts/mongo-backup-common.sh `
                /scripts/mongo-backup-once.sh `
                /scripts/mongo-backup-loop.sh
        }
}

if ($RunLiveChecks) {
    Write-Step "Live backup service"

    if ($null -eq $DockerCommand) {
        Write-Fail "Docker is required for live checks."
    }
    else {
        $BackupContainer = Get-ContainerState "salonai-mongo-backup"

        if ($null -eq $BackupContainer) {
            Write-Fail "salonai-mongo-backup exists"
        }
        else {
            Test-Check `
                ($BackupContainer.Running -eq $true) `
                "salonai-mongo-backup is running"

            $HealthProperty =
                $BackupContainer.PSObject.Properties["Health"]

            if ($null -eq $HealthProperty) {
                Write-Fail "salonai-mongo-backup exposes health status"
            }
            else {
                Test-Check `
                    ($BackupContainer.Health.Status -eq "healthy") `
                    "salonai-mongo-backup is healthy"
            }
        }

        $StatusRoot = Join-Path `
            $ProjectRoot `
            "backups\mongodb\status"

        Test-Check `
            (Test-Path -LiteralPath (
                Join-Path $StatusRoot "last-success.json"
            )) `
            "Backup service recorded a successful backup"

        Write-Step "Manual backup and integrity"

        $BackupScript = Join-Path `
            $ProjectRoot `
            "scripts\backup-mongodb.ps1"

        $BackupSucceeded = Invoke-NativeCheck `
            "Manual MongoDB backup" `
            {
                & powershell `
                    -NoProfile `
                    -ExecutionPolicy Bypass `
                    -File $BackupScript `
                    -ProjectRoot $ProjectRoot
            }

        $BackupRoot = Join-Path `
            $ProjectRoot `
            "backups\mongodb"

        $LatestArchive = Get-ChildItem `
            -LiteralPath $BackupRoot `
            -Filter "salonai-mongodb-*.archive.gz" `
            -File `
            -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1

        Test-Check `
            ($null -ne $LatestArchive) `
            "MongoDB backup archive exists"

        if ($null -ne $LatestArchive) {
            Test-Check `
                (Test-BackupChecksum $LatestArchive.FullName) `
                "MongoDB backup checksum"

            $ManifestPath = $LatestArchive.FullName.Replace(
                ".archive.gz",
                ".json"
            )

            $ManifestValid = $false

            if (Test-Path -LiteralPath $ManifestPath) {
                try {
                    $Manifest = Get-Content `
                        -LiteralPath $ManifestPath `
                        -Raw |
                        ConvertFrom-Json

                    $ManifestValid = (
                        $Manifest.archive -eq $LatestArchive.Name -and
                        -not [string]::IsNullOrWhiteSpace(
                            [string]$Manifest.database
                        )
                    )
                }
                catch {
                    $ManifestValid = $false
                }
            }

            Test-Check `
                $ManifestValid `
                "MongoDB backup manifest"

            $Age = (
                [DateTime]::UtcNow -
                $LatestArchive.LastWriteTimeUtc
            ).TotalMinutes

            Test-Check `
                ($Age -lt 10) `
                "MongoDB backup freshness"
        }

        Write-Step "Isolated restore test"

        $RestoreTestScript = Join-Path `
            $ProjectRoot `
            "scripts\test-mongodb-restore.ps1"

        $RestoreSucceeded = Invoke-NativeCheck `
            "Isolated MongoDB restore" `
            {
                & powershell `
                    -NoProfile `
                    -ExecutionPolicy Bypass `
                    -File $RestoreTestScript `
                    -ProjectRoot $ProjectRoot
            }

        $LatestRestoreResult = Get-ChildItem `
            -LiteralPath (
                Join-Path $ProjectRoot "backups\restore-tests"
            ) `
            -Filter "restore-test-*.json" `
            -File `
            -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1

        $RestoreResultValid = $false

        if ($null -ne $LatestRestoreResult) {
            try {
                $RestoreResult = Get-Content `
                    -LiteralPath $LatestRestoreResult.FullName `
                    -Raw |
                    ConvertFrom-Json

                $RestoreResultValid = (
                    $RestoreResult.succeeded -eq $true -and
                    $RestoreResult.test -eq
                    "isolated-mongodb-restore"
                )
            }
            catch {
                $RestoreResultValid = $false
            }
        }

        Test-Check `
            $RestoreResultValid `
            "Restore-test evidence"
    }
}

Write-Host ""
Write-Host "Verification summary" -ForegroundColor Cyan
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Skipped: $Skipped"

if ($Failed -gt 0) {
    exit 1
}

Write-Host ""
Write-Host "SalonAI Phase 7.10 verified successfully." -ForegroundColor Green
