param(
    [string]$ProjectRoot = (
        Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    ),

    [switch]$Enforce
)

# SALONAI_PHASE_7_11_SECRET_AUDIT_VERSION=1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ReportsRoot = Join-Path $ProjectRoot "security-reports\secrets"
$ReportPath = Join-Path $ReportsRoot "production-environment-audit.json"

New-Item -ItemType Directory -Path $ReportsRoot -Force | Out-Null

$RelativeFiles = @(
    ".env.production",
    "backend\.env.production",
    "ai-service\.env.production"
)

$ForbiddenExactValues = @(
    "salonai-production-password",
    "change-me-immediately",
    "changeme",
    "replace-me",
    "replace_me",
    "example-secret",
    "example_secret"
)

$Findings = [System.Collections.Generic.List[object]]::new()
$Files = [System.Collections.Generic.List[object]]::new()

function Add-Finding {
    param(
        [string]$Severity,
        [string]$File,
        [string]$Variable,
        [string]$Control,
        [string]$Message
    )

    $Findings.Add([pscustomobject]@{
        severity = $Severity
        file = $File
        variable = $Variable
        control = $Control
        message = $Message
    })
}

function Get-EnvironmentEntries {
    param([string]$Path)

    $Entries = [System.Collections.Generic.List[object]]::new()

    foreach ($Line in Get-Content -LiteralPath $Path) {
        $Trimmed = $Line.Trim()

        if (
            -not $Trimmed -or
            $Trimmed.StartsWith("#") -or
            $Trimmed -notmatch '^[A-Za-z_][A-Za-z0-9_]*='
        ) {
            continue
        }

        $Parts = $Trimmed.Split('=', 2)
        $Name = $Parts[0].Trim()
        $Value = $Parts[1].Trim().Trim('"').Trim("'")

        $Entries.Add([pscustomobject]@{
            name = $Name
            value = $Value
        })
    }

    return @($Entries)
}

$GitAvailable = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
$GitRoot = Join-Path $ProjectRoot ".git"

foreach ($RelativePath in $RelativeFiles) {
    $Path = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $Path)) {
        Add-Finding "HIGH" $RelativePath "" "required-env-file" `
            "Required production environment file is missing."
        continue
    }

    $Tracked = $false

    if ($GitAvailable -and (Test-Path -LiteralPath $GitRoot)) {
        $global:LASTEXITCODE = 0
        $GitPath = $RelativePath.Replace("\", "/")
        & git -C $ProjectRoot ls-files --error-unmatch -- $GitPath `
            *> $null
        $Tracked = $LASTEXITCODE -eq 0

        if ($Tracked) {
            Add-Finding "CRITICAL" $RelativePath "" "untracked-env-file" `
                "Production environment files must not be tracked by Git."
        }
    }

    $Entries = Get-EnvironmentEntries $Path

    foreach ($Entry in $Entries) {
        $NormalizedValue = $Entry.value.ToLowerInvariant()

        if ($ForbiddenExactValues -contains $NormalizedValue) {
            Add-Finding "CRITICAL" $RelativePath $Entry.name `
                "no-default-secret" `
                "A known default or placeholder secret is configured."
        }

        if (
            $Entry.name -match '(?i)(password|secret|token|private_key|encryption_key)' -and
            $Entry.value.Length -gt 0 -and
            $Entry.value.Length -lt 20
        ) {
            Add-Finding "MEDIUM" $RelativePath $Entry.name `
                "minimum-secret-length" `
                "A sensitive value is shorter than the recommended minimum."
        }
    }

    $Files.Add([pscustomobject]@{
        path = $RelativePath
        exists = $true
        trackedByGit = $Tracked
        variableCount = @($Entries).Count
    })
}

$Critical = @($Findings | Where-Object severity -eq "CRITICAL").Count
$High = @($Findings | Where-Object severity -eq "HIGH").Count
$Medium = @($Findings | Where-Object severity -eq "MEDIUM").Count

$Report = [ordered]@{
    schemaVersion = 1
    phase = "7.11"
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    secretValuesIncluded = $false
    enforcementRequested = [bool]$Enforce
    summary = [ordered]@{
        critical = $Critical
        high = $High
        medium = $Medium
        passed = ($Critical -eq 0 -and $High -eq 0)
    }
    files = @($Files)
    findings = @($Findings)
}

$Report | ConvertTo-Json -Depth 10 | Set-Content `
    -LiteralPath $ReportPath `
    -Encoding utf8

Write-Host ""
Write-Host "SalonAI production secret audit" -ForegroundColor Magenta
Write-Host "Critical findings: $Critical"
Write-Host "High findings: $High"
Write-Host "Advisory findings: $Medium"
Write-Host "Report: $ReportPath" -ForegroundColor DarkGray

if ($Critical -eq 0 -and $High -eq 0) {
    Write-Host "[PASS] Production secret controls passed." -ForegroundColor Green
}
elseif ($Enforce) {
    throw "Production secret controls failed."
}
else {
    Write-Host "[AUDIT] Findings recorded without enforcement." -ForegroundColor Yellow
}
