param(
    [switch]$SkipFullTests
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Failures = New-Object System.Collections.Generic.List[string]
$Passed = New-Object System.Collections.Generic.List[string]

function Pass {
    param([string]$Message)

    $Passed.Add($Message)

    Write-Host (
        "[PASS] " +
        $Message
    ) `
        -ForegroundColor Green
}

function Fail {
    param([string]$Message)

    $Failures.Add($Message)

    Write-Host (
        "[FAIL] " +
        $Message
    ) `
        -ForegroundColor Red
}

function Check-File {
    param(
        [string]$RelativePath,
        [string]$Pattern
    )

    $Path = Join-Path `
        $ProjectRoot `
        $RelativePath

    if (
        -not (
            Test-Path $Path
        )
    ) {
        Fail (
            "Missing file: " +
            $RelativePath
        )

        return
    }

    $Content = Get-Content `
        $Path `
        -Raw

    if (
        -not (
            $Content.Contains(
                $Pattern
            )
        )
    ) {
        Fail (
            $RelativePath +
            " missing " +
            $Pattern
        )

        return
    }

    Pass $RelativePath
}

function Run-Step {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host (
        "==> " +
        $Name
    ) `
        -ForegroundColor Cyan

    Push-Location `
        $WorkingDirectory

    try {
        $global:LASTEXITCODE = 0

        & $Command

        $Code = $LASTEXITCODE

        if (
            $null -eq $Code
        ) {
            $Code = 0
        }

        if (
            $Code -eq 0
        ) {
            Pass $Name
        }
        else {
            Fail (
                $Name +
                " exited with code " +
                $Code
            )
        }
    }
    catch {
        Fail (
            $Name +
            " - " +
            $_.Exception.Message
        )
    }
    finally {
        Pop-Location
    }
}

$Checks = @(
    @("backend\src\features\premium\loyalty\LoyaltyAccount.js", "LoyaltyAccount"),
    @("backend\src\features\premium\giftCards\GiftCard.js", "GiftCard"),
    @("backend\src\features\premium\referrals\Referral.js", "Referral"),
    @("backend\src\features\premium\notifications\Notification.js", "Notification"),
    @("backend\src\features\premium\push\PushSubscription.js", "PushSubscription"),
    @("backend\src\features\premium\emailCampaigns\EmailCampaign.js", "EmailCampaign"),
    @("backend\src\features\premium\sms\SmsRule.js", "SmsRule"),
    @("backend\src\features\premium\whatsapp\WhatsAppConversation.js", "WhatsAppConversation"),
    @("backend\src\features\premium\automation\RetentionJourney.js", "RetentionJourney"),
    @("backend\src\features\premium\analytics\premiumAnalyticsController.js", "getPremiumAnalytics"),
    @("frontend\src\services\premiumFeaturesService.js", "getPremiumFeatureData"),
    @("frontend\src\pages\PremiumAnalyticsPage.jsx", "Premium Analytics")
)

foreach (
    $Check in
    $Checks
) {
    Check-File `
        $Check[0] `
        $Check[1]
}

Run-Step `
    -Name "Phase 5 backend model tests" `
    -WorkingDirectory (
        Join-Path `
            $ProjectRoot `
            "backend"
    ) `
    -Command {
        & node.exe `
            --test `
            ".\src\test\premiumModels.test.js"
    }

Run-Step `
    -Name "Frontend production build" `
    -WorkingDirectory (
        Join-Path `
            $ProjectRoot `
            "frontend"
    ) `
    -Command {
        & npm.cmd `
            run `
            build
    }

if (
    -not $SkipFullTests
) {
    Run-Step `
        -Name "Complete backend validation" `
        -WorkingDirectory (
            Join-Path `
                $ProjectRoot `
                "backend"
        ) `
        -Command {
            & npm.cmd `
                run `
                validate
        }
}

Write-Host ""
Write-Host "Verification summary" `
    -ForegroundColor Magenta

Write-Host (
    "Passed: " +
    $Passed.Count
) `
    -ForegroundColor Green

if (
    $Failures.Count -gt 0
) {
    $FailureColour = "Red"
}
else {
    $FailureColour = "Green"
}

Write-Host (
    "Failed: " +
    $Failures.Count
) `
    -ForegroundColor $FailureColour

if (
    $Failures.Count -gt 0
) {
    foreach (
        $Failure in
        $Failures
    ) {
        Write-Host (
            " - " +
            $Failure
        ) `
            -ForegroundColor Red
    }

    exit 1
}

Write-Host (
    "SalonAI Phase 5 verification completed successfully."
) `
    -ForegroundColor Green

exit 0
