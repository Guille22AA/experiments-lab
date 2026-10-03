"""
Persistencia en disco.

Dos cosas separadas a propósito:
  - estado.json  -> foto del momento actual. Se sobreescribe, no crece.
  - historial.sqlite -> todo lo que ha pasado. No se borra nunca.
"""
import json
import os
import shutil
import sqlite3
import logging
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler

import config


# --- Arranque de carpetas ---------------------------------------------
def preparar_carpetas():
    for carpeta in (config.DATA_DIR, config.BACKUP_DIR, config.LOG_DIR):
        carpeta.mkdir(parents=True, exist_ok=True)


def ahora():
    """Marca de tiempo en UTC, formato ISO."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --- Logs --------------------------------------------------------------
def configurar_logs():
    preparar_carpetas()
    log = logging.getLogger("bot")
    if log.handlers:
        return log
    log.setLevel(logging.INFO)

    handler = TimedRotatingFileHandler(
        config.LOG_DIR / "bot.log",
        when="midnight",
        backupCount=config.DIAS_GUARDAR_LOGS,   # borra solo los más viejos
        encoding="utf-8",
    )
    formato = logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s")
    handler.setFormatter(formato)
    log.addHandler(handler)

    consola = logging.StreamHandler()
    consola.setFormatter(formato)
    log.addHandler(consola)
    return log


# --- Estado ------------------------------------------------------------
def estado_inicial():
    wallets = {}
    for wallet, capital in config.CAPITAL_INICIAL.items():
        wallets[wallet] = {
            # Dos bolsillos separados. Es lo que hace que el cubo lotería
            # no se reponga solo: si pierde, su bolsillo encoge y punto.
            "efectivo": {
                "seguro": capital * config.REPARTO[wallet]["seguro"],
                "loteria": capital * config.REPARTO[wallet]["loteria"],
            },
            "aportado": capital,        # lo que "he metido" yo
            "repuesto": 0.0,            # acumulado de reposiciones manuales
            "activos": [dict(a) for a in config.ACTIVOS[wallet]],  # copia, no la constante
            "posiciones": [],           # todavía vacío en el paso 1
            "comisiones": 0.0,
            "aciertos": 0,
            "fallos": 0,
            "intereses": 0.0,
            "deslizamiento": 0.0,
            "cuarentena": {},
            "referencia": {"posiciones": {}, "aportado": 0.0},
            "ultima_aportacion": None,
            "ultimo_interes": None,
            "ajustes": config.ajustes_por_defecto(wallet),
        }
    return {
        "version": 1,
        "creado": ahora(),
        "ultima_consulta": None,
        "bot_activo": True,
        "wallets": wallets,
        "precios": {},                  # último precio conocido por símbolo
        "candidatos": {"crypto": [], "broker": [], "actualizado": None},
    }


def guardar_estado(estado):
    """
    Escritura atómica: se escribe a un temporal y se renombra encima.
    Si se corta la luz a mitad, el archivo bueno sigue intacto.
    """
    preparar_carpetas()
    temporal = config.STATE_FILE.with_suffix(".tmp")
    with open(temporal, "w", encoding="utf-8") as f:
        json.dump(estado, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temporal, config.STATE_FILE)


def migrar(estado):
    """
    Rellena lo que falte al abrir un estado guardado por una versión
    anterior. Así se puede actualizar el bot sin borrar el historial.
    """
    estado.setdefault("candidatos", {"crypto": [], "broker": [], "actualizado": None})
    for wallet, datos in estado.get("wallets", {}).items():
        datos.setdefault("intereses", 0.0)
        datos.setdefault("deslizamiento", 0.0)
        datos.setdefault("cuarentena", {})
        datos.setdefault("referencia", {"posiciones": {}, "aportado": 0.0})
        datos.setdefault("ultima_aportacion", None)
        datos.setdefault("ultimo_interes", None)
        datos.setdefault("activos", [dict(a) for a in config.ACTIVOS[wallet]])
        defecto = config.ajustes_por_defecto(wallet)
        ajustes = datos.setdefault("ajustes", {})
        for clave, valor in defecto.items():
            ajustes.setdefault(clave, valor)
        sanear_ajustes(ajustes, defecto)
    return estado


def sanear_ajustes(ajustes, defecto):
    """
    Recorta a su rango cualquier ajuste fuera de límites. Protege también del
    caso de editar estado.json a mano y dejar un valor absurdo.
    """
    for clave, (minimo, maximo) in config.LIMITES.items():
        if clave == "reparto_loteria":
            valor = ajustes.get("reparto", {}).get("loteria", defecto["reparto"]["loteria"])
            valor = max(minimo, min(maximo, abs(float(valor))))
            ajustes["reparto"] = {"loteria": valor, "seguro": 1 - valor}
            continue
        if clave not in ajustes:
            continue
        try:
            valor = float(ajustes[clave])
        except (TypeError, ValueError):
            ajustes[clave] = defecto[clave]
            continue
        # Las caídas son negativas; el resto, positivos.
        valor = -abs(valor) if maximo <= 0 else abs(valor)
        valor = max(minimo, min(maximo, valor))
        ajustes[clave] = int(valor) if clave in ("max_posiciones", "aportacion_dias", "cuarentena_dias") else valor


def cargar_estado():
    preparar_carpetas()
    if not config.STATE_FILE.exists():
        estado = estado_inicial()
        guardar_estado(estado)
        return estado
    try:
        with open(config.STATE_FILE, encoding="utf-8") as f:
            return migrar(json.load(f))
    except (json.JSONDecodeError, OSError):
        # Archivo corrupto: se intenta la copia de seguridad más reciente.
        copias = sorted(config.BACKUP_DIR.glob("estado-*.json"))
        if copias:
            with open(copias[-1], encoding="utf-8") as f:
                return json.load(f)
        return estado_inicial()


def copia_diaria(estado):
    """Una copia por día, automática. No hay que hacer nada a mano."""
    preparar_carpetas()
    destino = config.BACKUP_DIR / f"estado-{datetime.now():%Y-%m-%d}.json"
    if not destino.exists() and config.STATE_FILE.exists():
        shutil.copy2(config.STATE_FILE, destino)


# --- Base de datos -----------------------------------------------------
def conexion():
    preparar_carpetas()
    con = sqlite3.connect(config.DB_FILE)
    con.row_factory = sqlite3.Row
    return con


def preparar_bd():
    with conexion() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS precios (
                ts       TEXT NOT NULL,
                wallet   TEXT NOT NULL,
                simbolo  TEXT NOT NULL,
                precio   REAL NOT NULL,
                moneda   TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_precios_simbolo ON precios(simbolo, ts);

            CREATE TABLE IF NOT EXISTS operaciones (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        TEXT NOT NULL,
                wallet    TEXT NOT NULL,
                cubo      TEXT NOT NULL,
                tipo      TEXT NOT NULL,      -- compra | venta
                simbolo   TEXT NOT NULL,
                cantidad  REAL NOT NULL,
                precio    REAL NOT NULL,
                importe   REAL NOT NULL,
                comision  REAL NOT NULL DEFAULT 0,
                pl_pct    REAL,               -- solo en ventas
                pl_abs    REAL,               -- solo en ventas
                motivo    TEXT
            );

            CREATE TABLE IF NOT EXISTS saldos (
                ts        TEXT NOT NULL,
                wallet    TEXT NOT NULL,
                total     REAL NOT NULL,
                seguro    REAL NOT NULL DEFAULT 0,
                loteria   REAL NOT NULL DEFAULT 0,
                efectivo  REAL NOT NULL,
                aportado  REAL NOT NULL,
                referencia REAL
            );
            CREATE INDEX IF NOT EXISTS idx_saldos_wallet ON saldos(wallet, ts);

            CREATE TABLE IF NOT EXISTS aportaciones (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                ts      TEXT NOT NULL,
                wallet  TEXT NOT NULL,
                importe REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reposiciones (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                ts      TEXT NOT NULL,
                wallet  TEXT NOT NULL,
                importe REAL NOT NULL
            );
            """
        )


def registrar_precio(wallet, simbolo, precio, moneda):
    with conexion() as con:
        con.execute(
            "INSERT INTO precios (ts, wallet, simbolo, precio, moneda) VALUES (?,?,?,?,?)",
            (ahora(), wallet, simbolo, precio, moneda),
        )


def registrar_saldo(wallet, total, seguro, loteria, efectivo, aportado,
                    referencia=None):
    with conexion() as con:
        con.execute(
            "INSERT INTO saldos (ts, wallet, total, seguro, loteria, efectivo,"
            " aportado, referencia) VALUES (?,?,?,?,?,?,?,?)",
            (ahora(), wallet, total, seguro, loteria, efectivo, aportado,
             referencia),
        )


def registrar_operacion(wallet, cubo, tipo, simbolo, cantidad, precio,
                        importe, comision, pl_pct, pl_abs, motivo):
    with conexion() as con:
        con.execute(
            "INSERT INTO operaciones (ts, wallet, cubo, tipo, simbolo, cantidad,"
            " precio, importe, comision, pl_pct, pl_abs, motivo)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (ahora(), wallet, cubo, tipo, simbolo, cantidad, precio,
             importe, comision, pl_pct, pl_abs, motivo),
        )


def leer_saldos(wallet, limite=500):
    with conexion() as con:
        filas = con.execute(
            "SELECT ts, total, referencia FROM saldos WHERE wallet=?"
            " ORDER BY ts DESC LIMIT ?",
            (wallet, limite),
        ).fetchall()
    return [dict(f) for f in reversed(filas)]


def leer_precios(simbolo, limite=500):
    with conexion() as con:
        filas = con.execute(
            "SELECT ts, precio FROM precios WHERE simbolo=? ORDER BY ts DESC LIMIT ?",
            (simbolo, limite),
        ).fetchall()
    return [dict(f) for f in reversed(filas)]


def registrar_aportacion(wallet, importe):
    with conexion() as con:
        con.execute("INSERT INTO aportaciones (ts, wallet, importe) VALUES (?,?,?)",
                    (ahora(), wallet, importe))


def registrar_reposicion(wallet, importe):
    with conexion() as con:
        con.execute("INSERT INTO reposiciones (ts, wallet, importe) VALUES (?,?,?)",
                    (ahora(), wallet, importe))


def plusvalias_del_ano(wallet=None, ano=None):
    """
    Ganancias y pérdidas ya realizadas (solo ventas cerradas) del año en curso.
    En España cada venta es un hecho imponible, aunque no saques el dinero.
    """
    from datetime import datetime
    ano = ano or datetime.now().year
    consulta = ("SELECT COALESCE(SUM(pl_abs),0) FROM operaciones"
                " WHERE tipo='venta' AND strftime('%Y', ts)=?")
    parametros = [str(ano)]
    if wallet:
        consulta += " AND wallet=?"
        parametros.append(wallet)
    with conexion() as con:
        return con.execute(consulta, parametros).fetchone()[0] or 0.0


def impuesto_estimado(ganancia):
    """
    Estimación por tramos del ahorro. Es orientativa: no tiene en cuenta
    otras rentas, compensación de pérdidas de años anteriores ni mínimos.
    No se descuenta de la simulación porque se paga aparte.
    """
    if ganancia <= 0:
        return 0.0
    total, restante, anterior = 0.0, ganancia, 0.0
    for tope, tipo in config.TRAMOS_AHORRO:
        tramo = min(restante, tope - anterior)
        if tramo <= 0:
            break
        total += tramo * tipo
        restante -= tramo
        anterior = tope
    return total


def leer_operaciones(wallet=None, limite=100):
    consulta = "SELECT * FROM operaciones"
    parametros = []
    if wallet:
        consulta += " WHERE wallet=?"
        parametros.append(wallet)
    consulta += " ORDER BY ts DESC LIMIT ?"
    parametros.append(limite)
    with conexion() as con:
        return [dict(f) for f in con.execute(consulta, parametros).fetchall()]