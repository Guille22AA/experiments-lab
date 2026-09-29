# Registra el bot para que arranque solo al encender el PC.
#
# Se ejecuta una sola vez, desde la carpeta del proyecto:
#     .\instalar-arranque.ps1
#
# No necesita permisos de administrador: la tarea se crea para tu usuario.
# Para deshacerlo:  .\desinstalar-arranque.ps1

$ErrorActionPreference = "Stop"

$nombreTarea = "BotTrading"
$proyecto    = $PSScriptRoot
$pythonw     = Join-Path $proyecto ".venv\Scripts\pythonw.exe"
$script      = Join-Path $proyecto "run.py"

# --- Comprobaciones antes de tocar nada -------------------------------
if (-not (Test-Path $pythonw)) {
    Write-Host "No encuentro el entorno virtual en:" -ForegroundColor Red
    Write-Host "  $pythonw"
    Write-Host ""
    Write-Host "Crealo primero con:  python -m venv .venv"
    exit 1
}
if (-not (Test-Path $script)) {
    Write-Host "No encuentro run.py en $proyecto" -ForegroundColor Red
    exit 1
}

# --- Definicion de la tarea -------------------------------------------
# pythonw.exe en lugar de python.exe: no abre ventana de consola.
$accion = New-ScheduledTaskAction `
    -Execute $pythonw `
    -Argument "`"$script`" --silencioso" `
    -WorkingDirectory $proyecto

# Retardo de 2 minutos: si arranca antes de que haya conexion, la primera
# lectura de precios falla. Con este margen se evita.
$disparador = New-ScheduledTaskTrigger -AtLogOn
$disparador.Delay = "PT2M"

$ajustes = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0)

# --- Registro ----------------------------------------------------------
if (Get-ScheduledTask -TaskName $nombreTarea -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false
    Write-Host "Tarea anterior eliminada."
}

Register-ScheduledTask `
    -TaskName $nombreTarea `
    -Action $accion `
    -Trigger $disparador `
    -Settings $ajustes `
    -Description "Bot de trading simulado. Arranca en segundo plano al iniciar sesion." | Out-Null

Write-Host ""
Write-Host "Listo. El bot arrancara solo al iniciar sesion." -ForegroundColor Green
Write-Host ""
Write-Host "  Panel:      http://127.0.0.1:5000"
Write-Host "  Arranque:   2 minutos despues de iniciar sesion"
Write-Host "  Sin ventana de consola (usa pythonw.exe)"
Write-Host ""
Write-Host "Para probarlo ahora mismo sin reiniciar:"
Write-Host "  Start-ScheduledTask -TaskName $nombreTarea" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para quitarlo:  .\desinstalar-arranque.ps1"
Write-Host ""
