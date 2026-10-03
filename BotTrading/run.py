"""
Punto de entrada. Arranca el bot y el panel web.

    python run.py               arranca y abre el navegador
    python run.py --silencioso  arranca sin abrir nada (para el autoarranque)

Cerrar el navegador NO detiene el bot: el bot vive en este proceso.
Para pararlo del todo, cierra esta ventana o usa el botón del panel.
"""
import socket
import sys
import threading
import webbrowser

import bot
import config
import licencias
import server
import storage


def ya_esta_corriendo():
    """
    Comprueba si el puerto ya está ocupado. Evita que se arranquen dos
    copias a la vez, que es fácil que pase entre el autoarranque de Windows
    y un lanzamiento a mano: dos bots operando sobre el mismo estado.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((config.HOST, config.PUERTO)) == 0


def main():
    silencioso = "--silencioso" in sys.argv
    log = storage.configurar_logs()

    url = f"http://{config.HOST}:{config.PUERTO}"

    ok, motivo = licencias.comprobar()
    if not ok:
        log.error("No se arranca: %s", motivo)
        if not silencioso:
            print(f"\nNo se puede arrancar: {motivo}\n")
        return

    if ya_esta_corriendo():
        log.warning("Ya hay una copia del bot en marcha. No se arranca otra.")
        if not silencioso:
            print(f"\nEl bot ya estaba funcionando. El panel está en {url}\n")
            webbrowser.open(url)
        return

    storage.preparar_carpetas()
    storage.preparar_bd()
    storage.guardar_estado(storage.cargar_estado())

    log.info("Datos en: %s", config.DATA_DIR)
    bot.arrancar_en_segundo_plano()
    log.info("Panel disponible en %s", url)

    if not silencioso:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    try:
        server.app.run(host=config.HOST, port=config.PUERTO,
                       debug=False, use_reloader=False)
    finally:
        bot.detener()


if __name__ == "__main__":
    main()
