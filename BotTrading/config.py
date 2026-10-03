"""
Configuración central. Todo lo que se puede tocar sin entrar en el resto del código.
Paso 1: solo seguimiento de precios. Todavía no hay lógica de compra/venta.
"""
from pathlib import Path

# --- Rutas -------------------------------------------------------------
# Por defecto los datos van a una carpeta "data" dentro del proyecto.
PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"

STATE_FILE = DATA_DIR / "estado.json"
BACKUP_DIR = DATA_DIR / "backups"
DB_FILE = DATA_DIR / "historial.sqlite"
LOG_DIR = DATA_DIR / "logs"
COINGECKO_KEY_FILE = DATA_DIR / "coingecko_key.txt"

# --- Moneda ------------------------------------------------------------
# Todo se normaliza a euros para poder sumar los dos lados.
MONEDA = "EUR"

# --- Clave de CoinGecko --------------------------------------------------
# CoinGecko empezó a exigir una clave "Demo" (gratis, sin tarjeta) incluso
# para el uso público: sin ella, bloquea las peticiones con un 403.
# Se saca de data/coingecko_key.txt para no tener que tocar el código ni
# subir la clave a ningún sitio. Si el archivo no existe, se sigue
# intentando sin clave (por si CoinGecko vuelve a permitirlo).
def coingecko_api_key():
    try:
        return COINGECKO_KEY_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def cabeceras_coingecko():
    """Cabeceras para cualquier petición a CoinGecko. Añade la clave si hay una guardada."""
    cabeceras = {"User-Agent": "BotTrading/0.1"}
    clave = coingecko_api_key()
    if clave:
        cabeceras["x-cg-demo-api-key"] = clave
    return cabeceras

# --- Activos que vigila el bot ----------------------------------------
# "id" es lo que usa la fuente de precios. "simbolo" es lo que se ve en pantalla.
ACTIVOS = {
    # "peso" reparte el cubo seguro. Todas a 1 salvo la stablecoin, que lleva
    # el doble: las cinco criptos grandes se mueven casi a la vez, así que
    # tener cinco no es diversificar, es la misma apuesta cinco veces. USDC
    # es el único ancla real cuando todo cae a la vez.
    "crypto": [
        {"simbolo": "BTC",  "id": "bitcoin",     "nombre": "Bitcoin",  "cubo": "seguro", "peso": 1},
        {"simbolo": "ETH",  "id": "ethereum",    "nombre": "Ethereum", "cubo": "seguro", "peso": 1},
        {"simbolo": "SOL",  "id": "solana",      "nombre": "Solana",   "cubo": "seguro", "peso": 1},
        {"simbolo": "BNB",  "id": "binancecoin", "nombre": "BNB",      "cubo": "seguro", "peso": 1},
        {"simbolo": "XRP",  "id": "ripple",      "nombre": "XRP",      "cubo": "seguro", "peso": 1},
        {"simbolo": "USDC", "id": "usd-coin",    "nombre": "USDC (estable)", "cubo": "seguro", "peso": 2},
    ],
    "broker": [
        {"simbolo": "SP500", "id": "^GSPC",     "nombre": "S&P 500",     "cubo": "seguro", "peso": 1},
        {"simbolo": "ORO",   "id": "GC=F",      "nombre": "Oro",         "cubo": "seguro", "peso": 1},
        {"simbolo": "EUSTX", "id": "^STOXX50E", "nombre": "Europa 50",   "cubo": "seguro", "peso": 1},
        {"simbolo": "EMERG", "id": "EEM",       "nombre": "Emergentes",  "cubo": "seguro", "peso": 1},
        {"simbolo": "BONOS", "id": "AGG",       "nombre": "Renta fija",  "cubo": "seguro", "peso": 1},
    ],
}


def activos_de(estado, wallet, cubo=None):
    """
    La lista viva de activos de una wallet. Vive en estado, no aquí: el
    usuario puede añadir, quitar o repesar activos desde el panel. ACTIVOS de
    arriba se queda solo como valor de fábrica (estado nuevo y "restaurar
    por defecto").
    """
    activos = estado["wallets"][wallet]["activos"]
    if cubo is None:
        return activos
    return [a for a in activos if a["cubo"] == cubo]

# --- Capital simulado inicial -----------------------------------------
# Dinero ficticio. No tiene nada que ver con dinero real.
# Mínimos funcionales, no cifras arbitrarias: por debajo de esto el filtro de
# comisiones bloquea las operaciones y las wallets se quedan inertes.
CAPITAL_INICIAL = {
    "crypto": 300.0,
    "broker": 2500.0,
}

# --- Ajustes por defecto ----------------------------------------------
# Son solo el punto de partida. Los valores que manda el bot viven en
# data/estado.json y se cambian desde el engranaje de cada wallet.
# Si tocas algo aquí, solo afecta a wallets nuevas o tras borrar data/.
def ajustes_por_defecto(wallet):
    return {
        "reparto": {"seguro": 0.85, "loteria": 0.15},
        # Aportación periódica. En 0 está desactivada.
        # Va entera al cubo seguro: si fuera al de lotería, sería una
        # reposición automática, justo lo que el diseño evita.
        "aportacion_importe":  0.0,
        "aportacion_dias":      30,
        # Interés sobre el efectivo parado, al año.
        # Bróker: cuentas remuneradas tipo Trade Republic rondan el 3 %.
        # Cripto: una stablecoin en un protocolo grande, más conservador.
        "interes_anual": 0.0304 if wallet == "broker" else 0.02,
        # El bróker necesita un margen mayor: con comisión fija de 1 € y el
        # filtro del 1 %, una orden ha de superar los 100 €. Con umbral del
        # 5 % sobre 1.000 € saldrían órdenes de 50 € y no se ejecutaría ninguna.
        # El bróker necesita margen mayor: con 1 € fijo por orden y el filtro
        # del 1 %, una orden ha de superar los 100 €. Sobre un cubo seguro de
        # 2.125 € un desvío del 5 % son 106 €, que pasa por los pelos: si el
        # mercado cae, deja de pasar. Con el 8 % hay margen de sobra.
        "umbral_rebalanceo": 0.08 if wallet == "broker" else 0.05,
        # Días que un activo queda vetado tras cerrarse su posición. Sin esto,
        # un token que salta por stop puede recomprarse en el ciclo siguiente
        # y generar comisiones en bucle.
        "cuarentena_dias":       5,
        "stop_perdida":      -28.0,
        "objetivo_parcial":    2.0,
        "fraccion_parcial":    0.5,
        "caida_desde_maximo":-35.0,
        # Con 300 € en cripto el cubo lotería son 45 €: 4 apuestas de hasta
        # 13,50 € cada una. Por debajo de eso el mínimo de 5 € las bloquearía.
        "max_posiciones":        4,
        "max_por_posicion":   0.30,
    }


# Compatibilidad: algunos sitios siguen leyendo REPARTO directamente.
REPARTO = {
    "crypto": {"seguro": 0.85, "loteria": 0.15},
    "broker": {"seguro": 0.85, "loteria": 0.15},
}

# Límites de seguridad. Ningún ajuste puede salirse de aquí, ni escribiendo
# a mano en el JSON: un reparto del 90 % en lotería no es una preferencia,
# es un error que arruina el diseño entero.
LIMITES = {
    "reparto_loteria":     (0.0, 0.40),
    "umbral_rebalanceo":   (0.01, 0.30),
    "stop_perdida":        (-80.0, -5.0),
    "objetivo_parcial":    (1.2, 10.0),
    "fraccion_parcial":    (0.1, 1.0),
    "caida_desde_maximo":  (-90.0, -10.0),
    "max_posiciones":      (1, 20),
    "max_por_posicion":    (0.05, 1.0),
    "aportacion_importe":  (0.0, 100000.0),
    "aportacion_dias":     (1, 365),
    "interes_anual":       (0.0, 0.20),
    "cuarentena_dias":     (0, 90),
}

# --- Deslizamiento (slippage) -----------------------------------------
# Nunca se compra al precio exacto que se ve: hay horquilla entre compra y
# venta, y en activos pequeños la propia orden mueve el precio. Sin esto la
# simulación es optimista, justo en el cubo que peor información da.
DESLIZAMIENTO = {
    "crypto": {"seguro": 0.0010, "loteria": 0.0150},
    "broker": {"seguro": 0.0005, "loteria": 0.0030},
}

# --- Frecuencia del escaneo -------------------------------------------
# Los filtros de entrada miran el cambio de 24 h, un dato que apenas se
# mueve en cinco minutos. Escanear más a menudo no aporta información,
# solo da más ocasiones de entrar.
ESCANEO_CADA_SEGUNDOS = 3600

# --- Fiscalidad (informativo) -----------------------------------------
# Tramos del ahorro en España. Solo se muestra una estimación: el impuesto
# no se descuenta de la simulación porque se paga aparte, en la declaración.
TRAMOS_AHORRO = [(6000, 0.19), (50000, 0.21), (200000, 0.23),
                 (300000, 0.27), (float("inf"), 0.30)]

# --- Reglas de rebalanceo ---------------------------------------------
# Cuánto se tiene que desviar algo de su objetivo antes de que el bot actúe.
# 0.05 = 5 puntos porcentuales sobre el total de la wallet.
# Sin este margen, el bot rebalancearía a diario y se lo comerían las comisiones.
UMBRAL_REBALANCEO = 0.05

# Nunca operar por menos de esto: una orden pequeña se la come la comisión.
OPERACION_MINIMA = 5.0

# Y, sobre todo, no operar si la comisión se lleva más de este porcentaje del
# importe. Es el filtro que de verdad importa con comisiones fijas: un euro
# sobre 37 € es un 2,7 % de entrada, y un 5,4 % contando la salida.
# Excepción: cerrar una posición entera siempre se permite, o una que se
# hunda quedaría atrapada para siempre.
COSTE_MAXIMO_OPERACION = 0.01

# Comisiones simuladas. Se restan de verdad, para que la curva no mienta.
# Los exchanges cobran un porcentaje; los brókers europeos modernos, una
# cantidad fija por orden. La diferencia importa: con comisión fija, una
# compra de 30 € se lleva un 3,3 % de entrada solo en costes.
COMISION = {
    "crypto": {"tipo": "porcentaje", "valor": 0.0025, "minimo": 0.0},
    "broker": {"tipo": "fijo",       "valor": 1.0,    "minimo": 0.0},
}

# El bróker solo opera de lunes a viernes. La cripto, todos los días.
SOLO_DIAS_HABILES = {"crypto": False, "broker": True}

# --- Cubo lotería: de dónde salen los candidatos -----------------------
# Cripto: escaneo abierto sobre las monedas con más volumen del mercado.
#         No hay lista fija, el bot mira lo que hay cada vez.
# Bróker: no existe un escáner gratuito de toda la bolsa, así que se vigila
#         un universo amplio de valores conocidos por moverse mucho.
UNIVERSO_LOTERIA = {
    "crypto": {"tipo": "escaneo", "cuantas": 250},
    "broker": {"tipo": "universo", "tickers": [
        "TSLA", "NVDA", "AMD", "COIN", "MSTR", "PLTR", "RIVN", "LCID",
        "SOFI", "RIOT", "MARA", "AFRM", "ROKU", "SNAP", "U", "DKNG",
        "CVNA", "UPST", "HOOD", "SMCI", "ARKK", "SOXL", "TQQQ", "GME",
    ]},
}

# --- Filtros de entrada del cubo lotería -------------------------------
# Descartan lo obviamente malo. No predicen: solo miden lo que ya pasó.
FILTROS_LOTERIA = {
    "crypto": {
        "mcap_minimo":      20_000_000,   # nada microscópico
        "mcap_maximo":   3_000_000_000,   # si ya es gigante, no queda recorrido
        "volumen_minimo":    1_000_000,   # que se pueda entrar y salir
        "ratio_vol_mcap":          0.05,  # actividad real, no volumen fantasma
        "subida_min":               3.0,  # algo se está moviendo
        "subida_max":              40.0,  # si ya voló, no se persigue
    },
    "broker": {
        "volumen_minimo":      500_000,
        "ratio_vol_medio":         1.5,   # volumen por encima de su media
        "subida_min":              2.0,
        "subida_max":             20.0,
    },
}

# --- Reglas de salida del cubo lotería ---------------------------------
# Aquí es donde se gana o se pierde de verdad. Valores fijos a propósito:
# un sistema que se recalibra solo va siempre un paso por detrás.
SALIDA_LOTERIA = {
    "stop_perdida":        -28.0,   # % desde el precio de entrada
    "objetivo_parcial":      2.0,   # al doblar...
    "fraccion_parcial":      0.5,   # ...vender la mitad y dejar correr el resto
    "caida_desde_maximo":  -35.0,   # si se desploma desde su máximo, fuera
}

# Cuánto puede pesar una sola apuesta dentro del cubo lotería.
MAX_POR_POSICION_LOTERIA = 0.25
MAX_POSICIONES_LOTERIA = 5

# --- Deslizamiento -----------------------------------------------------
# Nunca compras al precio exacto que ves: hay horquilla, y una orden mueve
# algo el precio. Sin esto la simulación es optimista, que es justo el
# error peligroso antes de plantearse dinero real.
DESLIZAMIENTO = {
    "crypto": {"seguro": 0.001, "loteria": 0.015},   # 0,1 % y 1,5 %
    "broker": {"seguro": 0.0005, "loteria": 0.003},
}

# --- Cuarentena --------------------------------------------------------
# Tras cerrar una apuesta, no se vuelve a entrar en ese activo durante unos
# días. Sin esto, un token que salta por stop y sigue pasando los filtros se
# recompra al ciclo siguiente: una máquina de generar comisiones.
CUARENTENA_DIAS = 5

# --- Impuestos (informativo) -------------------------------------------
# Tramos del ahorro en España. Solo se estima sobre ganancias realizadas,
# para que se vea el arrastre fiscal de operar mucho. No es asesoramiento.
TRAMOS_IRPF_AHORRO = [
    (6000, 0.19), (50000, 0.21), (200000, 0.23), (300000, 0.27), (float("inf"), 0.28),
]

# --- Tiempos -----------------------------------------------------------
INTERVALO_SEGUNDOS = 300      # cada cuánto consulta precios (5 min)
# El escaneo va aparte: los filtros de entrada usan el cambio de 24 h, que no
# se mueve en cinco minutos. Escanear más a menudo no aporta información,
# solo da más ocasiones de entrar y rotar.
INTERVALO_ESCANEO = 3600      # una vez por hora
DIAS_GUARDAR_LOGS = 30        # los logs más viejos se borran solos

# --- Servidor web ------------------------------------------------------
HOST = "127.0.0.1"            # solo localhost, no accesible desde fuera
PUERTO = 5000