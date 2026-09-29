"""
El bucle del bot.

Paso 1: consulta precios, guarda estado y saldos. Todavía no compra ni vende.
Vive en su propio hilo, así que cerrar la ventana del navegador no lo detiene.
"""
import threading
import time
import logging

import config
import prices
import scanner
import storage
import strategy

log = logging.getLogger("bot")

# Bloqueo para que el hilo del bot y el servidor web no escriban a la vez.
candado = threading.Lock()
_parar = threading.Event()

# Pausa en memoria. Se consulta al instante, sin esperar al cerrojo: si el
# bot está en mitad de un escaneo, el cerrojo puede tardar casi un minuto en
# soltarse, y el botón del panel se quedaría colgado hasta entonces.
_pausa = threading.Event()


def esta_activo():
    return not _pausa.is_set()


def poner_activo(valor):
    """Surte efecto inmediatamente. La persistencia va aparte."""
    if valor:
        _pausa.clear()
    else:
        _pausa.set()
    _despertar.set()


# Permite cortar la espera entre ciclos al reanudar, en vez de tener que
# aguantar los 5 minutos completos.
_despertar = threading.Event()


def valor_wallet(estado, wallet):
    """
    Valor total de una wallet = efectivo + valor de mercado de sus posiciones.
    En el paso 1 no hay posiciones, así que es solo el efectivo.
    """
    datos = estado["wallets"][wallet]
    total = sum(datos["efectivo"].values())
    valor_seguro = datos["efectivo"]["seguro"]
    valor_loteria = datos["efectivo"]["loteria"]

    for posicion in datos["posiciones"]:
        precio = estado["precios"].get(posicion["simbolo"], {}).get("precio")
        if precio is None:
            precio = posicion["precio_entrada"]
        valor = posicion["cantidad"] * precio
        total += valor
        if posicion["cubo"] == "loteria":
            valor_loteria += valor
        else:
            valor_seguro += valor

    return total, valor_seguro, valor_loteria


def actualizar_precios_loteria(estado):
    """
    Las posiciones del cubo lotería no salen de la lista fija de config,
    así que hay que pedir su precio aparte. Si no, no se sabría cuándo salir.
    """
    ids_cripto, tickers_broker = [], []
    for wallet, datos in estado["wallets"].items():
        for p in datos["posiciones"]:
            if p["cubo"] != "loteria":
                continue
            destino = ids_cripto if wallet == "crypto" else tickers_broker
            destino.append(p.get("id_fuente", p["simbolo"]))

    if ids_cripto:
        try:
            precios_por_id = scanner.precios_cripto_por_id(ids_cripto)
            for wallet, datos in estado["wallets"].items():
                for p in datos["posiciones"]:
                    valor = precios_por_id.get(p.get("id_fuente"))
                    if valor:
                        estado["precios"][p["simbolo"]] = {
                            "precio": valor, "wallet": "crypto", "ts": storage.ahora()}
        except Exception as e:
            log.warning("No se pudieron valorar posiciones de cripto: %s", e)

    if tickers_broker:
        try:
            cambio = prices._cambio_eur_usd()
            precios_ticker = scanner.precios_broker_por_id(tickers_broker, cambio)
            for simbolo, valor in precios_ticker.items():
                estado["precios"][simbolo] = {
                    "precio": valor, "wallet": "broker", "ts": storage.ahora()}
        except Exception as e:
            log.warning("No se pudieron valorar posiciones de bróker: %s", e)


def toca_escanear(estado):
    """
    Los filtros de entrada usan el cambio de 24 h, un dato que apenas se
    mueve en cinco minutos. Escanear en cada ciclo no aporta información,
    solo da más ocasiones de entrar y de pagar comisiones.
    """
    ultimo = estado.get("ultimo_escaneo")
    if not ultimo:
        return True
    from datetime import datetime, timezone
    transcurrido = (datetime.now(timezone.utc)
                    - datetime.fromisoformat(ultimo)).total_seconds()
    return transcurrido >= config.ESCANEO_CADA_SEGUNDOS


def buscar_candidatos(estado):
    """Escanea el mercado buscando candidatos para el cubo lotería."""
    resultado = {"crypto": [], "broker": []}
    if not toca_escanear(estado):
        return resultado
    estado["ultimo_escaneo"] = storage.ahora()

    try:
        resultado["crypto"] = scanner.candidatos_cripto()
        log.info("Escaneo cripto: %d candidatos pasan los filtros.",
                 len(resultado["crypto"]))
    except Exception as e:
        log.warning("Fallo escaneando cripto: %s", e)

    if strategy.mercado_abierto("broker"):
        try:
            cambio = prices._cambio_eur_usd()
            resultado["broker"] = scanner.candidatos_broker(cambio)
            log.info("Escaneo bróker: %d candidatos pasan los filtros.",
                     len(resultado["broker"]))
        except Exception as e:
            log.warning("Fallo escaneando bróker: %s", e)

    return resultado


def un_ciclo(estado):
    """Una vuelta completa: leer precios, actualizar estado, guardar."""
    lecturas, errores = prices.leer_todos()

    for wallet, precios_wallet in lecturas.items():
        for simbolo, precio in precios_wallet.items():
            estado["precios"][simbolo] = {
                "precio": precio,
                "wallet": wallet,
                "ts": storage.ahora(),
            }
            storage.registrar_precio(wallet, simbolo, precio, config.MONEDA)

    estado["ultima_consulta"] = storage.ahora()
    estado["ultimo_error"] = "; ".join(errores) if errores else None
    estado["bot_activo"] = esta_activo()

    # Si han pulsado pausa mientras se leían precios, no se opera:
    # se guardan los datos y se para aquí.
    if not esta_activo():
        storage.guardar_estado(estado)
        log.info("Pausado durante el ciclo. No se ha operado.")
        return

    # Valorar las posiciones del cubo lotería, que no están en la lista fija.
    actualizar_precios_loteria(estado)

    # Buscar candidatos nuevos para el cubo lotería.
    candidatos = buscar_candidatos(estado)

    # Con los precios ya actualizados, la estrategia decide y opera.
    for wallet in estado["wallets"]:
        try:
            strategy.ejecutar(estado, wallet, candidatos.get(wallet))
        except Exception as e:
            log.exception("[%s] Fallo ejecutando la estrategia: %s", wallet, e)

    for wallet in estado["wallets"]:
        total, seguro, loteria = valor_wallet(estado, wallet)
        storage.registrar_saldo(
            wallet, total, seguro, loteria,
            sum(estado["wallets"][wallet]["efectivo"].values()),
            estado["wallets"][wallet]["aportado"],
            strategy.valor_referencia(estado, wallet),
        )

    storage.guardar_estado(estado)
    storage.copia_diaria(estado)

    leidos = sum(len(v) for v in lecturas.values())
    log.info("Ciclo completado. %d precios leídos.", leidos)


def bucle():
    log.info("Bot arrancado. Intervalo: %d s", config.INTERVALO_SEGUNDOS)

    # Al arrancar se respeta cómo se dejó la última vez.
    if not storage.cargar_estado().get("bot_activo", True):
        _pausa.set()
        log.info("El bot estaba en pausa la última vez. Sigue en pausa.")

    while not _parar.is_set():
        try:
            if esta_activo():
                with candado:
                    un_ciclo(storage.cargar_estado())
            else:
                log.debug("En pausa, no se consulta nada.")
        except Exception as e:
            log.exception("Error inesperado en el ciclo: %s", e)

        # Espera troceada: se corta al cerrar el programa o al reanudar.
        _despertar.clear()
        for _ in range(config.INTERVALO_SEGUNDOS):
            if _parar.is_set() or _despertar.is_set():
                break
            _parar.wait(1)
    log.info("Bucle detenido.")


def arrancar_en_segundo_plano():
    hilo = threading.Thread(target=bucle, name="bot", daemon=True)
    hilo.start()
    return hilo


def detener():
    _parar.set()
    _despertar.set()