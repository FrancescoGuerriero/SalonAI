param(
    [Parameter(Mandatory)][string]$BaseUrl,
    [int]$Attempts = 18,
    [int]$DelaySeconds = 10,
    [string]$EvidencePath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$BaseUrl = $BaseUrl.TrimEnd("/")

if ($BaseUrl -notmatch "^https://") {
    throw "BaseUrl must use HTTPS."
}

if ($PSVersionTable.PSEdition -eq "Desktop") {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

$Checks = @(
    @{ Name = "edge"; Path = "/healthz" },
    @{ Name = "backend"; Path = "/api/health/ready" },
    @{ Name = "ai-service"; Path = "/ai/health" },
    @{ Name = "frontend"; Path = "/" }
)

$Results = @()

foreach ($Check in $Checks) {
    $Uri = "$BaseUrl$($Check.Path)"
    $Passed = $false
    $LastError = $null
    $StatusCode = $null

    for ($Attempt = 1; $Attempt -le $Attempts; $Attempt++) {
        try {
            $Response = Invoke-WebRequest `
                -Uri $Uri `
                -Method Get `
                -TimeoutSec 15 `
                -MaximumRedirection 5 `
                -UseBasicParsing

            $StatusCode = [int]$Response.StatusCode

            if ($StatusCode -ge 200 -and $StatusCode -lt 400) {
                $Passed = $true
                break
            }
        }
        catch {
            $LastError = $_.Exception.Message
        }

        if ($Attempt -lt $Attempts) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    $Results += [pscustomobject]@{
        name = $Check.Name
        uri = $Uri
        passed = $Passed
        statusCode = $StatusCode
        error = $LastError
    }

    if (-not $Passed) {
        if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) {
            $EvidenceDirectory = Split-Path -Parent $EvidencePath

            if (-not [string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
                New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
            }

            [System.IO.File]::WriteAllText(
                $EvidencePath,
                ($Results | ConvertTo-Json -Depth 5),
                [System.Text.UTF8Encoding]::new($false)
            )
        }

        throw "Production smoke test failed for $($Check.Name): $Uri"
    }

    Write-Host "[PASS] $($Check.Name): $Uri" -ForegroundColor Green
}

if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) {
    $EvidenceDirectory = Split-Path -Parent $EvidencePath

    if (-not [string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
        New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $EvidencePath,
        ($Results | ConvertTo-Json -Depth 5),
        [System.Text.UTF8Encoding]::new($false)
    )
}

Write-Host "[PASS] All production smoke tests passed." -ForegroundColor Green
