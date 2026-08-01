param(
    [string]$ProjectRoot = (Resolve-Path ".").Path,
    [string]$InputFile = "deployment-evidence\phase7-15\inputs.json",
    [switch]$GenerateEnvironment,
    [switch]$RunGitHubChecks,
    [switch]$PullImages,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$InputPath = if ([System.IO.Path]::IsPathRooted($InputFile)) {
    $InputFile
}
else {
    Join-Path $ProjectRoot $InputFile
}

$EvidenceDirectory = Join-Path $ProjectRoot "deployment-evidence\phase7-15"
$EvidenceJson = Join-Path $EvidenceDirectory "readiness-evidence.json"
$EvidenceMarkdown = Join-Path $EvidenceDirectory "readiness-summary.md"
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

$Checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet("PASS", "PENDING", "FAIL")][string]$Status,
        [Parameter(Mandatory)][string]$Detail
    )

    $Checks.Add([pscustomobject]@{
        name = $Name
        status = $Status
        detail = $Detail
    })
}

function Resolve-ProjectPath {
    param([Parameter(Mandatory)][string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Phase 7.15 input file is missing: $InputPath"
}

$InputData = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
$Domain = [string]$InputData.domain
$ManifestPath = Resolve-ProjectPath -Path ([string]$InputData.releaseManifestPath)
$TlsDirectory = Resolve-ProjectPath -Path ([string]$InputData.tlsCertDirectory)

$Phase714Verifier = Join-Path $ProjectRoot "scripts\verify-phase7-14.ps1"
if (Test-Path -LiteralPath $Phase714Verifier -PathType Leaf) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $Phase714Verifier -ProjectRoot $ProjectRoot
    if ($LASTEXITCODE -eq 0) {
        Add-Check -Name "Phase 7.14 baseline" -Status "PASS" -Detail "Phase 7.14 verifier passed."
    }
    else {
        Add-Check -Name "Phase 7.14 baseline" -Status "FAIL" -Detail "Phase 7.14 verifier failed."
    }
}
else {
    Add-Check -Name "Phase 7.14 baseline" -Status "FAIL" -Detail "Phase 7.14 verifier is missing."
}

foreach ($Pair in @(
    @("MongoDB credential rotation", [bool]$InputData.mongoCredentialRotationConfirmed),
    @("JWT credential rotation", [bool]$InputData.jwtCredentialRotationConfirmed),
    @("GitHub production environment configuration", [bool]$InputData.githubEnvironmentConfigured),
    @("Self-hosted runner configuration", [bool]$InputData.selfHostedRunnerConfigured),
    @("DNS configuration", [bool]$InputData.dnsConfigured),
    @("TLS configuration", [bool]$InputData.tlsConfigured)
)) {
    if ($Pair[1]) {
        Add-Check -Name $Pair[0] -Status "PASS" -Detail "Confirmed in the Phase 7.15 input file."
    }
    else {
        Add-Check -Name $Pair[0] -Status "PENDING" -Detail "Complete the external action, then update the input file."
    }
}

if ([string]::IsNullOrWhiteSpace($Domain) -or $Domain -match "example\.com") {
    Add-Check -Name "Production domain" -Status "PENDING" -Detail "Replace the placeholder domain."
}
else {
    try {
        $DnsRecords = @(Resolve-DnsName -Name $Domain -Type A -ErrorAction Stop)
        $Addresses = @($DnsRecords | Where-Object { $_.IPAddress } | ForEach-Object { [string]$_.IPAddress })

        if ($Addresses.Count -eq 0) {
            Add-Check -Name "Production DNS" -Status "FAIL" -Detail "No A record was returned for $Domain."
        }
        elseif (-not [string]::IsNullOrWhiteSpace([string]$InputData.expectedPublicIp) -and
            $Addresses -notcontains [string]$InputData.expectedPublicIp) {
            Add-Check -Name "Production DNS" -Status "FAIL" -Detail "DNS does not include the expected public IP."
        }
        else {
            Add-Check -Name "Production DNS" -Status "PASS" -Detail "The domain resolves to at least one IPv4 address."
        }
    }
    catch {
        Add-Check -Name "Production DNS" -Status "FAIL" -Detail $_.Exception.Message
    }
}

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    Add-Check -Name "Release manifest" -Status "PENDING" -Detail "Release manifest not found: $ManifestPath"
}
else {
    try {
        $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
        $Images = @($Manifest.images)

        if ([int]$Manifest.schemaVersion -ne 1 -or
            [string]$Manifest.sourceCommit -notmatch "^[a-f0-9]{40}$" -or
            $Images.Count -ne 3) {
            throw "Release manifest identity or service count is invalid."
        }

        foreach ($Service in @("ai-service", "backend", "frontend")) {
            $Entry = @($Images | Where-Object { $_.service -eq $Service }) | Select-Object -First 1
            if ($null -eq $Entry -or
                [string]$Entry.immutableReference -notmatch "^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$") {
                throw "Invalid immutable image entry for $Service."
            }
        }

        Add-Check -Name "Release manifest" -Status "PASS" -Detail "Manifest contains three immutable GHCR references."
    }
    catch {
        Add-Check -Name "Release manifest" -Status "FAIL" -Detail $_.Exception.Message
    }
}

$TlsFilesReady = $true
foreach ($TlsFile in @("fullchain.pem", "privkey.pem")) {
    $TlsPath = Join-Path $TlsDirectory $TlsFile
    if (-not (Test-Path -LiteralPath $TlsPath -PathType Leaf) -or
        (Get-Item -LiteralPath $TlsPath).Length -eq 0) {
        $TlsFilesReady = $false
    }
}

if ($TlsFilesReady) {
    Add-Check -Name "TLS files" -Status "PASS" -Detail "fullchain.pem and privkey.pem exist and are non-empty."
}
else {
    Add-Check -Name "TLS files" -Status "PENDING" -Detail "Install fullchain.pem and privkey.pem in the configured TLS directory."
}

if ($RunGitHubChecks) {
    try {
        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File (Join-Path $ProjectRoot "scripts\production\Test-GitHubProductionReadiness.ps1") `
            -Repository ([string]$InputData.githubRepository) `
            -Environment ([string]$InputData.githubEnvironment) `
            -RunnerLabel ([string]$InputData.runnerLabel)

        if ($LASTEXITCODE -ne 0) {
            throw "GitHub readiness script failed."
        }

        Add-Check -Name "GitHub production control plane" -Status "PASS" -Detail "Environment and runner checks passed."
    }
    catch {
        Add-Check -Name "GitHub production control plane" -Status "FAIL" -Detail $_.Exception.Message
    }
}
else {
    Add-Check -Name "GitHub production control plane" -Status "PENDING" -Detail "Run again with -RunGitHubChecks after GitHub CLI authentication."
}

if ($GenerateEnvironment) {
    try {
        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File (Join-Path $ProjectRoot "scripts\production\New-ProductionEnvironment.ps1") `
            -ProjectRoot $ProjectRoot `
            -InputFile $InputPath

        if ($LASTEXITCODE -ne 0) {
            throw "Environment generation failed."
        }

        Add-Check -Name "Production environment generation" -Status "PASS" -Detail ".env.production was generated without printing secrets."
    }
    catch {
        Add-Check -Name "Production environment generation" -Status "FAIL" -Detail $_.Exception.Message
    }
}
elseif (Test-Path -LiteralPath (Join-Path $ProjectRoot ".env.production") -PathType Leaf) {
    Add-Check -Name "Production environment file" -Status "PASS" -Detail "An untracked .env.production file exists."
}
else {
    Add-Check -Name "Production environment file" -Status "PENDING" -Detail "Run with -GenerateEnvironment after manifest, domain and TLS inputs are ready."
}

$EnvironmentPath = Join-Path $ProjectRoot ".env.production"
if (Test-Path -LiteralPath $EnvironmentPath -PathType Leaf) {
    try {
        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File (Join-Path $ProjectRoot "scripts\production\Invoke-ProductionRehearsal.ps1") `
            -ProjectRoot $ProjectRoot `
            -EnvironmentFile $EnvironmentPath `
            -PullImages:$PullImages

        if ($LASTEXITCODE -ne 0) {
            throw "Production rehearsal failed."
        }

        Add-Check -Name "Non-destructive deployment rehearsal" -Status "PASS" -Detail "Compose validation passed without starting containers."
    }
    catch {
        Add-Check -Name "Non-destructive deployment rehearsal" -Status "FAIL" -Detail $_.Exception.Message
    }
}
else {
    Add-Check -Name "Non-destructive deployment rehearsal" -Status "PENDING" -Detail "A valid .env.production file is required."
}

$FailCount = @($Checks | Where-Object { $_.status -eq "FAIL" }).Count
$PendingCount = @($Checks | Where-Object { $_.status -eq "PENDING" }).Count
$PassCount = @($Checks | Where-Object { $_.status -eq "PASS" }).Count
$Ready = ($FailCount -eq 0 -and $PendingCount -eq 0)

$Evidence = [ordered]@{
    schemaVersion = 1
    phase = "7.15"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    repository = "FrancescoGuerriero/SalonAI"
    readyForGoLiveReview = $Ready
    passed = $PassCount
    pending = $PendingCount
    failed = $FailCount
    checks = $Checks
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $EvidenceJson,
    (($Evidence | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
    $Utf8NoBom
)

$Markdown = New-Object System.Collections.Generic.List[string]
$Markdown.Add("# SalonAI Phase 7.15 readiness summary")
$Markdown.Add("")
$Markdown.Add("- Generated: $($Evidence.generatedAt)")
$Markdown.Add("- Ready for go-live review: $Ready")
$Markdown.Add("- Passed: $PassCount")
$Markdown.Add("- Pending: $PendingCount")
$Markdown.Add("- Failed: $FailCount")
$Markdown.Add("")
$Markdown.Add("| Check | Status | Detail |")
$Markdown.Add("|---|---|---|")
foreach ($Check in $Checks) {
    $SafeDetail = ([string]$Check.detail).Replace("|", "\|")
    $Markdown.Add("| $($Check.name) | $($Check.status) | $SafeDetail |")
}

[System.IO.File]::WriteAllText(
    $EvidenceMarkdown,
    (($Markdown -join [Environment]::NewLine) + [Environment]::NewLine),
    $Utf8NoBom
)

Write-Host ""
Write-Host "Phase 7.15 readiness summary" -ForegroundColor Cyan
Write-Host "Passed:  $PassCount"
Write-Host "Pending: $PendingCount"
Write-Host "Failed:  $FailCount"
Write-Host "Evidence: $EvidenceMarkdown"

if ($Ready) {
    Write-Host "READY FOR GO-LIVE REVIEW. No deployment was performed." -ForegroundColor Green
}
else {
    Write-Host "NOT READY FOR GO-LIVE REVIEW. Resolve pending and failed checks." -ForegroundColor Yellow
}

if ($Strict -and -not $Ready) {
    exit 2
}
