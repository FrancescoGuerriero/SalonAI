[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [switch]$RebuildAndEnforce
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

$BackendDockerfile = Join-Path $ProjectRoot "backend\Dockerfile.production"
$FrontendDockerfile = Join-Path $ProjectRoot "frontend\Dockerfile.production"
$AiDockerfile = Join-Path $ProjectRoot "ai-service\Dockerfile"
$ProductionCompose = Join-Path $ProjectRoot "docker-compose.production.yml"
$EnvironmentFile = Join-Path $ProjectRoot ".env.production"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$Description = $FilePath,
        [switch]$EchoOutput,
        [switch]$AllowFailure
    )

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Output = @(& $FilePath @Arguments 2>&1)
        $ExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    if ($EchoOutput) {
        foreach ($Line in $Output) {
            Write-Host "  $Line"
        }
    }

    if (($ExitCode -ne 0) -and (-not $AllowFailure)) {
        $Detail = ($Output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        throw "$Description failed with exit code $ExitCode.`n$Detail"
    }

    return [pscustomobject]@{
        ExitCode = $ExitCode
        Output = $Output
    }
}

function Read-TextLines {
    param([string]$Path)
    return @(Get-Content -LiteralPath $Path)
}

function Write-TextLines {
    param([string]$Path, [System.Collections.IEnumerable]$Lines)
    $Content = (($Lines | ForEach-Object { [string]$_ }) -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function New-StringList {
    param([string[]]$Lines)
    $List = New-Object 'System.Collections.Generic.List[string]'
    foreach ($Line in $Lines) {
        [void]$List.Add([string]$Line)
    }
    return ,$List
}

function Get-LastFromIndex {
    param($Lines)
    $Index = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\s*FROM(?:\s+--platform=\S+)?\s+\S+') {
            $Index = $i
        }
    }
    if ($Index -lt 0) {
        throw "Dockerfile does not contain a FROM instruction."
    }
    return $Index
}

function Set-FinalBaseImage {
    param($Lines, [string]$Image)
    $FromIndex = Get-LastFromIndex -Lines $Lines
    $Current = $Lines[$FromIndex]
    $Match = [regex]::Match(
        $Current,
        '^(?<indent>\s*)FROM(?<platform>\s+--platform=\S+)?\s+\S+(?<suffix>\s+AS\s+\S+)?\s*$',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if (-not $Match.Success) {
        throw "Unable to parse final FROM instruction: $Current"
    }
    $Lines[$FromIndex] = $Match.Groups['indent'].Value + 'FROM' + $Match.Groups['platform'].Value + ' ' + $Image + $Match.Groups['suffix'].Value
    return $FromIndex
}

function Test-FinalStageContains {
    param($Lines, [string]$Pattern)
    $FromIndex = Get-LastFromIndex -Lines $Lines
    for ($i = $FromIndex + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match $Pattern) { return $true }
    }
    return $false
}

function Get-FinalStageInsertionIndex {
    param($Lines)
    $FromIndex = Get-LastFromIndex -Lines $Lines
    for ($i = $FromIndex + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\s*(USER|CMD|ENTRYPOINT)\b') {
            return $i
        }
    }
    return $Lines.Count
}

function Add-AfterFinalFrom {
    param($Lines, [string[]]$NewLines)
    $FromIndex = Get-LastFromIndex -Lines $Lines
    $InsertIndex = $FromIndex + 1
    for ($i = $NewLines.Count - 1; $i -ge 0; $i--) {
        $Lines.Insert($InsertIndex, $NewLines[$i])
    }
}

function Add-BeforeRuntimeDirective {
    param($Lines, [string[]]$NewLines)
    $InsertIndex = Get-FinalStageInsertionIndex -Lines $Lines
    for ($i = $NewLines.Count - 1; $i -ge 0; $i--) {
        $Lines.Insert($InsertIndex, $NewLines[$i])
    }
}

function Update-BackendDockerfile {
    param([string]$Path)
    $Lines = New-StringList -Lines (Read-TextLines -Path $Path)
    [void](Set-FinalBaseImage -Lines $Lines -Image "node:22.23.1-alpine3.24")

    if (-not (Test-FinalStageContains -Lines $Lines -Pattern 'SALONAI_PHASE_7_11_BACKEND_RUNTIME_HARDENING')) {
        Add-AfterFinalFrom -Lines $Lines -NewLines @(
            "# SALONAI_PHASE_7_11_BACKEND_RUNTIME_HARDENING=2",
            "RUN apk upgrade --no-cache"
        )
    }

    if (-not (Test-FinalStageContains -Lines $Lines -Pattern '/usr/local/lib/node_modules/npm')) {
        Add-BeforeRuntimeDirective -Lines $Lines -NewLines @(
            "# npm is required during build, but not by the running API.",
            "RUN rm -rf /usr/local/lib/node_modules/npm && rm -f /usr/local/bin/npm /usr/local/bin/npx"
        )
    }

    Write-TextLines -Path $Path -Lines $Lines
}

function Update-FrontendDockerfile {
    param([string]$Path)
    $Lines = New-StringList -Lines (Read-TextLines -Path $Path)
    [void](Set-FinalBaseImage -Lines $Lines -Image "nginx:1.30.4-alpine3.24")

    if (-not (Test-FinalStageContains -Lines $Lines -Pattern 'SALONAI_PHASE_7_11_FRONTEND_RUNTIME_HARDENING')) {
        Add-AfterFinalFrom -Lines $Lines -NewLines @(
            "# SALONAI_PHASE_7_11_FRONTEND_RUNTIME_HARDENING=2",
            "RUN apk upgrade --no-cache"
        )
    }

    Write-TextLines -Path $Path -Lines $Lines
}

function Update-AiDevelopmentDockerfile {
    param([string]$Path)
    $Lines = New-StringList -Lines (Read-TextLines -Path $Path)

    if (Test-FinalStageContains -Lines $Lines -Pattern '^\s*USER\s+(?!0(?:\s|$)|root(?:\s|$))') {
        return
    }

    $WorkDirectory = "/app"
    $FromIndex = Get-LastFromIndex -Lines $Lines
    for ($i = $FromIndex + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\s*WORKDIR\s+(?<path>\S+)') {
            $Candidate = $Matches['path'].Trim('"', "'")
            if ($Candidate.StartsWith('/')) {
                $WorkDirectory = $Candidate
            }
        }
    }

    Add-BeforeRuntimeDirective -Lines $Lines -NewLines @(
        "# SALONAI_PHASE_7_11_AI_NONROOT_HARDENING=2",
        "RUN mkdir -p $WorkDirectory /tmp && chown -R 10001:10001 $WorkDirectory /tmp",
        "ENV HOME=/tmp",
        "USER 10001:10001"
    )

    Write-TextLines -Path $Path -Lines $Lines
}

function Wait-ForComposeService {
    param([string]$Service, [int]$TimeoutSeconds = 120)

    $ComposeArgs = @(
        "compose", "--env-file", $EnvironmentFile,
        "-f", $ProductionCompose,
        "ps", "-q", $Service
    )
    $ContainerResult = Invoke-NativeCommand -FilePath "docker" -Arguments $ComposeArgs -Description "Resolving $Service container"
    $ContainerId = (($ContainerResult.Output | ForEach-Object { [string]$_ }) -join "").Trim()
    if (-not $ContainerId) {
        throw "Docker Compose did not return a container for service $Service."
    }

    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $InspectResult = Invoke-NativeCommand `
            -FilePath "docker" `
            -Arguments @("inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", $ContainerId) `
            -Description "Inspecting $Service container" `
            -AllowFailure

        $Status = (($InspectResult.Output | ForEach-Object { [string]$_ }) -join "").Trim()
        if ($Status -in @("healthy", "running")) {
            Write-Host "[PASS] $Service is $Status." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $Deadline)

    throw "$Service did not become healthy within $TimeoutSeconds seconds."
}

foreach ($Path in @($BackendDockerfile, $FrontendDockerfile, $AiDockerfile, $ProductionCompose)) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required project file is missing: $Path"
    }
}
if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
    throw "Production environment file is missing: $EnvironmentFile"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "backups\phase7-11-security-remediation-$Timestamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

Write-Host ""
Write-Host "SalonAI Phase 7.11 security remediation" -ForegroundColor White
Write-Host "Project: $ProjectRoot"

Write-Step "Backing up affected application files"
$FilesToBackup = @(
    "backend\Dockerfile.production",
    "frontend\Dockerfile.production",
    "ai-service\Dockerfile"
)
foreach ($RelativePath in $FilesToBackup) {
    $Source = Join-Path $ProjectRoot $RelativePath
    $Destination = Join-Path $BackupRoot $RelativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    Write-Host "[BACKUP] $RelativePath" -ForegroundColor DarkYellow
}

Write-Step "Hardening backend production image"
Update-BackendDockerfile -Path $BackendDockerfile
Write-Host "[UPDATED] backend\Dockerfile.production" -ForegroundColor Green

Write-Step "Hardening frontend production image"
Update-FrontendDockerfile -Path $FrontendDockerfile
Write-Host "[UPDATED] frontend\Dockerfile.production" -ForegroundColor Green

Write-Step "Making AI development image non-root"
Update-AiDevelopmentDockerfile -Path $AiDockerfile
Write-Host "[UPDATED] ai-service\Dockerfile" -ForegroundColor Green

Write-Host ""
Write-Host "[PASS] Source hardening applied." -ForegroundColor Green
Write-Host "Rollback backup: $BackupRoot"

if ($RebuildAndEnforce) {
    Write-Step "Validating production Docker Compose"
    Invoke-NativeCommand `
        -FilePath "docker" `
        -Arguments @("compose", "--env-file", $EnvironmentFile, "-f", $ProductionCompose, "config", "--quiet") `
        -Description "Production Docker Compose validation" | Out-Null
    Write-Host "[PASS] Production Docker Compose configuration" -ForegroundColor Green

    Write-Step "Rebuilding hardened backend and frontend images"
    Invoke-NativeCommand `
        -FilePath "docker" `
        -Arguments @("compose", "--env-file", $EnvironmentFile, "-f", $ProductionCompose, "build", "--pull", "backend", "frontend") `
        -Description "Hardened production image build" `
        -EchoOutput | Out-Null

    Write-Step "Recreating backend and frontend containers"
    Invoke-NativeCommand `
        -FilePath "docker" `
        -Arguments @("compose", "--env-file", $EnvironmentFile, "-f", $ProductionCompose, "up", "-d", "--no-deps", "backend", "frontend") `
        -Description "Hardened service deployment" `
        -EchoOutput | Out-Null

    Write-Step "Waiting for hardened services"
    Wait-ForComposeService -Service "backend" -TimeoutSeconds 150
    Wait-ForComposeService -Service "frontend" -TimeoutSeconds 150

    Write-Step "Running Phase 7.11 remediation verification"
    $Verifier = Join-Path $ProjectRoot "scripts\security\verify-phase7-11-remediation.ps1"
    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $Verifier `
        -ProjectRoot $ProjectRoot `
        -RunEnforcedGate

    if ($LASTEXITCODE -ne 0) {
        throw "Phase 7.11 remediation verification failed with exit code $LASTEXITCODE."
    }
}
