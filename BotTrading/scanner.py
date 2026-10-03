"""
El escáner del cubo lotería.

No hay lista fija de activos. Cada ciclo se mira el mercado y se filtra.

  Cripto -> CoinGecko devuelve las monedas con más volumen. Se filtran por
            capitalización, volumen y movimiento reciente.
  Bróker -> No existe un escáner gratuito de toda la bolsa, así que se vigila
            un universo amplio de valores conocidos por moverse mucho.

Importante: esto NO predice nada. Solo mide lo que ya ha pasado y descarta
lo que incumple los filtros. La mayoría de los candidatos que salgan no van
a ir a ninguna parte, y eso es lo esperado.
"""
import logging

import requests
import yfinance as yf

import config

log = logging.getLogger("bot")

MERCADOS = "https://api.coingecko.com/api/v3/coins/markets"
PRECIOS = "https://api.coingecko.com/api/v3/simple/price"
TIMEOUT = 25


# --- Cripto -------------------------------------------------------------
def _mercado_cripto():
    respuesta = requests.get(
        MERCADOS,
        params={
            "vs_currency": "eur",
            "order": "volume_desc",
            "per_page": config.UNIVERSO_LOTERIA["crypto"]["cuantas"],
            "page": 1,
            "price_change_percentage": "24h",
        },
        timeout=TIMEOUT,
        headers=config.cabeceras_coingecko(),
    )
    respuesta.raise_for_status()
    return respuesta.json()


def candidatos_cripto(estado):
    """Devuelve la lista de monedas que pasan todos los filtros, mejor primero."""
    f = config.FILTROS_LOTERIA["crypto"]
    seguros = {a["id"] for a in config.activos_de(estado, "crypto")}
    salida = []

    for moneda in _mercado_cripto():
        try:
            mcap = moneda.get("market_cap") or 0
            volumen = moneda.get("total_volume") or 0
            precio = moneda.get("current_price")
            cambio = moneda.get("price_change_percentage_24h")

            if not precio or cambio is None or mcap <= 0:
                continue
            if moneda["id"] in seguros:          # no duplicar el cubo seguro
                continue
            if not (f["mcap_minimo"] <= mcap <= f["mcap_maximo"]):
                continue
            if volumen < f["volumen_minimo"]:
                continue
            if volumen / mcap < f["ratio_vol_mcap"]:
                continue
            if not (f["subida_min"] <= cambio <= f["subida_max"]):
                continue

            salida.append({
                "simbolo": moneda["symbol"].upper(),
                "id": moneda["id"],
                "nombre": moneda["name"],
                "precio": float(precio),
                "cambio": float(cambio),
                "volumen": float(volumen),
                "mcap": float(mcap),
                "actividad": volumen / mcap,
            })
        except (KeyError, TypeError, ValueError):
            continue

    # Se ordena por actividad, no por cuánto ha subido: perseguir la mayor
    # subida es justo comprar lo más caro del momento.
    salida.sort(key=lambda c: c["actividad"], reverse=True)
    return salida


def precios_cripto_por_id(ids):
    """Precio actual de monedas concretas, para valorar lo que ya se tiene."""
    if not ids:
        return {}
    respuesta = requests.get(
        PRECIOS,
        params={"ids": ",".join(ids), "vs_currencies": "eur"},
        timeout=TIMEOUT,
        headers=config.cabeceras_coingecko(),
    )
    respuesta.raise_for_status()
    datos = respuesta.json()
    return {k: v["eur"] for k, v in datos.items() if "eur" in v}


# --- Bróker -------------------------------------------------------------
def _descarga(tickers, periodo="1mo"):
    """Una sola petición para todos los tickers, en vez de una por cada uno."""
    return yf.download(
        tickers, period=periodo, interval="1d",
        group_by="ticker", progress=False, auto_adjust=True, threads=True,
    )


def candidatos_broker(cambio_usd_eur):
    f = config.FILTROS_LOTERIA["broker"]
    tickers = config.UNIVERSO_LOTERIA["broker"]["tickers"]
    datos = _descarga(tickers)
    salida = []

    for ticker in tickers:
        try:
            hist = datos[ticker].dropna()
            if len(hist) < 5:
                continue

            cierre = float(hist["Close"].iloc[-1])
            anterior = float(hist["Close"].iloc[-2])
            volumen = float(hist["Volume"].iloc[-1])
            volumen_medio = float(hist["Volume"].tail(20).mean()) or 1.0

            cambio = ((cierre / anterior) - 1) * 100
            ratio = volumen / volumen_medio

            if volumen < f["volumen_minimo"]:
                continue
            if ratio < f["ratio_vol_medio"]:
                continue
            if not (f["subida_min"] <= cambio <= f["subida_max"]):
                continue

            salida.append({
                "simbolo": ticker,
                "id": ticker,
                "nombre": ticker,
                "precio": cierre / cambio_usd_eur,
                "cambio": cambio,
                "volumen": volumen,
                "actividad": ratio,
            })
        except (KeyError, IndexError, TypeError, ValueError):
            continue

    salida.sort(key=lambda c: c["actividad"], reverse=True)
    return salida


def precios_broker_por_id(tickers, cambio_usd_eur):
    if not tickers:
        return {}
    datos = _descarga(list(tickers), periodo="5d")
    salida = {}
    for ticker in tickers:
        try:
            cierre = float(datos[ticker]["Close"].dropna().iloc[-1])
            salida[ticker] = cierre / cambio_usd_eur
        except (KeyError, IndexError, ValueError):
            log.debug("Sin precio para %s", ticker)
    return salida
