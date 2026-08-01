param(
    [string]$ProjectRoot = (
        Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    ),

    [switch]$SkipImages
)

# SALONAI_PHASE_7_11_SBOM_VERSION=1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ReportsRoot = Join-Path $ProjectRoot "security-reports"
$SbomRoot = Join-Path $ReportsRoot "sbom"
$Runner = Join-Path $PSScriptRoot "invoke-trivy.ps1"

New-Item -ItemType Directory -Path $SbomRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath $Runner)) {
    throw "Trivy runner was not found: $Runner"
}

$SkipArguments = @(
    "--skip-dirs", "/workspace/.git",
    "--skip-dirs", "/workspace/backups",
    "--skip-dirs", "/workspace/security-reports",
    "--skip-dirs", "/workspace/backend/node_modules",
    "--skip-dirs", "/workspace/frontend/node_modules",
    "--skip-dirs", "/workspace/frontend/dist",
    "--skip-dirs", "/workspace/ai-service/.venv",
    "--skip-files", "/workspace/.env.production",
    "--skip-files", "/workspace/backend/.env.production",
    "--skip-files", "/workspace/ai-service/.env.production"
)

Write-Host ""
Write-Host "==> Generating repository CycloneDX SBOM" -ForegroundColor Cyan

$RepositoryArguments = @(
    "fs",
    "--quiet",
    "--no-progress",
    "--timeout", "15m",
    "--format", "cyclonedx",
    "--output", "/reports/sbom/salonai-repository.cdx.json"
) + $SkipArguments + @("/workspace")

& $Runner `
    -ProjectRoot $ProjectRoot `
    -ReportsRoot $ReportsRoot `
    -TrivyArguments $RepositoryArguments

$AppVersion = "7.2.0"
$EnvironmentFile = Join-Path $ProjectRoot ".env.production"

if (Test-Path -LiteralPath $EnvironmentFile) {
    $VersionLine = Get-Content -LiteralPath $EnvironmentFile |
        Where-Object { $_ -match '^\s*APP_VERSION\s*=' } |
        Select-Object -First 1

    if ($VersionLine) {
        $ParsedVersion = ($VersionLine.Split('=', 2)[1]).Trim().Trim('"').Trim("'")

        if ($ParsedVersion) {
            $AppVersion = $ParsedVersion
        }
    }
}

$ImageResults = [System.Collections.Generic.List[object]]::new()

if (-not $SkipImages) {
    $Images = [ordered]@{
        backend = "salonai/backend:$AppVersion"
        frontend = "salonai/frontend:$AppVersion"
        aiService = "salonai/ai-service:$AppVersion"
    }

    foreach ($ImageProperty in $Images.GetEnumerator()) {
        $ImageName = $ImageProperty.Value
        $Slug = $ImageProperty.Key

        $global:LASTEXITCODE = 0
        & docker image inspect $ImageName *> $null

        if ($LASTEXITCODE -ne 0) {
            $ImageResults.Add([pscustomobject]@{
                image = $ImageName
                generated = $false
                reason = "local image not found"
            })
            continue
        }

        Write-Host "==> Generating SBOM for $ImageName" -ForegroundColor Cyan

        $ImageArguments = @(
            "image",
            "--quiet",
            "--no-progress",
            "--timeout", "15m",
            "--format", "cyclonedx",
            "--output", "/reports/sbom/salonai-$Slug.cdx.json",
            $ImageName
        )

        & $Runner `
            -ProjectRoot $ProjectRoot `
            -ReportsRoot $ReportsRoot `
            -UseDockerSocket `
            -TrivyArguments $ImageArguments

        $ImageResults.Add([pscustomobject]@{
            image = $ImageName
            generated = $true
            file = "salonai-$Slug.cdx.json"
        })
    }
}

$SbomFiles = @(Get-ChildItem -LiteralPath $SbomRoot -Filter "*.cdx.json" -File)

$Manifest = [ordered]@{
    schemaVersion = 1
    phase = "7.11"
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    format = "CycloneDX JSON"
    trivyImage = "aquasec/trivy:0.70.0"
    files = @(
        $SbomFiles | ForEach-Object {
            [ordered]@{
                name = $_.Name
                bytes = $_.Length
                sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
    )
    images = @($ImageResults)
}

$ManifestPath = Join-Path $SbomRoot "manifest.json"
$Manifest | ConvertTo-Json -Depth 10 | Set-Content `
    -LiteralPath $ManifestPath `
    -Encoding utf8

Write-Host ""
Write-Host "[PASS] CycloneDX SBOM generation completed." -ForegroundColor Green
Write-Host "Manifest: $ManifestPath" -ForegroundColor DarkGray
