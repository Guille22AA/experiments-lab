"""
Comprobación de licencia. Completamente opcional y desactivada por defecto:
solo entra en juego si config.SERVIDOR_LICENCIAS tiene algo Y existe
data/licencia.txt. Una copia personal (como la de Guille) no tiene ninguno
de los dos, así que nunca se ve afectada por esto.

Pensado para copias vendidas: antes de empaquetar una copia para un
comprador, se rellena SERVIDOR_LICENCIAS con la URL del servidor de
licencias (proyecto aparte, "BotTrading-licencias"), y el comprador pone su
clave en data/licencia.txt.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

import requests

import config

log = logging.getLogger("bot")

TIMEOUT = 10


def activa():
    return bool(config.SERVIDOR_LICENCIAS) and config.LICENCIA_FILE.exists()


def _clave():
    # "utf-8-sig": el Bloc de notas / PowerShell meten BOM por defecto en
    # Windows, y sin quitarlo la clave nunca coincidiría con la del servidor.
    return config.LICENCIA_FILE.read_text(encoding="utf-8-sig").strip()


def _guardar_ultimo_ok():
    config.LICENCIA_ESTADO_FILE.write_text(
        json.dumps({"ultimo_ok": datetime.now(timezone.utc).isoformat(timespec="seconds")}),
        encoding="utf-8")


def _ultimo_ok():
    try:
        datos = json.loads(config.LICENCIA_ESTADO_FILE.read_text(encoding="utf-8"))
        return datetime.fromisoformat(datos["ultimo_ok"])
    except (OSError, ValueError, KeyError):
        return None


def comprobar():
    """
    Devuelve (ok, motivo). motivo es None si todo va bien o si la
    comprobación está desactivada.

    Si el servidor no responde, se concede el margen de gracia
    (config.LICENCIA_GRACIA_DIAS) desde la última vez que sí respondió algo
    válido, en vez de cortar en seco por un problema de red pasajero.
    """
    if not activa():
        return True, None

    clave = _clave()
    if not clave:
        return False, "falta la clave de licencia en data/licencia.txt"

    try:
        r = requests.get(f"{config.SERVIDOR_LICENCIAS.rstrip('/')}/verificar/{clave}",
                         timeout=TIMEOUT)
        r.raise_for_status()
        datos = r.json()
    except Exception as e:
        ultimo = _ultimo_ok()
        if ultimo and datetime.now(timezone.utc) - ultimo < timedelta(days=config.LICENCIA_GRACIA_DIAS):
            log.warning("No se pudo comprobar la licencia (%s); dentro del margen de gracia.", e)
            return True, None
        return False, f"no se pudo comprobar la licencia ({e})"

    if datos.get("valida"):
        _guardar_ultimo_ok()
        return True, None
    return False, datos.get("motivo") or "la licencia no es válida"
