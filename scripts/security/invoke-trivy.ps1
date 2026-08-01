param(
    [Parameter(Mandatory)]
    [string]$ProjectRoot,

    [Parameter(Mandatory)]
    [string[]]$TrivyArguments,

    [string]$ReportsRoot,

    [switch]$UseDockerSocket
)

# SALONAI_PHASE_7_11_TRIVY_RUNNER_VERSION=1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

if (-not $ReportsRoot) {
    $ReportsRoot = Join-Path $ProjectRoot "security-reports"
}

$ReportsRoot = [System.IO.Path]::GetFullPath($ReportsRoot)
$ConfigRoot = Join-Path $ProjectRoot "config\security"
$TrivyImage = "aquasec/trivy:0.70.0"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "Project root was not found: $ProjectRoot"
}

if (-not (Test-Path -LiteralPath $ConfigRoot)) {
    throw "Security configuration was not found: $ConfigRoot"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required to run Trivy."
}

New-Item -ItemType Directory -Path $ReportsRoot -Force | Out-Null

$ContainerName = "salonai-trivy-{0}" -f (
    [guid]::NewGuid().ToString("N").Substring(0, 12)
)

$DockerArguments = @(
    "run",
    "--rm",
    "--name", $ContainerName,
    "--pull", "missing",
    "--mount", "type=bind,source=$ProjectRoot,target=/workspace,readonly",
    "--mount", "type=bind,source=$ReportsRoot,target=/reports",
    "--mount", "type=bind,source=$ConfigRoot,target=/config,readonly",
    "--mount", "type=volume,source=salonai-trivy-cache,target=/root/.cache/trivy",
    "--env", "TRIVY_CACHE_DIR=/root/.cache/trivy"
)

if ($UseDockerSocket) {
    $DockerArguments += @(
        "--mount",
        "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock,readonly"
    )
}

$DockerArguments += $TrivyImage
$DockerArguments += $TrivyArguments

$global:LASTEXITCODE = 0
& docker @DockerArguments
$ExitCode = $LASTEXITCODE

if ($ExitCode -ne 0) {
    throw "Trivy exited with code $ExitCode."
}
