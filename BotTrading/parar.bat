@echo off
REM Detiene el bot por completo.
echo Deteniendo el bot...
taskkill /F /IM pythonw.exe >nul 2>&1
if %errorlevel%==0 (echo Bot detenido.) else (echo No habia ningun bot en marcha.)
timeout /t 2 /nobreak >nul
