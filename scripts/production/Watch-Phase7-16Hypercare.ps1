param(
    [Parameter(Mandatory)][string]$BaseUrl,
    [int]$Samples = 6,
    [int]$IntervalSeconds = 30,
    [string]$EvidencePath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($Samples -lt 1 -or $Samples -gt 120) {
    throw "Samples must be between 1 and 120."
}

if ($IntervalSeconds -lt 0 -or $IntervalSeconds -gt 3600) {
    throw "IntervalSeconds must be between 0 and 3600."
}

$BaseUrl = $BaseUrl.TrimEnd("/")
if ($BaseUrl -notmatch "^https://") {
    throw "BaseUrl must use HTTPS."
}

if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $EvidencePath = Join-Path (Resolve-Path ".").Path "deployment-evidence\phase7-16\hypercare.json"
}

$EvidenceDirectory = Split-Path -Parent $EvidencePath
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

$Endpoints = @(
    @{ name = "edge"; path = "/healthz" },
    @{ name = "backend"; path = "/api/health/ready" },
    @{ name = "ai-service"; path = "/ai/health" },
    @{ name = "frontend"; path = "/" }
)

$SamplesEvidence = New-Object System.Collections.Generic.List[object]
$AllPassed = $true

for ($SampleNumber = 1; $SampleNumber -le $Samples; $SampleNumber++) {
    $EndpointResults = New-Object System.Collections.Generic.List[object]

    foreach ($Endpoint in $Endpoints) {
        $Uri = "$BaseUrl$($Endpoint.path)"
        $Passed = $false
        $StatusCode = $null
        $ErrorMessage = $null
        $DurationMilliseconds = $null
        $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        try {
            $Response = Invoke-WebRequest `
                -Uri $Uri `
                -Method Get `
                -TimeoutSec 20 `
                -MaximumRedirection 5 `
                -UseBasicParsing

            $Stopwatch.Stop()
            $DurationMilliseconds = $Stopwatch.ElapsedMilliseconds
            $StatusCode = [int]$Response.StatusCode
            $Passed = ($StatusCode -ge 200 -and $StatusCode -lt 400)
        }
        catch {
            $Stopwatch.Stop()
            $DurationMilliseconds = $Stopwatch.ElapsedMilliseconds
            $ErrorMessage = $_.Exception.Message
        }

        if (-not $Passed) {
            $AllPassed = $false
        }

        $EndpointResults.Add([pscustomobject]@{
            name = $Endpoint.name
            uri = $Uri
            passed = $Passed
            statusCode = $StatusCode
            durationMilliseconds = $DurationMilliseconds
            error = $ErrorMessage
        })
    }

    $SamplesEvidence.Add([pscustomobject]@{
        sample = $SampleNumber
        capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        endpoints = $EndpointResults
    })

    if ($SampleNumber -lt $Samples -and $IntervalSeconds -gt 0) {
        Start-Sleep -Seconds $IntervalSeconds
    }
}

$Evidence = [ordered]@{
    schemaVersion = 1
    phase = "7.16"
    baseUrl = $BaseUrl
    samplesRequested = $Samples
    intervalSeconds = $IntervalSeconds
    passed = $AllPassed
    completedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    samples = $SamplesEvidence
}

[System.IO.File]::WriteAllText(
    $EvidencePath,
    (($Evidence | ConvertTo-Json -Depth 10) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
)

if (-not $AllPassed) {
    throw "One or more Phase 7.16 hypercare checks failed."
}

Write-Host "[PASS] Phase 7.16 hypercare checks passed." -ForegroundColor Green
Write-Host "Evidence: $EvidencePath"
