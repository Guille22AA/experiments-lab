# Quita el arranque automatico. El bot sigue funcionando a mano.
#     .\desinstalar-arranque.ps1

$nombreTarea = "BotTrading"

if (Get-ScheduledTask -TaskName $nombreTarea -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask  -TaskName $nombreTarea -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false
    Write-Host "Arranque automatico eliminado." -ForegroundColor Green
} else {
    Write-Host "No habia ninguna tarea registrada."
}

Write-Host ""
Write-Host "Ojo: si el bot esta corriendo ahora, sigue corriendo."
Write-Host "Para pararlo del todo:"
Write-Host "  Get-Process pythonw -ErrorAction SilentlyContinue | Stop-Process" -ForegroundColor Cyan
Write-Host ""
