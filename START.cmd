@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Can cai Node.js 22.12 tro len.
 pause
 exit /b 1
)
if not exist "node_modules\playwright" (
 call npm.cmd ci
 if errorlevel 1 exit /b 1
)
call npm.cmd run build
if errorlevel 1 (
 pause
 exit /b 1
)
call npx.cmd playwright install chromium --only-shell
if errorlevel 1 (
 echo Khong cai duoc browser tim san pham. Kiem tra mang roi chay lai.
 pause
 exit /b 1
)
node scripts/start.mjs
pause
