@echo off
title NextStep Platform Launcher
echo ==============================================
echo  Starting NextStep Full-Stack Platform
echo  AI Service (Port 8000) + Web Gateway (Port 3000)
echo ==============================================
echo.
node run_all.js
if %errorlevel% neq 0 (
  echo.
  echo Server exited with an error.
  pause
)
