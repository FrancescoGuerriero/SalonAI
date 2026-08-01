param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [Parameter(Mandatory)]
    [string]$BackupPath,

    [string]$TargetDatabase,

    [switch]$ConfirmRestore,

    [switch]$ConfirmDataLoss,

    [switch]$StopApplication
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$BackupPath = [System.IO.Path]::GetFullPath($BackupPath)
$ProductionCompose = Join-Path $ProjectRoot "docker-compose.production.yml"
$ObservabilityCompose = Join-Path $ProjectRoot "docker-compose.observability.yml"
$ResilienceCompose = Join-Path $ProjectRoot "docker-compose.resilience.yml"
$EnvironmentFile = Join-Path $ProjectRoot ".env.production"

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

if (-not $ConfirmRestore -or -not $ConfirmDataLoss) {
    throw @"
Production restore blocked.
Re-run with both -ConfirmRestore and -ConfirmDataLoss after reviewing the runbook.
"@
}

Assert-Path $ProjectRoot "SalonAI project root"
Assert-Path $BackupPath "MongoDB backup archive"
Assert-Path $EnvironmentFile "Production environment file"

$ChecksumPath = "$BackupPath.sha256"
$ManifestPath = $BackupPath.Replace(
    ".archive.gz",
    ".json"
)

Assert-Path $ChecksumPath "Backup checksum"
Assert-Path $ManifestPath "Backup manifest"

$ExpectedChecksum = (
    (
        Get-Content `
            -LiteralPath $ChecksumPath `
            -Raw
    ).Trim() -split "\s+"
)[0].ToLowerInvariant()

$ActualChecksum = (
    Get-FileHash `
        -LiteralPath $BackupPath `
        -Algorithm SHA256
).Hash.ToLowerInvariant()

if ($ExpectedChecksum -ne $ActualChecksum) {
    throw "Backup checksum verification failed. Restore was not started."
}

$Manifest = Get-Content `
    -LiteralPath $ManifestPath `
    -Raw |
    ConvertFrom-Json

$SourceDatabase = [string]$Manifest.database

if ([string]::IsNullOrWhiteSpace($TargetDatabase)) {
    $TargetDatabase = $SourceDatabase
}

foreach ($DatabaseName in @($SourceDatabase, $TargetDatabase)) {
    if ($DatabaseName -notmatch '^[A-Za-z0-9_-]+$') {
        throw "Unsafe MongoDB database name: $DatabaseName"
    }
}

Set-Location $ProjectRoot
$ApplicationStopped = $false
$ContainerArchive = "/tmp/salonai-production-restore.archive.gz"
$ContainerValidation = "/tmp/salonai-production-restore-validation.js"
$LocalValidation = Join-Path `
    $env:TEMP `
    ("salonai-restore-validation-{0}.js" -f (
        [guid]::NewGuid().ToString("N")
    ))

Write-Host ""
Write-Host "SalonAI PRODUCTION MongoDB restore" -ForegroundColor Red
Write-Host "Source database: $SourceDatabase"
Write-Host "Target database: $TargetDatabase"
Write-Host "Backup: $BackupPath"
Write-Host "SHA-256: $ActualChecksum"

try {
    $MongoUsername = (
        & docker exec `
            salonai-mongo `
            printenv `
            MONGO_INITDB_ROOT_USERNAME
    ) | Select-Object -Last 1

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($MongoUsername)) {
        throw "Unable to read the MongoDB restore username from salonai-mongo."
    }

    $MongoUsername = $MongoUsername.Trim()

    $MongoPassword = (
        & docker exec `
            salonai-mongo `
            printenv `
            MONGO_INITDB_ROOT_PASSWORD
    ) | Select-Object -Last 1

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($MongoPassword)) {
        throw "Unable to read the MongoDB restore password from salonai-mongo."
    }

    $MongoPassword = $MongoPassword.Trim()

    if ($StopApplication) {
        Write-Host ""
        Write-Host "==> Entering maintenance mode" -ForegroundColor Cyan

        & docker compose `
            --env-file $EnvironmentFile `
            -f $ProductionCompose `
            -f $ObservabilityCompose `
            -f $ResilienceCompose `
            stop edge backend

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to stop the application before restore."
        }

        $ApplicationStopped = $true
    }

    Write-Host ""
    Write-Host "==> Copying verified backup into MongoDB container" -ForegroundColor Cyan

    & docker cp `
        $BackupPath `
        "salonai-mongo:${ContainerArchive}"

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to copy backup into salonai-mongo."
    }

    $NamespaceArguments = if ($SourceDatabase -eq $TargetDatabase) {
        @(
            "--nsInclude=${SourceDatabase}.*"
        )
    }
    else {
        @(
            "--nsInclude=${SourceDatabase}.*",
            "--nsFrom=${SourceDatabase}.*",
            "--nsTo=${TargetDatabase}.*"
        )
    }

    $RestoreArguments = @(
        "exec",
        "salonai-mongo",
        "mongorestore",
        "--host", "127.0.0.1",
        "--username", $MongoUsername,
        "--password", $MongoPassword,
        "--authenticationDatabase", "admin",
        "--archive=$ContainerArchive",
        "--gzip",
        "--drop"
    ) + $NamespaceArguments

    Write-Host ""
    Write-Host "==> Restoring production database" -ForegroundColor Cyan

    & docker @RestoreArguments

    if ($LASTEXITCODE -ne 0) {
        throw "Production mongorestore failed."
    }

    $TargetJson = $TargetDatabase | ConvertTo-Json -Compress
    $ValidationScript = @"
const databaseName = $TargetJson;
const target = db.getSiblingDB(databaseName);
const names = target.getCollectionNames();
let documents = 0;
for (const name of names) {
  documents += target.getCollection(name).countDocuments({});
}
print(JSON.stringify({ database: databaseName, collections: names.length, documents }));
"@

    Set-Content `
        -LiteralPath $LocalValidation `
        -Value $ValidationScript `
        -Encoding utf8

    & docker cp `
        $LocalValidation `
        "salonai-mongo:${ContainerValidation}"

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to copy the restore-validation script."
    }

    $ValidationArguments = @(
        "exec",
        "salonai-mongo",
        "mongosh",
        "--quiet",
        "--host", "127.0.0.1",
        "--username", $MongoUsername,
        "--password", $MongoPassword,
        "--authenticationDatabase", "admin",
        "--file", $ContainerValidation
    )

    $ValidationOutput = & docker @ValidationArguments

    if ($LASTEXITCODE -ne 0) {
        throw "The restored production database could not be validated."
    }

    Write-Host ""
    Write-Host "[PASS] Production MongoDB restore completed." -ForegroundColor Green
    $ValidationOutput | Select-Object -Last 1 | Write-Host
}
finally {
    & docker exec `
        salonai-mongo `
        rm -f `
        $ContainerArchive `
        $ContainerValidation `
        *> $null

    Remove-Item `
        -LiteralPath $LocalValidation `
        -Force `
        -ErrorAction SilentlyContinue

    if ($ApplicationStopped) {
        Write-Host ""
        Write-Host "==> Leaving maintenance mode" -ForegroundColor Cyan

        & docker compose `
            --env-file $EnvironmentFile `
            -f $ProductionCompose `
            -f $ObservabilityCompose `
            -f $ResilienceCompose `
            up -d backend edge

        if ($LASTEXITCODE -ne 0) {
            Write-Host (
                "[WARN] Application restart requires manual attention."
            ) -ForegroundColor Yellow
        }
    }
}
