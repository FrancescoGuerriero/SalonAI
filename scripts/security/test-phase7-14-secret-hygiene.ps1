param(
    [string]$ProjectRoot = (Resolve-Path ".").Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

$ExampleFiles = @(
    "ai-service\.env.example",
    "backend\.env.example",
    "backend\env.example",
    "config\phase7-14.env.example"
)

$ForbiddenPatterns = @(
    "mongodb\+srv://[^:<\s]+:[^@<\s]+@",
    "JWT_SECRET=[A-Fa-f0-9]{64,}",
    "MONGO_ROOT_PASSWORD=(?!CHANGE_ME)[^\s#]{24,}",
    "GRAFANA_ADMIN_PASSWORD=(?!CHANGE_ME)[^\s#]{24,}",
    "STRIPE_SECRET_KEY=sk_(live|test)_",
    "TWILIO_AUTH_TOKEN=[A-Fa-f0-9]{20,}"
)

$Failures = @()

foreach ($RelativePath in $ExampleFiles) {
    $Path = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        $Failures += "Missing example file: $RelativePath"
        continue
    }

    $Content = Get-Content -LiteralPath $Path -Raw

    foreach ($Pattern in $ForbiddenPatterns) {
        if ($Content -match $Pattern) {
            $Failures += "Potential populated secret in $RelativePath matching $Pattern"
        }
    }
}

$TrackedSecretNames = @(
    & git -C $ProjectRoot ls-files |
        Where-Object {
            $_ -match "(^|/)\.env($|\.)" -and
            $_ -notmatch "\.env\.example$"
        }
)

if ($TrackedSecretNames.Count -gt 0) {
    $Failures += "Tracked environment secret files: $($TrackedSecretNames -join ', ')"
}

if ($Failures.Count -gt 0) {
    $Failures | ForEach-Object {
        Write-Host "[FAIL] $_" -ForegroundColor Red
    }

    exit 1
}

Write-Host "[PASS] Example files use placeholders rather than detected populated secrets." -ForegroundColor Green
Write-Host "[PASS] No non-example .env files are tracked." -ForegroundColor Green
exit 0
