# GlycoTwin — Local Startup Script (Frontend + Backend)
# Run from repository root: .\run_local.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   GlycoTwin: Starting Backend & Frontend Locally         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Kill any existing instances on port 8000 or 8081 if running
$p8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$p8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($p8000) {
    Write-Host "Re-starting port 8000 process (PID $p8000)..." -ForegroundColor Yellow
    Stop-Process -Id $p8000 -Force -ErrorAction SilentlyContinue
}
if ($p8081) {
    Write-Host "Re-starting port 8081 process (PID $p8081)..." -ForegroundColor Yellow
    Stop-Process -Id $p8081 -Force -ErrorAction SilentlyContinue
}

# 2. Launch FastAPI Backend on port 8000 in a new PowerShell window
Write-Host "`n[1/3] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '--- GlycoTwin FastAPI Backend (Port 8000) ---' -ForegroundColor Green; uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app"

# 3. Launch Expo Mobile/Web Frontend on port 8081 in a new PowerShell window
Write-Host "[2/3] Starting Expo Mobile/Web Frontend on http://localhost:8081..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; Write-Host '--- GlycoTwin Expo Frontend (Port 8081) ---' -ForegroundColor Cyan; pnpm --filter @glycotwin/mobile start --web --port 8081"

# 4. Wait briefly and open app in dedicated smartphone App Mode window
Start-Sleep -Seconds 5
Write-Host "[3/3] Opening GlycoTwin in Smartphone Viewport (410x880)..." -ForegroundColor Green

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (Test-Path $edgePath) {
    Start-Process $edgePath -ArgumentList "--app=http://localhost:8081", "--window-size=410,880"
} elseif (Test-Path $chromePath) {
    Start-Process $chromePath -ArgumentList "--app=http://localhost:8081", "--window-size=410,880"
} else {
    Start-Process "http://localhost:8081"
}

Write-Host "`nGlycoTwin is running!" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:8081" -ForegroundColor White
Write-Host "Backend API & Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "Test Login: waqas.fyp@glycotwin.pk / Password123!" -ForegroundColor Yellow
