param(
    [Parameter(Mandatory)][string]$ReleaseManifestPath,
    [Parameter(Mandatory)][string]$EvidenceDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Operator-only, read-only capture on the deployment host. This script does
# not deploy, restart, inspect container environment variables or upload files.
# The trusted archive verifier must independently validate this manifest.
$Manifest = Get-Content -LiteralPath $ReleaseManifestPath -Raw | ConvertFrom-Json
if ($Manifest.schemaVersion -ne 1 -or
    $Manifest.releaseTag -notmatch '^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$' -or
    $Manifest.sourceCommit -notmatch '^[a-f0-9]{40}$') {
    throw "Release manifest identity is invalid."
}

$Containers = [ordered]@{
    "ai-service" = "salonai-ai-service"
    "backend" = "salonai-backend"
    "frontend" = "salonai-frontend"
}
$Services = @()
foreach ($Service in $Containers.Keys) {
    $Name = $Containers[$Service]
    $Raw = & docker inspect --type container --format '{{json .}}' $Name
    if ($LASTEXITCODE -ne 0 -or -not $Raw) {
        throw "Required application container is missing: $Service"
    }
    $Container = ($Raw | Select-Object -Last 1) | ConvertFrom-Json
    $ImageId = [string]$Container.Image
    if ($ImageId -notmatch '^sha256:[a-f0-9]{64}$') {
        throw "Container image identity is invalid: $Service"
    }
    $DigestsRaw = & docker image inspect --format '{{json .RepoDigests}}' $ImageId
    if ($LASTEXITCODE -ne 0 -or -not $DigestsRaw) {
        throw "Local image digest evidence unavailable: $Service"
    }
    $Digests = @((($DigestsRaw | Select-Object -Last 1) | ConvertFrom-Json))
    $Services += [ordered]@{
        service = [string]$Service
        containerName = [string]$Name
        state = [string]$Container.State.Status
        health = if ($Container.State.Health) { [string]$Container.State.Health.Status } else { "unknown" }
        imageId = $ImageId
        configuredImage = [string]$Container.Config.Image
        repoDigests = @($Digests | ForEach-Object { [string]$_ })
    }
}

$Snapshot = [ordered]@{
    schemaVersion = 1
    environment = "production"
    releaseTag = [string]$Manifest.releaseTag
    sourceCommit = [string]$Manifest.sourceCommit
    collectedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    services = $Services
}
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
$Path = Join-Path $EvidenceDirectory "runtime-snapshot.json"
[System.IO.File]::WriteAllText(
    $Path,
    (($Snapshot | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host "[PASS] Read-only runtime snapshot captured. This is NOT signed host attestation."
Write-Host "Snapshot: $Path"
