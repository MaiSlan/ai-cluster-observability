@echo off
title AI Cluster Observability - Backend Pipeline
echo ========================================================
echo   AI CLUSTER OBSERVABILITY - INFRASTRUCTURE SEEDER
echo ========================================================
echo.

echo [1/3] Navigating to backend directory...
cd backend

echo [2/3] Activating Python Virtual Environment...
call venv\Scripts\activate

echo [3/3] Executing main.py...
echo.
python src\main.py

echo.
echo ========================================================
echo   BACKFILL COMPLETE
echo ========================================================
pause