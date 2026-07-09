@echo off
title AI Cluster Observability Backfill
echo ========================================================
echo   AI CLUSTER OBSERVABILITY - INFRASTRUCTURE SEEDER
echo ========================================================
echo.

echo [1/2] Activating Python Virtual Environment...
call venv\Scripts\activate

echo [2/2] Executing main.py...
echo.
python src\main.py

echo.
echo ========================================================
echo   BACKFILL COMPLETE
echo ========================================================
pause