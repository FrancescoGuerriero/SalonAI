$ErrorActionPreference = "Stop"

$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $serviceRoot

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    py -3.13 -m venv .venv
}

if (-not (Test-Path ".\.env")) {
    Copy-Item ".\.env.example" ".\.env" -Force
    Write-Host "Created ai-service\.env. Replace SERVICE_KEY before production use." -ForegroundColor Yellow
}

& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
