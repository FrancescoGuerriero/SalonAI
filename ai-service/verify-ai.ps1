$ErrorActionPreference = "Stop"

$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $serviceRoot

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    py -3.13 -m venv .venv
}

& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
& ".\.venv\Scripts\python.exe" -m pytest

if ($LASTEXITCODE -ne 0) {
    throw "SalonAI AI-service tests failed."
}

Write-Host "SalonAI AI-service validation passed." -ForegroundColor Green
