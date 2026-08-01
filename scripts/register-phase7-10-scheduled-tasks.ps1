param(
    [string]$ProjectRoot = (
        Split-Path $PSScriptRoot -Parent
    ),

    [Parameter(Mandatory)]
    [string]$MirrorDestination,

    [string]$MirrorTime = "03:00",

    [ValidateSet(
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    )]
    [string]$DrillDay = "Sunday",

    [string]$DrillTime = "04:00"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$MirrorDestination = [System.IO.Path]::GetFullPath(
    $MirrorDestination
)

$PowerShellPath = (
    Get-Command powershell.exe -ErrorAction Stop
).Source

$MirrorScript = Join-Path `
    $ProjectRoot `
    "scripts\mirror-mongodb-backups.ps1"

$DrillScript = Join-Path `
    $ProjectRoot `
    "scripts\run-disaster-recovery-drill.ps1"

foreach ($Path in @($MirrorScript, $DrillScript)) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Scheduled-task script was not found: $Path"
    }
}

New-Item `
    -ItemType Directory `
    -Path $MirrorDestination `
    -Force |
    Out-Null

$MirrorAt = [DateTime]::ParseExact(
    $MirrorTime,
    "HH:mm",
    [Globalization.CultureInfo]::InvariantCulture
)

$DrillAt = [DateTime]::ParseExact(
    $DrillTime,
    "HH:mm",
    [Globalization.CultureInfo]::InvariantCulture
)

$MirrorArguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ('"{0}"' -f $MirrorScript),
    "-ProjectRoot", ('"{0}"' -f $ProjectRoot),
    "-Destination", ('"{0}"' -f $MirrorDestination)
) -join " "

$DrillArguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ('"{0}"' -f $DrillScript),
    "-ProjectRoot", ('"{0}"' -f $ProjectRoot)
) -join " "

$MirrorAction = New-ScheduledTaskAction `
    -Execute $PowerShellPath `
    -Argument $MirrorArguments

$MirrorTrigger = New-ScheduledTaskTrigger `
    -Daily `
    -At $MirrorAt

$DrillAction = New-ScheduledTaskAction `
    -Execute $PowerShellPath `
    -Argument $DrillArguments

$DrillTrigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek $DrillDay `
    -At $DrillAt

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Register-ScheduledTask `
    -TaskName "SalonAI-Backup-Mirror" `
    -Action $MirrorAction `
    -Trigger $MirrorTrigger `
    -Settings $Settings `
    -Description "Mirror verified SalonAI MongoDB backups to off-host storage." `
    -Force |
    Out-Null

Register-ScheduledTask `
    -TaskName "SalonAI-Weekly-Restore-Drill" `
    -Action $DrillAction `
    -Trigger $DrillTrigger `
    -Settings $Settings `
    -Description "Create and test a SalonAI MongoDB backup in an isolated container." `
    -Force |
    Out-Null

Write-Host ""
Write-Host "[PASS] Phase 7.10 scheduled tasks registered." -ForegroundColor Green
Write-Host "Mirror task: daily at $MirrorTime" -ForegroundColor DarkGray
Write-Host "Restore drill: $DrillDay at $DrillTime" -ForegroundColor DarkGray
Write-Host "Mirror destination: $MirrorDestination" -ForegroundColor DarkGray
