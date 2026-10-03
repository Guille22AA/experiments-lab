"""
Servidor de licencias para las copias vendidas de BotTrading.

NO es DRM: cualquiera con el código fuente puede saltárselo. Lo que de
verdad aporta es poder revocar una clave y saber cuántas copias activas hay.
Cada bot vendido llama a GET /verificar/<clave> en cada arranque (ver
BotTrading/licencias.py) y respeta un margen de gracia si este servidor no
responde, así que no hace falta alta disponibilidad.

Uso:
    pip install -r requirements.txt
    python servidor.py              # arranca en local, puerto 8787

Gestión de claves (altas/bajas): usar gestionar.py, no esta API. A este
tamaño (venta artesanal, pocas copias) no compensa construir un panel de
administración con su propia autenticación.
"""
import sqlite3
from pathlib import Path

from flask import Flask, jsonify

DB_FILE = Path(__file__).resolve().parent / "licencias.db"

app = Flask(__name__)


def conexion():
    con = sqlite3.connect(DB_FILE)
    con.row_factory = sqlite3.Row
    return con


def preparar_bd():
    with conexion() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS licencias (
                clave     TEXT PRIMARY KEY,
                comprador TEXT NOT NULL,
                activa    INTEGER NOT NULL DEFAULT 1,
                creada    TEXT NOT NULL,
                nota      TEXT
            )
        """)


@app.route("/verificar/<clave>")
def verificar(clave):
    with conexion() as con:
        fila = con.execute(
            "SELECT activa FROM licencias WHERE clave = ?", (clave,)
        ).fetchone()

    if fila is None:
        return jsonify({"valida": False, "motivo": "clave desconocida"})
    if not fila["activa"]:
        return jsonify({"valida": False, "motivo": "licencia revocada"})
    return jsonify({"valida": True})


if __name__ == "__main__":
    preparar_bd()
    app.run(host="0.0.0.0", port=8787)
