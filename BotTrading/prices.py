"""
Lectura de precios reales.

  Cripto  -> CoinGecko (gratis, sin clave). Devuelve directamente en euros.
  Bróker  -> Yahoo Finance vía yfinance. Devuelve en dólares, se pasa a euros.

Si una fuente falla, se devuelve lo que se haya podido leer y se registra el
fallo. El bot no debe caerse porque una petición vaya mal.
"""
import logging

import requests
import yfinance as yf

import config

log = logging.getLogger("bot")

COINGECKO = "https://api.coingecko.com/api/v3/simple/price"
TIMEOUT = 15


def precios_cripto(estado):
    """Devuelve {simbolo: precio_en_euros}."""
    activos = config.activos_de(estado, "crypto")
    ids = ",".join(a["id"] for a in activos)
    respuesta = requests.get(
        COINGECKO,
        params={"ids": ids, "vs_currencies": "eur"},
        timeout=TIMEOUT,
        headers=config.cabeceras_coingecko(),
    )
    respuesta.raise_for_status()
    datos = respuesta.json()

    resultado = {}
    for activo in activos:
        valor = datos.get(activo["id"], {}).get("eur")
        if valor is not None:
            resultado[activo["simbolo"]] = float(valor)
        else:
            log.warning("CoinGecko no devolvió precio para %s", activo["simbolo"])
    return resultado


def _cambio_eur_usd():
    """Cuántos dólares vale un euro. Se usa para pasar el lado bróker a euros."""
    ticker = yf.Ticker("EURUSD=X")
    datos = ticker.history(period="5d", interval="1d")
    if datos.empty:
        raise RuntimeError("Sin datos de cambio EUR/USD")
    return float(datos["Close"].iloc[-1])


def precios_broker(estado):
    """Devuelve {simbolo: precio_en_euros}."""
    cambio = _cambio_eur_usd()
    resultado = {}
    for activo in config.activos_de(estado, "broker"):
        try:
            datos = yf.Ticker(activo["id"]).history(period="5d", interval="1d")
            if datos.empty:
                log.warning("Yahoo no devolvió datos para %s", activo["simbolo"])
                continue
            precio_usd = float(datos["Close"].iloc[-1])
            resultado[activo["simbolo"]] = precio_usd / cambio
        except Exception as e:
            log.warning("Fallo leyendo %s: %s", activo["simbolo"], e)
    return resultado


def verificar_id_broker(ticker):
    """
    Comprueba que un ticker de Yahoo Finance devuelve precio, antes de dejar
    que el usuario lo añada a su lista de activos desde el panel.
    """
    try:
        datos = yf.Ticker(ticker).history(period="5d", interval="1d")
        return not datos.empty
    except Exception:
        return False


def leer_todos(estado):
    """
    Devuelve (precios, errores).
    precios = {"crypto": {...}, "broker": {...}}
    """
    precios = {"crypto": {}, "broker": {}}
    errores = []

    try:
        precios["crypto"] = precios_cripto(estado)
    except Exception as e:
        errores.append(config.texto("error_cripto", e=e))
        log.error("Fallo leyendo precios de cripto: %s", e)

    try:
        precios["broker"] = precios_broker(estado)
    except Exception as e:
        errores.append(config.texto("error_broker", e=e))
        log.error("Fallo leyendo precios de bróker: %s", e)

    return precios, errores
