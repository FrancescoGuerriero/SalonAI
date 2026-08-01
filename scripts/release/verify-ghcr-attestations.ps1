param(
    [Parameter(Mandatory)][string]$ReleaseTag,
    [string]$Repository = "FrancescoGuerriero/SalonAI",
    [string]$Owner = "francescoguerriero"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($ReleaseTag -notmatch '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
    throw "ReleaseTag must use vMAJOR.MINOR.PATCH format."
}

if ($null -eq (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI is required. Install it and run gh auth login."
}

$Services = @("backend", "frontend", "ai-service")
$Failed = 0

foreach ($Service in $Services) {
    $Image = "oci://ghcr.io/$Owner/salonai-$Service`:$ReleaseTag"
    Write-Host "`nVerifying $Image" -ForegroundColor Cyan

    gh attestation verify $Image --repo $Repository
    if ($LASTEXITCODE -ne 0) {
        $Failed++
        Write-Host "[FAIL] Provenance attestation: $Service" -ForegroundColor Red
    }
    else {
        Write-Host "[PASS] Provenance attestation: $Service" -ForegroundColor Green
    }

    gh attestation verify `
        $Image `
        --repo $Repository `
        --predicate-type "https://cyclonedx.org/bom"

    if ($LASTEXITCODE -ne 0) {
        $Failed++
        Write-Host "[FAIL] CycloneDX SBOM attestation: $Service" -ForegroundColor Red
    }
    else {
        Write-Host "[PASS] CycloneDX SBOM attestation: $Service" -ForegroundColor Green
    }
}

if ($Failed -gt 0) {
    throw "$Failed attestation verification checks failed."
}

Write-Host "`n[PASS] All SalonAI release attestations verified." -ForegroundColor Green
