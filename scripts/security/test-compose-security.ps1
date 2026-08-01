param(
    [string]$ProjectRoot = (
        Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    ),

    [switch]$Enforce
)

# SALONAI_PHASE_7_11_COMPOSE_AUDIT_VERSION=1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ReportsRoot = Join-Path $ProjectRoot "security-reports\compose"
$ReportPath = Join-Path $ReportsRoot "compose-security.json"

New-Item -ItemType Directory -Path $ReportsRoot -Force | Out-Null

$EnvironmentFile = Join-Path $ProjectRoot ".env.production"
$ComposeFiles = @(
    (Join-Path $ProjectRoot "docker-compose.production.yml"),
    (Join-Path $ProjectRoot "docker-compose.observability.yml"),
    (Join-Path $ProjectRoot "docker-compose.resilience.yml")
)

foreach ($Path in @($EnvironmentFile) + $ComposeFiles) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required deployment file was not found: $Path"
    }
}

function Get-PropertyValue {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }

    $Property = $Object.PSObject.Properties[$Name]

    if ($null -eq $Property) {
        return $null
    }

    return $Property.Value
}

$ErrorFile = Join-Path $env:TEMP (
    "salonai-compose-security-{0}.err" -f [guid]::NewGuid().ToString("N")
)

try {
    $Arguments = @(
        "compose",
        "--env-file", $EnvironmentFile
    )

    foreach ($ComposeFile in $ComposeFiles) {
        $Arguments += @("-f", $ComposeFile)
    }

    $Arguments += @("config", "--format", "json")

    $global:LASTEXITCODE = 0
    $JsonOutput = & docker @Arguments 2>$ErrorFile
    $ExitCode = $LASTEXITCODE

    if ($ExitCode -ne 0) {
        $ErrorText = ""

        if (Test-Path -LiteralPath $ErrorFile) {
            $ErrorText = Get-Content -LiteralPath $ErrorFile -Raw
        }

        throw "Docker Compose configuration failed: $ErrorText"
    }

    $Config = (($JsonOutput | Out-String).Trim()) | ConvertFrom-Json
}
finally {
    Remove-Item -LiteralPath $ErrorFile -Force -ErrorAction SilentlyContinue
}

$Findings = [System.Collections.Generic.List[object]]::new()

function Add-Finding {
    param(
        [string]$Severity,
        [string]$Service,
        [string]$Control,
        [string]$Message
    )

    $Findings.Add([pscustomobject]@{
        severity = $Severity
        service = $Service
        control = $Control
        message = $Message
    })
}

$Services = Get-PropertyValue $Config "services"

if ($null -eq $Services) {
    throw "Docker Compose JSON did not contain services."
}

$RestrictedPublishedServices = @(
    "mongo",
    "backend",
    "ai-service",
    "frontend",
    "mongo-backup"
)

foreach ($ServiceProperty in $Services.PSObject.Properties) {
    $ServiceName = $ServiceProperty.Name
    $Service = $ServiceProperty.Value

    if ((Get-PropertyValue $Service "privileged") -eq $true) {
        Add-Finding "CRITICAL" $ServiceName "no-privileged" `
            "Privileged containers are prohibited."
    }

    if ((Get-PropertyValue $Service "network_mode") -eq "host") {
        Add-Finding "CRITICAL" $ServiceName "no-host-network" `
            "Host network mode is prohibited."
    }

    if ((Get-PropertyValue $Service "pid") -eq "host") {
        Add-Finding "CRITICAL" $ServiceName "no-host-pid" `
            "Host PID namespace is prohibited."
    }

    $CapAdd = @(Get-PropertyValue $Service "cap_add")

    if ($CapAdd.Count -gt 0 -and $null -ne $CapAdd[0]) {
        Add-Finding "HIGH" $ServiceName "no-capability-add" `
            "Added Linux capabilities require explicit review."
    }

    $Image = [string](Get-PropertyValue $Service "image")

    if ($Image -match '(?i):latest$') {
        Add-Finding "HIGH" $ServiceName "pinned-image" `
            "Container images must not use the latest tag."
    }

    $SecurityOptions = @(
        Get-PropertyValue $Service "security_opt"
    ) | ForEach-Object { [string]$_ }

    if (
        -not (
            $SecurityOptions -contains "no-new-privileges:true"
        )
    ) {
        Add-Finding "HIGH" $ServiceName "no-new-privileges" `
            "The service does not enable no-new-privileges."
    }

    $Ports = @(Get-PropertyValue $Service "ports")

    if (
        $RestrictedPublishedServices -contains $ServiceName -and
        $Ports.Count -gt 0 -and
        $null -ne $Ports[0]
    ) {
        Add-Finding "CRITICAL" $ServiceName "internal-service-ports" `
            "Internal services must not publish host ports."
    }

    foreach ($Port in $Ports) {
        if ($null -eq $Port) {
            continue
        }

        $HostIp = [string](Get-PropertyValue $Port "host_ip")

        if (
            $ServiceName -ne "edge" -and
            $HostIp -and
            $HostIp -notin @("127.0.0.1", "::1")
        ) {
            Add-Finding "HIGH" $ServiceName "loopback-observability" `
                "Non-edge published ports must bind to loopback."
        }
    }

    $Volumes = @(Get-PropertyValue $Service "volumes")

    foreach ($Volume in $Volumes) {
        if ($null -eq $Volume) {
            continue
        }

        $Source = [string](Get-PropertyValue $Volume "source")
        $Target = [string](Get-PropertyValue $Volume "target")
        $ReadOnly = Get-PropertyValue $Volume "read_only"

        if ($Source -eq "/") {
            Add-Finding "CRITICAL" $ServiceName "no-host-root-mount" `
                "Mounting the host root filesystem is prohibited."
        }

        if ($Source -eq "/var/run/docker.sock") {
            if ($ServiceName -ne "alloy" -or $ReadOnly -ne $true) {
                Add-Finding "CRITICAL" $ServiceName "docker-socket" `
                    "Docker socket access is only approved for Alloy as read-only."
            }
        }

        if (
            $Target -eq "/var/run/docker.sock" -and
            $ReadOnly -ne $true
        ) {
            Add-Finding "CRITICAL" $ServiceName "docker-socket-read-only" `
                "Docker socket mounts must be read-only."
        }
    }
}

$Critical = @($Findings | Where-Object severity -eq "CRITICAL").Count
$High = @($Findings | Where-Object severity -eq "HIGH").Count

$Report = [ordered]@{
    schemaVersion = 1
    phase = "7.11"
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    enforcementRequested = [bool]$Enforce
    summary = [ordered]@{
        services = @($Services.PSObject.Properties).Count
        critical = $Critical
        high = $High
        passed = ($Critical -eq 0 -and $High -eq 0)
    }
    findings = @($Findings)
}

$Report | ConvertTo-Json -Depth 10 | Set-Content `
    -LiteralPath $ReportPath `
    -Encoding utf8

Write-Host ""
Write-Host "SalonAI Docker Compose security audit" -ForegroundColor Magenta
Write-Host "Services: $($Report.summary.services)"
Write-Host "Critical findings: $Critical"
Write-Host "High findings: $High"
Write-Host "Report: $ReportPath" -ForegroundColor DarkGray

if ($Critical -eq 0 -and $High -eq 0) {
    Write-Host "[PASS] Docker Compose security policy passed." -ForegroundColor Green
}
else {
    foreach ($Finding in $Findings) {
        Write-Host (
            "[{0}] {1}: {2}" -f `
                $Finding.severity,
                $Finding.service,
                $Finding.message
        ) -ForegroundColor Yellow
    }

    if ($Enforce) {
        throw "Docker Compose security policy failed."
    }

    Write-Host "[AUDIT] Findings recorded without enforcement." -ForegroundColor Yellow
}
