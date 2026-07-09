@echo off
title AI Cluster Observability - Frontend Server
echo ========================================================
echo   AI CLUSTER OBSERVABILITY - FRONTEND (VITE)
echo ========================================================
echo.

echo [1/2] Navigating to frontend directory...
cd frontend

echo [2/2] Booting Vite Development Server (Cache Busted)...
echo.
call npm run dev -- --force

echo.
echo ========================================================
echo   SERVER TERMINATED
echo ========================================================
pause