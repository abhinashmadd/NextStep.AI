@echo off
echo ========================================================
echo Starting NextStep Backend API (NVIDIA NIM GLM-5.3)
echo ========================================================

REM Check if dedicated virtual environment exists
if exist "C:\Users\absma\.venvs\NextStep\Scripts\python.exe" (
    set "PYTHON_EXE=C:\Users\absma\.venvs\NextStep\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
