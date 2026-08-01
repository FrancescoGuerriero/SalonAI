# SALONAI_PHASE_7_10_RESTORE_TEST_VERSION=4

param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [string]$BackupPath,

    [switch]$KeepContainer,

    [int]$StartupTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$BackupRoot = Join-Path $ProjectRoot "backups\mongodb"
$ResultRoot = Join-Path $ProjectRoot "backups\restore-tests"

function Assert-Path {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description was not found: $Path"
    }
}

function Test-ArchiveChecksum {
    param(
        [Parameter(Mandatory)]
        [string]$ArchivePath
    )

    $ChecksumPath = "$ArchivePath.sha256"
    Assert-Path $ChecksumPath "Backup checksum"

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

    if ($Expected -ne $Actual) {
        throw "Backup checksum mismatch for $ArchivePath"
    }

    return $Actual
}

function Invoke-ExpectedNativeCommand {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $global:LASTEXITCODE = 0
        $Output = & $Command 2>&1
        $ExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    return [pscustomobject]@{
        ExitCode = $ExitCode
        Output = @($Output)
    }
}

if ([string]::IsNullOrWhiteSpace($BackupPath)) {
    $Latest = Get-ChildItem `
        -LiteralPath $BackupRoot `
        -Filter "salonai-mongodb-*.archive.gz" `
        -File `
        -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -eq $Latest) {
        throw "No SalonAI MongoDB backup archive was found."
    }

    $BackupPath = $Latest.FullName
}

$BackupPath = [System.IO.Path]::GetFullPath($BackupPath)
Assert-Path $BackupPath "MongoDB backup archive"

$ManifestPath = $BackupPath.Replace(
    ".archive.gz",
    ".json"
)

Assert-Path $ManifestPath "MongoDB backup manifest"
$Checksum = Test-ArchiveChecksum $BackupPath
$Manifest = Get-Content `
    -LiteralPath $ManifestPath `
    -Raw |
    ConvertFrom-Json

$DatabaseName = [string]$Manifest.database

if ($DatabaseName -notmatch '^[A-Za-z0-9_-]+$') {
    throw "The backup manifest contains an unsafe database name."
}

New-Item `
    -ItemType Directory `
    -Path $ResultRoot `
    -Force |
    Out-Null

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ContainerName = (
    "salonai-restore-test-$Timestamp-" +
    [guid]::NewGuid().ToString("N").Substring(0, 6)
).ToLowerInvariant()
$DrillUsername = "salonai_drill"
$DrillPassword = "SalonAI-restore-drill-$Timestamp"
$StartedAt = [DateTimeOffset]::UtcNow
$Succeeded = $false
$RestoredStats = $null
$SourceStats = $null
$StatsMatch = $null
$ValidationFile = $null

Write-Host ""
Write-Host "SalonAI isolated MongoDB restore test" -ForegroundColor Cyan
Write-Host "Backup: $BackupPath" -ForegroundColor DarkGray
Write-Host "Container: $ContainerName" -ForegroundColor DarkGray

try {
    Write-Host ""
    Write-Host "==> Starting isolated MongoDB" -ForegroundColor Cyan

    $RunResult = Invoke-ExpectedNativeCommand {
        & docker run `
            -d `
            --name $ContainerName `
            --label salonai.phase=7.10 `
            --label salonai.purpose=restore-test `
            -e "MONGO_INITDB_ROOT_USERNAME=$DrillUsername" `
            -e "MONGO_INITDB_ROOT_PASSWORD=$DrillPassword" `
            mongo:7.0
    }

    $ContainerId = $RunResult.Output |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
        Select-Object -Last 1

    if ($RunResult.ExitCode -ne 0 -or -not $ContainerId) {
        $RunResult.Output | ForEach-Object { Write-Host $_ }
        throw "Unable to start the isolated MongoDB restore container."
    }

    $Deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    $Ready = $false

    while ((Get-Date) -lt $Deadline) {
        $PingResult = Invoke-ExpectedNativeCommand {
            & docker exec `
                $ContainerName `
                mongosh `
                --quiet `
                --host 127.0.0.1 `
                --username $DrillUsername `
                --password $DrillPassword `
                --authenticationDatabase admin `
                --eval "quit(db.adminCommand('ping').ok === 1 ? 0 : 1)"
        }

        if ($PingResult.ExitCode -eq 0) {
            $Ready = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if (-not $Ready) {
        $LogResult = Invoke-ExpectedNativeCommand {
            & docker logs $ContainerName --tail 100
        }

        $LogResult.Output | ForEach-Object { Write-Host $_ }
        throw "The isolated MongoDB restore container did not become ready."
    }

    Write-Host ""
    Write-Host "==> Restoring backup into isolated MongoDB" -ForegroundColor Cyan

    $CopyResult = Invoke-ExpectedNativeCommand {
        & docker cp `
            $BackupPath `
            "${ContainerName}:/tmp/salonai-restore.archive.gz"
    }

    if ($CopyResult.ExitCode -ne 0) {
        $CopyResult.Output | ForEach-Object { Write-Host $_ }
        throw "Unable to copy the backup into the restore container."
    }

    $RestoreResult = Invoke-ExpectedNativeCommand {
        & docker exec `
            $ContainerName `
            mongorestore `
            --host 127.0.0.1 `
            --username $DrillUsername `
            --password $DrillPassword `
            --authenticationDatabase admin `
            --archive=/tmp/salonai-restore.archive.gz `
            --gzip `
            --drop
    }

    if ($RestoreResult.ExitCode -ne 0) {
        $RestoreResult.Output | ForEach-Object {
            Write-Host $_ -ForegroundColor DarkGray
        }

        throw "mongorestore failed in the isolated restore container."
    }

    $RestoreSummary = $RestoreResult.Output |
        Where-Object {
            [string]$_ -match
            'document\(s\) restored successfully|failed to restore'
        } |
        Select-Object -Last 1

    if ($RestoreSummary) {
        Write-Host $RestoreSummary -ForegroundColor DarkGray
    }

    # Write the validation program to a JavaScript file and copy it into the
    # isolated container. This avoids all PowerShell, docker.exe and mongosh
    # --eval quoting transformations.
    $ValidationScript = @'
const databaseName = process.env.SALONAI_RESTORE_DATABASE;
if (!databaseName) {
  quit(2);
}
const target = db.getSiblingDB(databaseName);
const names = target.getCollectionNames();
let documents = 0;
for (const name of names) {
  documents += target.getCollection(name).countDocuments({});
}
print(JSON.stringify({database: databaseName, collections: names.length, documents: documents}));
'@

    $ValidationFile = Join-Path `
        ([System.IO.Path]::GetTempPath()) `
        ("salonai-restore-validation-{0}.js" -f [guid]::NewGuid().ToString("N"))

    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText(
        $ValidationFile,
        $ValidationScript,
        $Utf8NoBom
    )

    $ValidationCopyResult = Invoke-ExpectedNativeCommand {
        & docker cp `
            $ValidationFile `
            "${ContainerName}:/tmp/salonai-restore-validation.js"
    }

    if ($ValidationCopyResult.ExitCode -ne 0) {
        $ValidationCopyResult.Output | ForEach-Object { Write-Host $_ }
        throw "Unable to copy the restore-validation program into the container."
    }

    $ValidationResult = Invoke-ExpectedNativeCommand {
        & docker exec `
            -e "SALONAI_RESTORE_DATABASE=$DatabaseName" `
            $ContainerName `
            mongosh `
            --quiet `
            --host 127.0.0.1 `
            --username $DrillUsername `
            --password $DrillPassword `
            --authenticationDatabase admin `
            /tmp/salonai-restore-validation.js
    }

    $ValidationOutput = $ValidationResult.Output |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }

    if ($ValidationResult.ExitCode -ne 0 -or -not $ValidationOutput) {
        $ValidationResult.Output | ForEach-Object { Write-Host $_ }
        throw "Unable to validate the restored database."
    }

    $RestoredStats = (
        $ValidationOutput |
        Select-Object -Last 1
    ) | ConvertFrom-Json

    if ($RestoredStats.database -ne $DatabaseName) {
        throw "The restore test validated an unexpected database."
    }

    $SourceStats = $null
    $SourceStatsProperty = $Manifest.PSObject.Properties["sourceDatabaseStatsObservedAfterDump"]

    if ($null -ne $SourceStatsProperty) {
        $SourceStats = $SourceStatsProperty.Value
    }

    $StatsMatch = $null

    if (
        $null -ne $SourceStats -and
        $null -ne $SourceStats.collections -and
        $null -ne $SourceStats.documents
    ) {
        $StatsMatch = (
            [int64]$SourceStats.collections -eq
            [int64]$RestoredStats.collections -and
            [int64]$SourceStats.documents -eq
            [int64]$RestoredStats.documents
        )
    }

    $Succeeded = $true

    Write-Host ""
    Write-Host "[PASS] Isolated MongoDB restore test succeeded." -ForegroundColor Green
    Write-Host "Collections: $($RestoredStats.collections)" -ForegroundColor DarkGray
    Write-Host "Documents: $($RestoredStats.documents)" -ForegroundColor DarkGray
}
finally {
    if (
        -not [string]::IsNullOrWhiteSpace($ValidationFile) -and
        (Test-Path -LiteralPath $ValidationFile)
    ) {
        Remove-Item `
            -LiteralPath $ValidationFile `
            -Force `
            -ErrorAction SilentlyContinue
    }

    $CompletedAt = [DateTimeOffset]::UtcNow
    $DurationSeconds = [Math]::Round(
        ($CompletedAt - $StartedAt).TotalSeconds,
        3
    )

    $Result = [ordered]@{
        schemaVersion = 1
        phase = "7.10"
        test = "isolated-mongodb-restore"
        succeeded = $Succeeded
        startedAtUtc = $StartedAt.ToString("o")
        completedAtUtc = $CompletedAt.ToString("o")
        durationSeconds = $DurationSeconds
        backupPath = $BackupPath
        backupSha256 = $Checksum
        database = $DatabaseName
        restoredCollections = if ($null -ne $RestoredStats) {
            $RestoredStats.collections
        }
        else {
            $null
        }
        restoredDocuments = if ($null -ne $RestoredStats) {
            $RestoredStats.documents
        }
        else {
            $null
        }
        sourceStatsObservedAfterDump = $SourceStats
        sourceAndRestoredStatsMatch = $StatsMatch
        container = $ContainerName
        containerRetained = [bool]$KeepContainer
    }

    $ResultPath = Join-Path `
        $ResultRoot `
        "restore-test-$Timestamp.json"

    $Result |
        ConvertTo-Json -Depth 10 |
        Set-Content `
            -LiteralPath $ResultPath `
            -Encoding utf8

    Write-Host "Result: $ResultPath" -ForegroundColor DarkGray

    if (-not $KeepContainer) {
        $null = Invoke-ExpectedNativeCommand {
            & docker rm -f $ContainerName
        }
    }
    else {
        Write-Host (
            "Restore container retained for inspection: " +
            $ContainerName
        ) -ForegroundColor Yellow
    }
}

if (-not $Succeeded) {
    exit 1
}
