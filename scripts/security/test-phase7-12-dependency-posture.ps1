
param(
    [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [switch]$Quiet
)

# SALONAI_PHASE_7_12_DEPENDENCY_POSTURE_VERSION=8
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$BackendPackagePath = Join-Path $ProjectRoot "backend\package.json"
$BackendLockPath = Join-Path $ProjectRoot "backend\package-lock.json"
$FrontendLockPath = Join-Path $ProjectRoot "frontend\package-lock.json"
$FrontendPackagePath = Join-Path $ProjectRoot "frontend\package.json"
$ExceptionPath = Join-Path $ProjectRoot "config\security\dependency-exceptions.json"
$IgnorePath = Join-Path $ProjectRoot "config\security\trivyignore.yaml"
$ReportRoot = Join-Path $ProjectRoot "security-reports\dependencies"
$ReportPath = Join-Path $ReportRoot "dependency-posture.json"
$LockReaderPath = Join-Path $PSScriptRoot "read-package-lock-versions.cjs"
$NodeCommand = (Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop).Source

foreach ($Path in @($BackendPackagePath,$BackendLockPath,$FrontendLockPath,$FrontendPackagePath,$ExceptionPath,$IgnorePath,$LockReaderPath)) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Required dependency file was not found: $Path" }
}
New-Item -ItemType Directory -Path $ReportRoot -Force | Out-Null

function Get-LockVersions {
    param([string]$LockPath,[string]$PackageName)
    $global:LASTEXITCODE = 0
    $Output = @(& $NodeCommand $LockReaderPath $LockPath $PackageName 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Unable to read $PackageName versions from $LockPath. $(@($Output) -join [Environment]::NewLine)" }
    return @($Output | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Sort-Object -Unique)
}
function Test-VersionAtLeast {
    param([string]$Version,[string]$Minimum)
    try { return ([version](($Version -split '-',2)[0]) -ge [version]$Minimum) } catch { return $false }
}
function Find-SourcePattern {
    param([string[]]$Roots,[string]$Pattern)
    $Matches = [System.Collections.Generic.List[object]]::new()
    foreach ($Root in $Roots) {
        if (-not (Test-Path -LiteralPath $Root)) { continue }
        $RootItem = Get-Item -LiteralPath $Root
        $Items = if ($RootItem.PSIsContainer) { Get-ChildItem -LiteralPath $Root -Recurse -File -Include *.js,*.jsx,*.mjs,*.cjs,*.ts,*.tsx } else { @($RootItem) }
        foreach ($Item in @($Items)) {
            foreach ($Match in @(Select-String -LiteralPath $Item.FullName -Pattern $Pattern -AllMatches -ErrorAction SilentlyContinue)) {
                $Matches.Add([pscustomobject]@{ path=$Item.FullName.Substring($ProjectRoot.Length).TrimStart('\'); line=$Match.LineNumber; text=$Match.Line.Trim() })
            }
        }
    }
    return @($Matches)
}
function Get-Exception {
    param([object]$Document,[string]$Id)
    return @($Document.exceptions | Where-Object { $_.id -eq $Id }) | Select-Object -First 1
}
function Test-ExceptionDate {
    param([object]$Exception)
    if ($null -eq $Exception) { return $false }
    try {
        $Expiry = [DateTime]::ParseExact([string]$Exception.expiresAt,"yyyy-MM-dd",[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal)
        return $Expiry.Date -ge [DateTime]::UtcNow.Date
    } catch { return $false }
}

$TmpVersions = @(Get-LockVersions $BackendLockPath "tmp")
$BraceVersions = @(Get-LockVersions $BackendLockPath "brace-expansion")
$RouterVersions = @(Get-LockVersions $FrontendLockPath "react-router")
$RouterDomVersions = @(Get-LockVersions $FrontendLockPath "react-router-dom")
$TmpUnsafe = @($TmpVersions | Where-Object { -not (Test-VersionAtLeast $_ "0.2.7") })

$BackendPackage = Get-Content -LiteralPath $BackendPackagePath -Raw | ConvertFrom-Json
$OverridesProperty = $BackendPackage.PSObject.Properties["overrides"]
$TmpOverrideProperty = $null
if ($OverridesProperty -and $null -ne $OverridesProperty.Value) { $TmpOverrideProperty = $OverridesProperty.Value.PSObject.Properties["tmp"] }
$TmpOverrideValid = ($null -ne $TmpOverrideProperty -and [string]$TmpOverrideProperty.Value -eq "0.2.7")

$FrontendPackage = Get-Content -LiteralPath $FrontendPackagePath -Raw | ConvertFrom-Json
$RouterDomDeclared = [string]$FrontendPackage.dependencies.'react-router-dom'
$BackendReachability = @(Find-SourcePattern @((Join-Path $ProjectRoot "backend\src"),(Join-Path $ProjectRoot "backend\server.js")) '(?i)(from\s+["''](?:brace-expansion|glob|minimatch)["'']|require\(\s*["''](?:brace-expansion|glob|minimatch)["'']\s*\))')
$RscUsage = @(Find-SourcePattern @((Join-Path $ProjectRoot "frontend\src")) '(?i)(unstable_.*rsc|react-server-dom|createCallServer|decodeReply|decodeAction|@react-router/node|@react-router/serve)')

$ExceptionDocument = Get-Content -LiteralPath $ExceptionPath -Raw | ConvertFrom-Json
$BraceException = Get-Exception $ExceptionDocument "CVE-2026-14257"
$RouterException = Get-Exception $ExceptionDocument "GHSA-qwww-vcr4-c8h2"
$BraceExceptionValid = ((Test-ExceptionDate $BraceException) -and $BackendReachability.Count -eq 0 -and $BraceException.purl -eq "pkg:npm/brace-expansion@1.1.16")
$RouterVersionsValid = ($RouterVersions.Count -eq 1 -and $RouterVersions[0] -eq "7.18.1" -and $RouterDomVersions.Count -eq 1 -and $RouterDomVersions[0] -eq "7.18.1" -and $RouterDomDeclared -match '7\.18\.1')
$RouterExceptionValid = ((Test-ExceptionDate $RouterException) -and $RscUsage.Count -eq 0 -and $RouterException.purl -eq "pkg:npm/react-router@7.18.1" -and $RouterVersionsValid)

$IgnoreContent = Get-Content -LiteralPath $IgnorePath -Raw
$BraceIgnoreValid = ($IgnoreContent -match 'CVE-2026-14257' -and $IgnoreContent -match 'pkg:npm/brace-expansion@1\.1\.16' -and $IgnoreContent -match '2026-08-14T23:59:59Z')
$RouterIgnoreValid = ($IgnoreContent -match 'GHSA-qwww-vcr4-c8h2' -and $IgnoreContent -match 'pkg:npm/react-router@7\.18\.1' -and $IgnoreContent -match '2026-08-14T23:59:59Z')

$Failures = [System.Collections.Generic.List[string]]::new()
if ($TmpVersions.Count -eq 0) { $Failures.Add("tmp was not found in backend/package-lock.json.") }
if ($TmpUnsafe.Count -gt 0) { $Failures.Add("Unsafe tmp versions remain: $($TmpUnsafe -join ', ')") }
if (-not $TmpOverrideValid) { $Failures.Add("The backend tmp override is not pinned to 0.2.7.") }
if (-not $RouterVersionsValid) { $Failures.Add("Expected react-router and react-router-dom 7.18.1 compatibility packages were not found.") }
if ($RscUsage.Count -gt 0) { $Failures.Add("Unstable React Router RSC usage was detected.") }
if (-not $BraceExceptionValid) { $Failures.Add("The legacy brace-expansion 1.1.16 exception is expired, incorrectly scoped, or runtime-reachable.") }
if (-not $RouterExceptionValid) { $Failures.Add("The React Router exception is expired, incorrectly scoped, or RSC-reachable.") }
if (-not $BraceIgnoreValid -or -not $RouterIgnoreValid) { $Failures.Add("The Trivy exception file is not correctly scoped for both approved findings.") }

$Report = [ordered]@{
    schemaVersion=4; phase="7.12"; generatedAtUtc=[DateTime]::UtcNow.ToString("o")
    backend=[ordered]@{ tmpVersions=@($TmpVersions); tmpOverride=$(if ($null -ne $TmpOverrideProperty) { [string]$TmpOverrideProperty.Value } else { $null }); braceExpansionVersions=@($BraceVersions); prohibitedRuntimeImports=@($BackendReachability) }
    frontend=[ordered]@{ declaredReactRouterDom=$RouterDomDeclared; reactRouterVersions=@($RouterVersions); reactRouterDomVersions=@($RouterDomVersions); unstableRscUsage=@($RscUsage) }
    exceptions=@(
        [ordered]@{ id=$BraceException.id; packageVersion="1.1.16"; status=$BraceException.status; expiresAt=$BraceException.expiresAt; valid=$BraceExceptionValid; ignoreFileValid=$BraceIgnoreValid },
        [ordered]@{ id=$RouterException.id; packageVersion="7.18.1"; status=$RouterException.status; expiresAt=$RouterException.expiresAt; valid=$RouterExceptionValid; ignoreFileValid=$RouterIgnoreValid }
    )
    passed=($Failures.Count -eq 0); failures=@($Failures)
}
$Report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportPath -Encoding utf8

if (-not $Quiet) {
    Write-Host ""
    Write-Host "SalonAI Phase 7.12 dependency posture" -ForegroundColor Magenta
    Write-Host "tmp versions: $($TmpVersions -join ', ')"
    Write-Host "React Router versions: $($RouterVersions -join ', ')"
    Write-Host "react-router-dom versions: $($RouterDomVersions -join ', ')"
    Write-Host "brace-expansion versions: $($BraceVersions -join ', ')"
    Write-Host "Approved exceptions: 2"
    Write-Host "Exception expiry: 2026-08-14"
    Write-Host "Report: $ReportPath" -ForegroundColor DarkGray
}
if ($Failures.Count -gt 0) {
    foreach ($Failure in $Failures) { Write-Host "[FAIL] $Failure" -ForegroundColor Red }
    throw "Phase 7.12 dependency posture failed."
}
if (-not $Quiet) { Write-Host "[PASS] Dependency posture passed." -ForegroundColor Green }
