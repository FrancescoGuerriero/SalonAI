
param(
    [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [switch]$SkipDockerBuild
)

# SALONAI_PHASE_7_12_BRACE_PATCH_COMPATIBILITY_WRAPPER_VERSION=8
$ErrorActionPreference = "Stop"
Write-Warning "The v7 brace-expansion patch was retired after the release report identified tmp@0.2.6 as the actual unapproved finding. Delegating to the Phase 7.12 tmp patch."
& (Join-Path $PSScriptRoot "apply-phase7-12-tmp-patch.ps1") -ProjectRoot $ProjectRoot -SkipDockerBuild:$SkipDockerBuild
return
