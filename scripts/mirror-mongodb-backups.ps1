param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [Parameter(Mandatory)]
    [string]$Destination,

    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($RetentionDays -lt 1) {
    throw "RetentionDays must be at least 1."
}

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$SourceRoot = Join-Path $ProjectRoot "backups\mongodb"
$Destination = [System.IO.Path]::GetFullPath($Destination)

if (-not (Test-Path -LiteralPath $SourceRoot)) {
    throw "Local MongoDB backup directory was not found: $SourceRoot"
}

New-Item `
    -ItemType Directory `
    -Path $Destination `
    -Force |
    Out-Null

$Archives = Get-ChildItem `
    -LiteralPath $SourceRoot `
    -Filter "salonai-mongodb-*.archive.gz" `
    -File

if (@($Archives).Count -eq 0) {
    throw "No MongoDB backup archives are available to mirror."
}

$Copied = 0

foreach ($Archive in $Archives) {
    $ChecksumPath = "$($Archive.FullName).sha256"
    $ManifestPath = $Archive.FullName.Replace(
        ".archive.gz",
        ".json"
    )

    if (
        -not (Test-Path -LiteralPath $ChecksumPath) -or
        -not (Test-Path -LiteralPath $ManifestPath)
    ) {
        throw "Backup family is incomplete: $($Archive.Name)"
    }

    $Expected = (
        (
            Get-Content `
                -LiteralPath $ChecksumPath `
                -Raw
        ).Trim() -split "\s+"
    )[0].ToLowerInvariant()

    $Actual = (
        Get-FileHash `
            -LiteralPath $Archive.FullName `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($Expected -ne $Actual) {
        throw "Checksum verification failed: $($Archive.Name)"
    }

    $DestinationArchive = Join-Path `
        $Destination `
        $Archive.Name

    $PartialArchive = "$DestinationArchive.partial"

    Remove-Item `
        -LiteralPath $PartialArchive `
        -Force `
        -ErrorAction SilentlyContinue

    Copy-Item `
        -LiteralPath $Archive.FullName `
        -Destination $PartialArchive `
        -Force

    $MirroredHash = (
        Get-FileHash `
            -LiteralPath $PartialArchive `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($MirroredHash -ne $Actual) {
        Remove-Item `
            -LiteralPath $PartialArchive `
            -Force `
            -ErrorAction SilentlyContinue

        throw "Mirrored checksum verification failed: $($Archive.Name)"
    }

    Move-Item `
        -LiteralPath $PartialArchive `
        -Destination $DestinationArchive `
        -Force

    Copy-Item `
        -LiteralPath $ChecksumPath `
        -Destination $Destination `
        -Force

    Copy-Item `
        -LiteralPath $ManifestPath `
        -Destination $Destination `
        -Force

    $Copied++
}

$Cutoff = (Get-Date).ToUniversalTime().AddDays(-$RetentionDays)

Get-ChildItem `
    -LiteralPath $Destination `
    -File |
    Where-Object {
        $_.Name -like "salonai-mongodb-*" -and
        $_.LastWriteTimeUtc -lt $Cutoff
    } |
    Remove-Item -Force

$Latest = Get-ChildItem `
    -LiteralPath $Destination `
    -Filter "salonai-mongodb-*.archive.gz" `
    -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if ($null -eq $Latest) {
    throw "Off-host mirror contains no backup archive after mirroring."
}

Write-Host ""
Write-Host "[PASS] MongoDB backups mirrored." -ForegroundColor Green
Write-Host "Destination: $Destination" -ForegroundColor DarkGray
Write-Host "Backup families copied: $Copied" -ForegroundColor DarkGray
Write-Host "Latest archive: $($Latest.Name)" -ForegroundColor DarkGray
