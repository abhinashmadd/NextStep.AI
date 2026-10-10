@echo off
title NextStep Backend Server
echo ==============================================
echo  Starting NextStep Career Preparation Backend
echo ==============================================
echo.
node server.js
if %errorlevel% neq 0 (
  echo.
  echo Server exited with an error.
  pause
)
