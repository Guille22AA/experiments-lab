@echo off
REM Abre el panel en el navegador. Si el bot no esta corriendo, lo arranca.
cd /d "%~dp0"

powershell -NoProfile -Command ^
  "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1',5000); $c.Close(); exit 0 } catch { exit 1 }"

if %errorlevel%==0 (
    start "" "http://127.0.0.1:5000"
) else (
    echo El bot no estaba en marcha. Arrancandolo...
    start "" ".venv\Scripts\pythonw.exe" run.py --silencioso
    timeout /t 4 /nobreak >nul
    start "" "http://127.0.0.1:5000"
)
