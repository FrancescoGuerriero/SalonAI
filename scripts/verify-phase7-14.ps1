param(
    [string]$ProjectRoot = "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$Passed = 0
$Failed = 0
$Skipped = 0

function Pass([string]$Message) {
    $script:Passed++
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Check([bool]$Condition, [string]$Message) {
    if ($Condition) {
        Pass $Message
    }
    else {
        Fail $Message
    }
}

function Read-ProjectFile([string]$RelativePath) {
    $Path = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ""
    }

    return Get-Content -LiteralPath $Path -Raw
}

function Read-EnvironmentValues([string]$Path) {
    $Values = @{}

    foreach ($RawLine in Get-Content -LiteralPath $Path) {
        $Line = $RawLine.Trim()

        if ([string]::IsNullOrWhiteSpace($Line) -or $Line.StartsWith("#")) {
            continue
        }

        $Separator = $Line.IndexOf("=")
        if ($Separator -lt 1) {
            continue
        }

        $Values[$Line.Substring(0, $Separator).Trim()] =
            $Line.Substring($Separator + 1).Trim()
    }

    return $Values
}

Write-Host ""
Write-Host "SalonAI Phase 7.14 verification" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

$RequiredFiles = @(
    ".github\workflows\deploy-production.yml",
    "backend\.env.example",
    "backend\env.example",
    "config\phase7-14.env.example",
    "config\release\phase7-14-policy.json",
    "docker-compose.production.yml",
    "docker-compose.observability.yml",
    "nginx\templates\salonai.https.conf.template",
    "scripts\deployment\Test-ProductionEnvironment.ps1",
    "scripts\deployment\Test-ProductionSmoke.ps1",
    "scripts\deployment\Deploy-Production.ps1",
    "scripts\deployment\Invoke-RemoteProductionDeployment.ps1",
    "scripts\deployment\Rollback-Production.ps1",
    "scripts\security\test-phase7-14-secret-hygiene.ps1",
    "docs\operations\phase7-14-production-deployment.md",
    "docs\runbooks\phase7-14-deployment-failure.md",
    "scripts\verify-phase7-14.ps1"
)

Write-Host "`n==> Required files" -ForegroundColor Cyan
foreach ($RelativePath in $RequiredFiles) {
    Check `
        (Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath) -PathType Leaf) `
        $RelativePath
}

$Compose = Read-ProjectFile "docker-compose.production.yml"
$Observability = Read-ProjectFile "docker-compose.observability.yml"
$Workflow = Read-ProjectFile ".github\workflows\deploy-production.yml"
$Nginx = Read-ProjectFile "nginx\templates\salonai.https.conf.template"
$AiServiceExample = Read-ProjectFile "ai-service\.env.example"
$BackendExample = Read-ProjectFile "backend\.env.example"
$LegacyBackendExample = Read-ProjectFile "backend\env.example"
$DeploymentExample = Read-ProjectFile "config\phase7-14.env.example"
$DeployScript = Read-ProjectFile "scripts\deployment\Deploy-Production.ps1"
$RemoteDeployScript = Read-ProjectFile "scripts\deployment\Invoke-RemoteProductionDeployment.ps1"
$RollbackScript = Read-ProjectFile "scripts\deployment\Rollback-Production.ps1"

Write-Host "`n==> Immutable deployment controls" -ForegroundColor Cyan
Check ($Compose -notmatch "(?m)^\s*build:") "Production Compose contains no local image builds"
Check ($Compose -match "AI_SERVICE_IMAGE:\?") "AI-service immutable image is required"
Check ($Compose -match "BACKEND_IMAGE:\?") "Backend immutable image is required"
Check ($Compose -match "FRONTEND_IMAGE:\?") "Frontend immutable image is required"
Check ($Compose -notmatch "salonai-(ai-service|backend|frontend):\$\{APP_VERSION") "Application images are not tag-only references"
Check ($Compose -match "(?ms)^\s{2}prometheus:\s+image:\s+prom/prometheus:") "Base Prometheus service is retained"
Check ($Compose -match "salonai-prometheus-data:") "Prometheus data volume is retained"
Check ($Compose -match "MONGO_ROOT_PASSWORD:\?") "MongoDB password has no insecure default"
Check ($Compose -match '\$\{EDGE_HTTPS_PORT:-443\}:443') "HTTPS port is published"

Write-Host "`n==> Observability compatibility" -ForegroundColor Cyan
Check ($Observability -match "(?ms)^\s{2}prometheus:\s+depends_on:") "Observability overlay extends Prometheus"
Check ($Observability -match "external:\s+true") "External observability resources are declared"
Check ($DeployScript -match "Ensure-DockerNetwork") "Deployment ensures the shared Docker network"
Check ($DeployScript -match "Ensure-DockerVolume") "Deployment ensures the external Prometheus volume"

Write-Host "`n==> HTTPS edge controls" -ForegroundColor Cyan
Check ($Nginx -match "listen 443 ssl") "TLS listener"
Check ($Nginx -match "TLSv1\.2 TLSv1\.3") "Modern TLS protocols"
Check ($Nginx -match "Strict-Transport-Security") "HSTS header"
Check ($Nginx -match "return 301 https://") "HTTP to HTTPS redirect"
Check (($Nginx -match 'location /api/') -and ($Nginx -match 'proxy_pass http://salonai_backend')) "Backend routing"
Check ($Nginx -match "/ai/health") "AI-service health routing"

Write-Host "`n==> Release-manifest deployment workflow" -ForegroundColor Cyan
Check ($Workflow -match "workflow_dispatch:") "Manual production trigger"
Check ($Workflow -match "environment: production") "GitHub production environment"
Check ($Workflow -match "confirm_production") "Explicit confirmation"
Check ($Workflow -notmatch "self-hosted") "No persistent production runner"
Check ($Workflow -match "name:\s*Deploy production(?s:.*?)runs-on:\s*ubuntu-24\.04") "GitHub-hosted deployment runner"
Check ($Workflow -match "PRODUCTION_HOST") "Protected production host secret"
Check ($Workflow -match "PRODUCTION_USER") "Protected production user secret"
Check ($Workflow -match "PRODUCTION_SSH_KEY") "Protected production SSH key secret"
Check ($Workflow -match "PRODUCTION_KNOWN_HOSTS") "Protected production known-hosts secret"
Check ($Workflow -match "StrictHostKeyChecking=yes") "Strict SSH host-key checking"
Check ($Workflow -match "release-manifest\.json") "Release manifest is downloaded"
Check ($Workflow -match "sha256sum --check SHA256SUMS\.txt") "Release evidence checksums are verified"
Check ($Workflow -match "validate-deployment-evidence\.mjs") "Immutable release evidence validation"
Check ($RemoteDeployScript -match "immutableReference") "Immutable manifest image references are enforced"
Check ($RemoteDeployScript -match "RELEASE_SOURCE_COMMIT") "Release source commit is injected"
Check ($RemoteDeployScript -match 'Remove-Item -LiteralPath \$Destination') "Stable deployment directories are refreshed"
Check ($RemoteDeployScript -match "Deploy-Production\.ps1") "Guarded deploy script"
Check ($RemoteDeployScript -match "ReleaseManifestPath") "Deployment receives the release manifest"
Check ($RemoteDeployScript -match "Previous production release restored") "Automatic restoration path"
Check ($Workflow -match "retention-days: 90") "Deployment evidence retention"

Write-Host "`n==> Environment contract" -ForegroundColor Cyan
Check ($DeploymentExample -match "JWT_SECRET=CHANGE_ME") "Production JWT placeholder"
Check ($DeploymentExample -match "GRAFANA_ADMIN_PASSWORD=CHANGE_ME") "Grafana password placeholder"
Check ($DeploymentExample -match "AI_SERVICE_KEY=CHANGE_ME") "Backend AI-service key placeholder"
Check ($DeploymentExample -match "SERVICE_KEY=CHANGE_ME") "AI-service shared-key placeholder"
Check ($DeploymentExample -match "ENVIRONMENT=production") "AI-service production environment"
Check ($DeploymentExample -match "AI_SERVICE_IMAGE=.+@sha256:") "AI-service digest example"
Check ($DeploymentExample -match "BACKEND_IMAGE=.+@sha256:") "Backend digest example"
Check ($DeploymentExample -match "FRONTEND_IMAGE=.+@sha256:") "Frontend digest example"
Check ($DeploymentExample -match "RELEASE_SOURCE_COMMIT=") "Release commit example"

Write-Host "`n==> Secret hygiene" -ForegroundColor Cyan
Check ($AiServiceExample -match "SERVICE_KEY=<generate-at-least-32-random-characters>") "AI-service key placeholder"
Check ($BackendExample -match "MONGODB_URI=mongodb\+srv://<username>:<password>") "Primary MongoDB placeholder"
Check ($LegacyBackendExample -match "MONGODB_URI=mongodb\+srv://<username>:<password>") "Legacy MongoDB placeholder"
Check ($BackendExample -match "JWT_SECRET=<generate-at-least-64-random-bytes>") "Primary JWT placeholder"
Check ($LegacyBackendExample -match "JWT_SECRET=<generate-at-least-64-random-bytes>") "Legacy JWT placeholder"

Write-Host "`n==> Deployment and rollback evidence" -ForegroundColor Cyan
Check ($DeployScript -notmatch "git -C") "Deployment evidence does not require Git metadata"
Check ($DeployScript -match "releaseManifestSha256") "Deployment records the manifest checksum"
Check ($DeployScript -match "sourceCommit") "Deployment records the source commit"
Check ($DeployScript -match "config --quiet") "Deployment validates merged Compose configuration"
Check ($DeployScript -notmatch "remove-orphans") "Deployment preserves overlay services"
Check ($RollbackScript -match "RollbackManifestPath") "Rollback uses a release manifest"
Check ($RollbackScript -match "immutableReference") "Rollback restores immutable images"
Check ($RollbackScript -match "before-rollback") "Rollback backs up the environment"
Check ($RollbackScript -match "Previous production environment was restored") "Rollback has restoration handling"

Write-Host "`n==> Policy validity" -ForegroundColor Cyan
try {
    $Policy = (Read-ProjectFile "config\release\phase7-14-policy.json") |
        ConvertFrom-Json

    Pass "Phase 7.14 policy JSON"
    Check ($Policy.phase -eq "7.14") "Phase identity"
    Check ($Policy.deployment.requireHttps -eq $true) "HTTPS is mandatory"
    Check ($Policy.deployment.immutableImageDigests -eq $true) "Immutable image digests are mandatory"
    Check ($Policy.deployment.manualRollbackFromReleaseManifest -eq $true) "Manifest-driven rollback is mandatory"
    Check ($Policy.secretPolicy.rotatePreviouslyExposedValues -eq $true) "Credential rotation is mandatory"
}
catch {
    Fail "Phase 7.14 policy JSON: $($_.Exception.Message)"
}

Write-Host "`n==> PowerShell syntax" -ForegroundColor Cyan
$PowerShellFiles = @(
    "scripts\deployment\Test-ProductionEnvironment.ps1",
    "scripts\deployment\Test-ProductionSmoke.ps1",
    "scripts\deployment\Deploy-Production.ps1",
    "scripts\deployment\Invoke-RemoteProductionDeployment.ps1",
    "scripts\deployment\Rollback-Production.ps1",
    "scripts\security\test-phase7-14-secret-hygiene.ps1",
    "scripts\verify-phase7-14.ps1"
)

foreach ($RelativePath in $PowerShellFiles) {
    $Tokens = $null
    $Errors = $null

    [void][System.Management.Automation.Language.Parser]::ParseFile(
        (Join-Path $ProjectRoot $RelativePath),
        [ref]$Tokens,
        [ref]$Errors
    )

    Check (@($Errors).Count -eq 0) "PowerShell syntax: $RelativePath"
}

Write-Host "`n==> Executable secret check" -ForegroundColor Cyan
& powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File (Join-Path $ProjectRoot "scripts\security\test-phase7-14-secret-hygiene.ps1") `
    -ProjectRoot $ProjectRoot

Check ($LASTEXITCODE -eq 0) "Secret-hygiene policy execution"

$Docker = Get-Command docker -ErrorAction SilentlyContinue
$RuntimeEnvironment = Join-Path $ProjectRoot ".env.production"

if ($null -eq $Docker) {
    $Skipped++
    Write-Host "[SKIP] Docker Compose configuration validation: Docker is unavailable." -ForegroundColor Yellow
}
elseif (-not (Test-Path -LiteralPath $RuntimeEnvironment -PathType Leaf)) {
    $Skipped++
    Write-Host "[SKIP] Docker Compose configuration validation: .env.production is not configured yet." -ForegroundColor Yellow
}
else {
    $RuntimeValues = Read-EnvironmentValues -Path $RuntimeEnvironment

    $RequiredRuntimeVariables = @(
        "APP_VERSION",
        "RELEASE_SOURCE_COMMIT",
        "AI_SERVICE_IMAGE",
        "BACKEND_IMAGE",
        "FRONTEND_IMAGE",
        "SALONAI_DOMAIN",
        "PUBLIC_BASE_URL",
        "FRONTEND_URL",
        "MONGO_ROOT_USERNAME",
        "MONGO_ROOT_PASSWORD",
        "MONGO_DATABASE",
        "JWT_SECRET",
        "TLS_CERT_DIR",
        "GRAFANA_ADMIN_USER",
        "GRAFANA_ADMIN_PASSWORD"
    )

    $MissingRuntimeVariables = @(
        $RequiredRuntimeVariables |
            Where-Object {
                -not $RuntimeValues.ContainsKey($_) -or
                [string]::IsNullOrWhiteSpace($RuntimeValues[$_]) -or
                $RuntimeValues[$_] -match "CHANGE_ME|<[^>]+>|example\.com"
            }
    )

    if ($MissingRuntimeVariables.Count -gt 0) {
        $Skipped++

        Write-Host (
            "[SKIP] Docker Compose configuration validation: " +
            ".env.production is pending Phase 7.14 configuration. Missing or placeholder variables: " +
            ($MissingRuntimeVariables -join ", ")
        ) -ForegroundColor Yellow
    }
    else {
        $ComposeArguments = @(
            "compose",
            "--env-file",
            $RuntimeEnvironment,
            "-f",
            (Join-Path $ProjectRoot "docker-compose.production.yml"),
            "-f",
            (Join-Path $ProjectRoot "docker-compose.observability.yml"),
            "config",
            "--quiet"
        )

        Push-Location $ProjectRoot
        try {
            & docker @ComposeArguments
            Check ($LASTEXITCODE -eq 0) "Docker Compose production configuration"
        }
        finally {
            Pop-Location
        }
    }
}

Write-Host ""
Write-Host "Verification summary"
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Skipped: $Skipped"

if ($Failed -gt 0) {
    Write-Host "Phase 7.14 verification failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SalonAI Phase 7.14 verified successfully." -ForegroundColor Green
exit 0
