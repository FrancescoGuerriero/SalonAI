param(
    [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [switch]$SkipDockerBuild
)

# SALONAI_PHASE_7_12_APPLY_VERSION=8
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$BackendRoot = Join-Path $ProjectRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "backups\phase7-12-dependency-remediation-v8-$Timestamp"
$PostureScript = Join-Path $PSScriptRoot "test-phase7-12-dependency-posture.ps1"

# Call the native Windows command shim explicitly. This avoids npm.ps1 failing
# under Set-StrictMode while reading $MyInvocation.Statement.
$NpmCommandInfo = Get-Command -Name "npm.cmd" -CommandType Application -ErrorAction Stop
$NpmCommand = $NpmCommandInfo.Source
$NodeCommandInfo = Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop
$NodeCommand = $NodeCommandInfo.Source

function Invoke-External {
    param([string]$Description,[scriptblock]$Command)
    Write-Host ""
    Write-Host "==> $Description" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Command
    $Code = $LASTEXITCODE
    if ($Code -ne 0) {
        throw "$Description failed with exit code $Code."
    }
}

function Write-JsonNoBom {
    param([string]$Path,[object]$Value)
    $Json = $Value | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText(
        $Path,
        $Json + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Set-JsonProperty {
    param([object]$Object,[string]$Name,[object]$Value)
    $Property = $Object.PSObject.Properties[$Name]
    if ($Property) {
        $Property.Value = $Value
    }
    else {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
    }
}

foreach ($Path in @($BackendRoot,$FrontendRoot,$PostureScript)) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required path was not found: $Path"
    }
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$Files = @(
    "backend\package.json",
    "backend\package-lock.json",
    "frontend\package.json",
    "frontend\package-lock.json"
)

foreach ($Relative in $Files) {
    $Source = Join-Path $ProjectRoot $Relative
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Required package file was not found: $Relative"
    }
    $Destination = Join-Path $BackupRoot $Relative
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    Write-Host "[BACKUP] $Relative"
}

try {
    Write-Host ""
    Write-Host "==> Applying the safe dependency remediation" -ForegroundColor Cyan

    $BackendPackagePath = Join-Path $BackendRoot "package.json"
    $BackendPackage = Get-Content -LiteralPath $BackendPackagePath -Raw | ConvertFrom-Json
    $Overrides = $BackendPackage.PSObject.Properties["overrides"]
    if (-not $Overrides -or $null -eq $Overrides.Value) {
        $BackendPackage | Add-Member -NotePropertyName overrides -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    Set-JsonProperty $BackendPackage.overrides "tmp" "0.2.7"
    Write-JsonNoBom $BackendPackagePath $BackendPackage

    $FrontendPackagePath = Join-Path $FrontendRoot "package.json"
    $FrontendPackage = Get-Content -LiteralPath $FrontendPackagePath -Raw | ConvertFrom-Json
    if (-not $FrontendPackage.PSObject.Properties["dependencies"]) {
        throw "frontend/package.json has no dependencies object."
    }
    $RouterDomProperty = $FrontendPackage.dependencies.PSObject.Properties["react-router-dom"]
    if (-not $RouterDomProperty) {
        throw "frontend/package.json does not declare react-router-dom."
    }
    $RouterDomRange = [string]$RouterDomProperty.Value
    if ($RouterDomRange -notmatch '7\.18\.1') {
        throw "Expected react-router-dom 7.18.1 compatibility dependency, found: $RouterDomRange"
    }

    Invoke-External "Updating backend lockfile" {
        Push-Location $BackendRoot
        try {
            & $NpmCommand install --package-lock-only --ignore-scripts --no-audit --no-fund
        }
        finally {
            Pop-Location
        }
    }

    Invoke-External "Installing and building frontend" {
        Push-Location $FrontendRoot
        try {
            & $NpmCommand ci --ignore-scripts --no-audit --no-fund
            if ($LASTEXITCODE -eq 0) {
                & $NpmCommand run build
            }
        }
        finally {
            Pop-Location
        }
    }

    Invoke-External "Installing backend dependencies" {
        Push-Location $BackendRoot
        try {
            & $NpmCommand ci --ignore-scripts --no-audit --no-fund
        }
        finally {
            Pop-Location
        }
    }

    $BackendPackage = Get-Content -LiteralPath $BackendPackagePath -Raw | ConvertFrom-Json
    if ($BackendPackage.scripts -and $BackendPackage.scripts.PSObject.Properties["validate"]) {
        Invoke-External "Running backend validation" {
            Push-Location $BackendRoot
            try {
                & $NpmCommand run validate
            }
            finally {
                Pop-Location
            }
        }
    }
    else {
        Invoke-External "Checking backend entry-point syntax" {
            & $NodeCommand --check (Join-Path $BackendRoot "server.js")
        }
    }

    & $PostureScript -ProjectRoot $ProjectRoot

    if (-not $SkipDockerBuild) {
        $EnvFile = Join-Path $ProjectRoot ".env.production"
        $ComposeFile = Join-Path $ProjectRoot "docker-compose.production.yml"
        if (-not (Test-Path -LiteralPath $EnvFile) -or -not (Test-Path -LiteralPath $ComposeFile)) {
            throw "Production Compose files are missing."
        }

        Invoke-External "Rebuilding dependency-remediated application images" {
            Push-Location $ProjectRoot
            try {
                & docker compose --env-file $EnvFile -f $ComposeFile build backend frontend
            }
            finally {
                Pop-Location
            }
        }

        Invoke-External "Recreating backend, frontend and edge" {
            Push-Location $ProjectRoot
            try {
                & docker compose --env-file $EnvFile -f $ComposeFile up -d --no-deps backend frontend
                if ($LASTEXITCODE -eq 0) {
                    & docker compose --env-file $EnvFile -f $ComposeFile up -d edge
                }
            }
            finally {
                Pop-Location
            }
        }

        foreach ($Service in @("salonai-backend","salonai-frontend")) {
            $Healthy = $false
            for ($Index = 0; $Index -lt 60; $Index++) {
                $State = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $Service 2>$null)
                if ($LASTEXITCODE -eq 0 -and $State.Trim() -eq "healthy") {
                    $Healthy = $true
                    break
                }
                Start-Sleep -Seconds 3
            }
            if (-not $Healthy) {
                & docker logs --tail 120 $Service
                throw "$Service did not become healthy."
            }
            Write-Host "[PASS] $Service is healthy." -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "[PASS] Phase 7.12 dependency changes applied." -ForegroundColor Green
    Write-Host "Rollback backup: $BackupRoot" -ForegroundColor DarkGray
}
catch {
    Write-Host ""
    Write-Host "Dependency remediation failed; restoring package files." -ForegroundColor Yellow
    foreach ($Relative in $Files) {
        $Source = Join-Path $BackupRoot $Relative
        $Destination = Join-Path $ProjectRoot $Relative
        if (Test-Path -LiteralPath $Source) {
            Copy-Item -LiteralPath $Source -Destination $Destination -Force
        }
    }
    try {
        Push-Location $BackendRoot
        & $NpmCommand ci --ignore-scripts --no-audit --no-fund *> $null
        Pop-Location
    }
    catch {
        Pop-Location -ErrorAction SilentlyContinue
    }
    try {
        Push-Location $FrontendRoot
        & $NpmCommand ci --ignore-scripts --no-audit --no-fund *> $null
        Pop-Location
    }
    catch {
        Pop-Location -ErrorAction SilentlyContinue
    }
    throw
}
