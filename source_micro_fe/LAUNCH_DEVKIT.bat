@echo off
title Nexus DevKit – MFE Dashboard
color 0B
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   ⚡  NEXUS DEVKIT – Micro Frontend Manager  ║
echo  ║   Dashboard: http://localhost:9000            ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Move to monorepo root (parent of devkit folder)
cd /d "%~dp0"

:: Check Node
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js chua duoc cai dat. Vui long cai Node >= 22
  pause & exit /b 1
)

:: Install devkit deps if needed
if not exist "devkit\node_modules" (
  echo [INFO] Cai dat dependencies cho DevKit...
  cd devkit
  call npm install --silent
  cd ..
)

:: Launch
echo [INFO] Khoi dong Nexus DevKit Dashboard...
echo [INFO] Trinh duyet se tu dong mo tai http://localhost:9000
echo [INFO] Nhan Ctrl+C de dung DevKit va tat tat ca apps
echo.
node devkit\server.js
pause
