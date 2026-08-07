param(
    [Parameter(Mandatory)][string]$StagingRoot,
    [Parameter(Mandatory)][string]$DeployRoot,
    [Parameter(Mandatory)][string]$ReleaseTag,
    [Parameter(Mandatory)][string]$EvidenceArchivePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Set-EnvironmentValue {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Value
    )

    $Lines = @(
        Get-Content -LiteralPath $Path |
            Where-Object { $_ -notmatch "^\s*$([regex]::Escape($Name))=" }
    )
    $Lines += "$Name=$Value"

    [System.IO.File]::WriteAllLines(
        $Path,
        [string[]]$Lines,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Read-ReleaseManifest {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$ExpectedTag
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Release manifest is missing: $Path"
    }

    $Manifest = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($Manifest.schemaVersion -ne 1 -or $Manifest.releaseTag -ne $ExpectedTag) {
        throw "Release manifest identity does not match the deployment request."
    }
    if ($Manifest.sourceCommit -notmatch "^[a-f0-9]{40}$") {
        throw "Release manifest source commit is invalid."
    }

    $Images = @{}
    foreach ($Image in @($Manifest.images)) {
        if ($Image.service -notin @("ai-service", "backend", "frontend") -or
            $Images.ContainsKey([string]$Image.service)) {
            throw "Unexpected or duplicate release service: $($Image.service)"
        }
        if ($Image.immutableReference -notmatch "^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$") {
            throw "Invalid immutable image reference for $($Image.service)."
        }
        $Images[[string]$Image.service] = [string]$Image.immutableReference
    }

    foreach ($Service in @("ai-service", "backend", "frontend")) {
        if (-not $Images.ContainsKey($Service)) {
            throw "Release manifest is missing $Service."
        }
    }

    return [pscustomobject]@{
        Manifest = $Manifest
        Images = $Images
    }
}

function Copy-AssetSet {
    param(
        [Parameter(Mandatory)][string]$SourceRoot,
        [Parameter(Mandatory)][string]$DestinationRoot,
        [Parameter(Mandatory)][string[]]$Directories,
        [Parameter(Mandatory)][string[]]$Files,
        [switch]$AllowMissing
    )

    foreach ($RelativePath in $Directories) {
        $Source = Join-Path $SourceRoot $RelativePath
        $Destination = Join-Path $DestinationRoot $RelativePath
        Remove-Item -LiteralPath $Destination -Recurse -Force -ErrorAction SilentlyContinue

        if (Test-Path -LiteralPath $Source -PathType Container) {
            Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
        }
        elseif (-not $AllowMissing) {
            throw "Required deployment directory is missing: $RelativePath"
        }
    }

    foreach ($RelativePath in $Files) {
        $Source = Join-Path $SourceRoot $RelativePath
        $Destination = Join-Path $DestinationRoot $RelativePath
        Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue

        if (Test-Path -LiteralPath $Source -PathType Leaf) {
            Copy-Item -LiteralPath $Source -Destination $Destination -Force
        }
        elseif (-not $AllowMissing) {
            throw "Required deployment file is missing: $RelativePath"
        }
    }
}

function Write-JsonEvidence {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][object]$Value
    )

    [System.IO.File]::WriteAllText(
        $Path,
        (($Value | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
        [System.Text.UTF8Encoding]::new($false)
    )
}

$DeployRoot = [System.IO.Path]::GetFullPath($DeployRoot)
$StagingRoot = [System.IO.Path]::GetFullPath($StagingRoot)
$EvidenceArchivePath = [System.IO.Path]::GetFullPath($EvidenceArchivePath)
$DeploymentParent = [System.IO.Path]::GetFullPath((Join-Path $DeployRoot ".deployments"))
$PathPrefix = $DeploymentParent.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
    [System.IO.Path]::DirectorySeparatorChar

if ($DeployRoot -eq [System.IO.Path]::GetPathRoot($DeployRoot)) {
    throw "DeployRoot cannot be a filesystem root."
}
if (-not $StagingRoot.StartsWith($PathPrefix, [System.StringComparison]::Ordinal)) {
    throw "StagingRoot must be inside the protected deployment staging directory."
}
if (-not $EvidenceArchivePath.StartsWith(
        $StagingRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
            [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::Ordinal
    )) {
    throw "EvidenceArchivePath must be inside StagingRoot."
}
if ($ReleaseTag -notmatch "^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$") {
    throw "ReleaseTag is invalid."
}

$EnvironmentPath = Join-Path $DeployRoot ".env.production"
if (-not (Test-Path -LiteralPath $EnvironmentPath -PathType Leaf)) {
    throw "Production environment file is missing: $EnvironmentPath"
}

$AssetDirectories = @(
    "ai-service",
    "backend",
    "config",
    "frontend",
    "monitoring",
    "nginx",
    "release-evidence",
    "scripts"
)
$AssetFiles = @(
    "docker-compose.observability.yml",
    "docker-compose.production.yml"
)
$RollbackRoot = Join-Path $StagingRoot "rollback-snapshot"
$OperationEvidence = Join-Path $StagingRoot "operation-evidence"
$TransportEvidencePath = Join-Path $OperationEvidence "deployment-transport.json"
$StagedManifestPath = Join-Path $StagingRoot "release-evidence/release-manifest.json"
$StableManifestPath = Join-Path $DeployRoot "release-evidence/release-manifest.json"
$PreviousManifestBackup = Join-Path $RollbackRoot "previous-release-manifest.json"
$StartedAt = (Get-Date).ToUniversalTime()
$ExistingEvidence = @()
$DeploymentFailure = $null
$RollbackAttempted = $false
$RollbackSucceeded = $false

if (Test-Path -LiteralPath (Join-Path $DeployRoot "deployment-evidence") -PathType Container) {
    $ExistingEvidence = @(
        Get-ChildItem -LiteralPath (Join-Path $DeployRoot "deployment-evidence") -Directory |
            ForEach-Object { $_.Name }
    )
}

New-Item -ItemType Directory -Path $RollbackRoot -Force | Out-Null
New-Item -ItemType Directory -Path $OperationEvidence -Force | Out-Null
Copy-Item -LiteralPath $EnvironmentPath -Destination (Join-Path $RollbackRoot ".env.production") -Force
Copy-AssetSet `
    -SourceRoot $DeployRoot `
    -DestinationRoot $RollbackRoot `
    -Directories $AssetDirectories `
    -Files $AssetFiles `
    -AllowMissing

$PreviousVersionLine = @(
    Get-Content -LiteralPath $EnvironmentPath |
        Where-Object { $_ -match "^\s*APP_VERSION=" }
) | Select-Object -Last 1
$PreviousVersion = if ($null -ne $PreviousVersionLine) {
    ([string]$PreviousVersionLine).Substring(([string]$PreviousVersionLine).IndexOf("=") + 1).Trim()
}
else {
    ""
}
$PreviousManifestCandidates = @(
    (Join-Path $DeployRoot "release-evidence/release-manifest.json")
)
if ($PreviousVersion -match "^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$") {
    $PreviousManifestCandidates += Join-Path $DeployRoot "deployment-evidence/$PreviousVersion/release-manifest.json"
}

foreach ($Candidate in $PreviousManifestCandidates) {
    if (Test-Path -LiteralPath $Candidate -PathType Leaf) {
        $CandidateManifest = Get-Content -LiteralPath $Candidate -Raw | ConvertFrom-Json
        if ([string]$CandidateManifest.releaseTag -eq $PreviousVersion) {
            Copy-Item -LiteralPath $Candidate -Destination $PreviousManifestBackup -Force
            break
        }
    }
}

try {
    $Release = Read-ReleaseManifest -Path $StagedManifestPath -ExpectedTag $ReleaseTag

    Copy-AssetSet `
        -SourceRoot $StagingRoot `
        -DestinationRoot $DeployRoot `
        -Directories $AssetDirectories `
        -Files $AssetFiles

    Set-EnvironmentValue -Path $EnvironmentPath -Name "APP_VERSION" -Value $Release.Manifest.releaseTag
    Set-EnvironmentValue -Path $EnvironmentPath -Name "RELEASE_SOURCE_COMMIT" -Value $Release.Manifest.sourceCommit
    Set-EnvironmentValue -Path $EnvironmentPath -Name "AI_SERVICE_IMAGE" -Value $Release.Images["ai-service"]
    Set-EnvironmentValue -Path $EnvironmentPath -Name "BACKEND_IMAGE" -Value $Release.Images["backend"]
    Set-EnvironmentValue -Path $EnvironmentPath -Name "FRONTEND_IMAGE" -Value $Release.Images["frontend"]

    & (Join-Path $DeployRoot "scripts/deployment/Deploy-Production.ps1") `
        -ProjectRoot $DeployRoot `
        -EnvironmentFile $EnvironmentPath `
        -ReleaseManifestPath $StableManifestPath

    Write-Host "[PASS] Remote deployment transport completed for $ReleaseTag." -ForegroundColor Green
}
catch {
    $DeploymentFailure = $_.Exception.Message
    $RollbackAttempted = $true
    Write-Host "[FAIL] Remote deployment failed: $DeploymentFailure" -ForegroundColor Red

    try {
        Copy-AssetSet `
            -SourceRoot $RollbackRoot `
            -DestinationRoot $DeployRoot `
            -Directories $AssetDirectories `
            -Files $AssetFiles `
            -AllowMissing
        Copy-Item `
            -LiteralPath (Join-Path $RollbackRoot ".env.production") `
            -Destination $EnvironmentPath `
            -Force

        if (Test-Path -LiteralPath $PreviousManifestBackup -PathType Leaf) {
            & (Join-Path $DeployRoot "scripts/deployment/Deploy-Production.ps1") `
                -ProjectRoot $DeployRoot `
                -EnvironmentFile $EnvironmentPath `
                -ReleaseManifestPath $PreviousManifestBackup `
                -SkipPull
        }
        else {
            throw "The previous release manifest is unavailable; automatic restoration cannot be verified."
        }

        $RollbackSucceeded = $true
        Write-Host "[PASS] Previous production release restored." -ForegroundColor Green
    }
    catch {
        Write-Host "[FAIL] Previous production release could not be restored: $($_.Exception.Message)" -ForegroundColor Red
    }
}
finally {
    $DeploymentEvidenceRoot = Join-Path $DeployRoot "deployment-evidence"
    if (Test-Path -LiteralPath $DeploymentEvidenceRoot -PathType Container) {
        $NewEvidence = @(
            Get-ChildItem -LiteralPath $DeploymentEvidenceRoot -Directory |
                Where-Object { $_.Name -notin $ExistingEvidence }
        )

        foreach ($Directory in $NewEvidence) {
            Copy-Item `
                -LiteralPath $Directory.FullName `
                -Destination (Join-Path $OperationEvidence $Directory.Name) `
                -Recurse `
                -Force
        }
    }

    Write-JsonEvidence -Path $TransportEvidencePath -Value ([ordered]@{
        schemaVersion = 1
        releaseTag = $ReleaseTag
        startedAtUtc = $StartedAt.ToString("o")
        completedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        succeeded = [string]::IsNullOrWhiteSpace($DeploymentFailure)
        failure = $DeploymentFailure
        rollbackAttempted = $RollbackAttempted
        rollbackSucceeded = $RollbackSucceeded
        transport = "github-hosted-ssh"
    })

    & tar -czf $EvidenceArchivePath -C $StagingRoot "operation-evidence"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Deployment evidence archive could not be created." -ForegroundColor Yellow
    }
}

if (-not [string]::IsNullOrWhiteSpace($DeploymentFailure)) {
    if ($RollbackAttempted -and $RollbackSucceeded) {
        throw "Production deployment failed and the previous release was restored: $DeploymentFailure"
    }
    throw "Production deployment failed and automatic restoration was unsuccessful: $DeploymentFailure"
}
