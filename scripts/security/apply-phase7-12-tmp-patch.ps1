
param(
    [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [switch]$SkipDockerBuild
)

# SALONAI_PHASE_7_12_TMP_PATCH_VERSION=8
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$BackendRoot = Join-Path $ProjectRoot "backend"
$BackendPackagePath = Join-Path $BackendRoot "package.json"
$BackendLockPath = Join-Path $BackendRoot "package-lock.json"
$PostureScript = Join-Path $PSScriptRoot "test-phase7-12-dependency-posture.ps1"
$LockReaderPath = Join-Path $PSScriptRoot "read-package-lock-versions.cjs"
$FindingReaderPath = Join-Path $PSScriptRoot "read-trivy-high-findings.cjs"
$RepositoryReport = Join-Path $ProjectRoot "security-reports\trivy\repository.json"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "backups\phase7-12-tmp-patch-v8-$Timestamp"

$NpmCommand = (Get-Command -Name "npm.cmd" -CommandType Application -ErrorAction Stop).Source
$NodeCommand = (Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop).Source

function Invoke-External {
    param([string]$Description,[scriptblock]$Command)
    Write-Host ""
    Write-Host "==> $Description" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Command
    $Code = $LASTEXITCODE
    if ($Code -ne 0) { throw "$Description failed with exit code $Code." }
}

function Write-JsonNoBom {
    param([string]$Path,[object]$Value)
    $Json = $Value | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path,$Json + [Environment]::NewLine,[System.Text.UTF8Encoding]::new($false))
}

function Set-JsonProperty {
    param([object]$Object,[string]$Name,[object]$Value)
    $Property = $Object.PSObject.Properties[$Name]
    if ($Property) { $Property.Value = $Value }
    else { $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
}

function Get-LockVersions {
    param([string]$LockPath,[string]$PackageName)
    $global:LASTEXITCODE = 0
    $Output = @(& $NodeCommand $LockReaderPath $LockPath $PackageName 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read $PackageName from $LockPath. $(@($Output) -join [Environment]::NewLine)"
    }
    return @($Output | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Sort-Object -Unique)
}

function Test-VersionAtLeast {
    param([string]$Version,[string]$Minimum)
    try { return ([version](($Version -split '-',2)[0]) -ge [version]$Minimum) }
    catch { return $false }
}

foreach ($Path in @($BackendRoot,$BackendPackagePath,$BackendLockPath,$PostureScript,$LockReaderPath,$FindingReaderPath,$RepositoryReport)) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Required path was not found: $Path" }
}

Write-Host ""
Write-Host "SalonAI Phase 7.12 targeted tmp patch" -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot"

$FindingJson = & $NodeCommand $FindingReaderPath $RepositoryReport
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the current unapproved Trivy findings." }
$HighFindings = @(@($FindingJson | ConvertFrom-Json) | Where-Object { $_.severity -eq "HIGH" })

Write-Host ""
Write-Host "==> Current unapproved repository findings" -ForegroundColor Cyan
if ($HighFindings.Count -eq 0) {
    Write-Host "No unapproved HIGH findings are present. Checking the installed dependency posture."
    & $PostureScript -ProjectRoot $ProjectRoot
    Write-Host "[PASS] The tmp patch is already applied." -ForegroundColor Green
    return
}
foreach ($Finding in $HighFindings) {
    Write-Host ("- {0} {1}@{2} fixed in {3}" -f $Finding.id,$Finding.packageName,$Finding.installedVersion,$Finding.fixedVersion)
}

$Expected = @($HighFindings | Where-Object {
    $_.id -eq "CVE-2026-49982" -and
    $_.packageName -eq "tmp" -and
    $_.installedVersion -eq "0.2.6" -and
    ([string]$_.fixedVersion -split ',')[0].Trim() -eq "0.2.7"
})
if ($HighFindings.Count -ne 1 -or $Expected.Count -ne 1) {
    $Description = @($HighFindings | ForEach-Object { "$($_.id):$($_.packageName)@$($_.installedVersion)" }) -join ", "
    throw "The unapproved finding was not exactly CVE-2026-49982 tmp@0.2.6. Findings: $Description"
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
foreach ($Path in @($BackendPackagePath,$BackendLockPath)) {
    Copy-Item -LiteralPath $Path -Destination (Join-Path $BackupRoot (Split-Path $Path -Leaf)) -Force
    Write-Host "[BACKUP] $Path"
}

$RepairSucceeded = $false
try {
    Write-Host ""
    Write-Host "==> Pinning tmp to 0.2.7" -ForegroundColor Cyan
    $BackendPackage = Get-Content -LiteralPath $BackendPackagePath -Raw | ConvertFrom-Json
    $OverridesProperty = $BackendPackage.PSObject.Properties["overrides"]
    if (-not $OverridesProperty -or $null -eq $OverridesProperty.Value) {
        $BackendPackage | Add-Member -NotePropertyName overrides -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    Set-JsonProperty $BackendPackage.overrides "tmp" "0.2.7"
    Write-JsonNoBom $BackendPackagePath $BackendPackage

    Invoke-External "Updating the backend lockfile" {
        Push-Location $BackendRoot
        try { & $NpmCommand install --package-lock-only --ignore-scripts --no-audit --no-fund }
        finally { Pop-Location }
    }

    $TmpVersions = @(Get-LockVersions $BackendLockPath "tmp")
    $UnsafeTmp = @($TmpVersions | Where-Object { -not (Test-VersionAtLeast $_ "0.2.7") })
    if ($TmpVersions.Count -eq 0 -or $UnsafeTmp.Count -gt 0 -or $TmpVersions -notcontains "0.2.7") {
        throw "The lockfile does not contain only patched tmp versions. Found: $($TmpVersions -join ', ')"
    }
    Write-Host "[PASS] Lockfile tmp versions: $($TmpVersions -join ', ')" -ForegroundColor Green

    Invoke-External "Installing backend dependencies" {
        Push-Location $BackendRoot
        try { & $NpmCommand ci --ignore-scripts --no-audit --no-fund }
        finally { Pop-Location }
    }

    $BackendPackage = Get-Content -LiteralPath $BackendPackagePath -Raw | ConvertFrom-Json
    if ($BackendPackage.scripts -and $BackendPackage.scripts.PSObject.Properties["validate"]) {
        Invoke-External "Running backend validation" {
            Push-Location $BackendRoot
            try { & $NpmCommand run validate }
            finally { Pop-Location }
        }
    }
    else {
        Invoke-External "Checking backend entry-point syntax" { & $NodeCommand --check (Join-Path $BackendRoot "server.js") }
    }

    & $PostureScript -ProjectRoot $ProjectRoot

    if (-not $SkipDockerBuild) {
        $EnvFile = Join-Path $ProjectRoot ".env.production"
        $ComposeFile = Join-Path $ProjectRoot "docker-compose.production.yml"
        foreach ($Path in @($EnvFile,$ComposeFile)) {
            if (-not (Test-Path -LiteralPath $Path)) { throw "Production Compose file was not found: $Path" }
        }

        Invoke-External "Rebuilding the tmp-remediated backend image" {
            Push-Location $ProjectRoot
            try { & docker compose --env-file $EnvFile -f $ComposeFile build backend }
            finally { Pop-Location }
        }
        Invoke-External "Recreating backend and edge" {
            Push-Location $ProjectRoot
            try {
                & docker compose --env-file $EnvFile -f $ComposeFile up -d --no-deps backend
                if ($LASTEXITCODE -eq 0) { & docker compose --env-file $EnvFile -f $ComposeFile up -d edge }
            }
            finally { Pop-Location }
        }

        foreach ($Container in @("salonai-backend","salonai-frontend")) {
            $Healthy = $false
            for ($Index = 0; $Index -lt 60; $Index++) {
                $State = & docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $Container 2>$null
                if ($LASTEXITCODE -eq 0 -and ([string]$State).Trim() -eq "healthy") { $Healthy = $true; break }
                Start-Sleep -Seconds 3
            }
            if (-not $Healthy) { & docker logs --tail 120 $Container; throw "$Container did not become healthy." }
            Write-Host "[PASS] $Container is healthy." -ForegroundColor Green
        }
    }

    $RepairSucceeded = $true
    Write-Host ""
    Write-Host "[PASS] tmp 0.2.6 was patched to 0.2.7." -ForegroundColor Green
    Write-Host "Rollback backup: $BackupRoot" -ForegroundColor DarkGray
}
finally {
    if (-not $RepairSucceeded) {
        Write-Host ""
        Write-Host "tmp patch failed; restoring backend package files." -ForegroundColor Yellow
        Copy-Item -LiteralPath (Join-Path $BackupRoot "package.json") -Destination $BackendPackagePath -Force
        Copy-Item -LiteralPath (Join-Path $BackupRoot "package-lock.json") -Destination $BackendLockPath -Force
        try { Push-Location $BackendRoot; & $NpmCommand ci --ignore-scripts --no-audit --no-fund *> $null; Pop-Location }
        catch { Pop-Location -ErrorAction SilentlyContinue }
        if (-not $SkipDockerBuild) {
            try {
                $EnvFile = Join-Path $ProjectRoot ".env.production"
                $ComposeFile = Join-Path $ProjectRoot "docker-compose.production.yml"
                Push-Location $ProjectRoot
                & docker compose --env-file $EnvFile -f $ComposeFile build backend *> $null
                if ($LASTEXITCODE -eq 0) {
                    & docker compose --env-file $EnvFile -f $ComposeFile up -d --no-deps backend *> $null
                    & docker compose --env-file $EnvFile -f $ComposeFile up -d edge *> $null
                }
                Pop-Location
            }
            catch { Pop-Location -ErrorAction SilentlyContinue }
        }
    }
}
