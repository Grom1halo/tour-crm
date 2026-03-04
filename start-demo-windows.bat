@echo off
echo ================================
echo Tour CRM - Quick Demo with ngrok
echo ================================
echo.

REM Проверка что ngrok установлен
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ngrok not found!
    echo.
    echo Please install ngrok:
    echo 1. Download from https://ngrok.com/download
    echo 2. Extract ngrok.exe
    echo 3. Add to PATH or place in this folder
    echo.
    pause
    exit /b 1
)

echo [1/5] Starting Backend...
cd backend
start "Backend" cmd /k "npm run dev"
echo Waiting for backend to start...
timeout /t 10 /nobreak >nul

echo.
echo [2/5] Starting Frontend...
cd ..\frontend
start "Frontend" cmd /k "npm run dev"
echo Waiting for frontend to start...
timeout /t 10 /nobreak >nul

echo.
echo [3/5] Starting ngrok for Frontend (port 3000)...
start "ngrok Frontend" cmd /k "ngrok http 3000"
timeout /t 3 /nobreak >nul

echo.
echo [4/5] Starting ngrok for Backend (port 3001)...
start "ngrok Backend" cmd /k "ngrok http 3001"
timeout /t 3 /nobreak >nul

echo.
echo ================================
echo READY! All services started
echo ================================
echo.
echo Please do the following:
echo.
echo 1. Check ngrok windows for URLs:
echo    - Frontend URL (port 3000): https://xxxx.ngrok-free.app
echo    - Backend URL (port 3001): https://yyyy.ngrok-free.app
echo.
echo 2. Update frontend\vite.config.ts:
echo    Change proxy target to your Backend URL
echo.
echo 3. Restart Frontend (Ctrl+C and npm run dev)
echo.
echo 4. Send Frontend URL to your client!
echo.
echo To stop: Close all opened windows
echo.
pause
