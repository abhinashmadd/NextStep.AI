@echo off
echo ========================================================
echo Running NextStep NVIDIA NIM GLM-5.3 Verification Test
echo ========================================================

REM Check if dedicated virtual environment exists
if exist "C:\Users\absma\.venvs\NextStep\Scripts\python.exe" (
    set "PYTHON_EXE=C:\Users\absma\.venvs\NextStep\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" tests\test_nvidia_connection.py
pause
