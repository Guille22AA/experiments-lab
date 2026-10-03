"""
Gestión de claves de licencia desde la línea de comandos. Nada de web ni
contraseñas: esto se ejecuta a mano en tu PC, directo contra licencias.db.

    python gestionar.py crear "Nombre del comprador" [--nota "texto"]
    python gestionar.py revocar BT-XXXX-XXXX-XXXX-XXXX
    python gestionar.py reactivar BT-XXXX-XXXX-XXXX-XXXX
    python gestionar.py listar
"""
import argparse
import secrets
import sys
from datetime import datetime, timezone

from servidor import conexion, preparar_bd


def generar_clave():
    partes = [secrets.token_hex(2).upper() for _ in range(4)]
    return "BT-" + "-".join(partes)


def crear(comprador, nota):
    clave = generar_clave()
    with conexion() as con:
        con.execute(
            "INSERT INTO licencias (clave, comprador, activa, creada, nota) "
            "VALUES (?, ?, 1, ?, ?)",
            (clave, comprador, datetime.now(timezone.utc).isoformat(timespec="seconds"), nota),
        )
    print(f"Clave nueva para {comprador}:\n\n  {clave}\n")


def cambiar_estado(clave, activa):
    with conexion() as con:
        cur = con.execute("UPDATE licencias SET activa = ? WHERE clave = ?", (activa, clave))
    if cur.rowcount == 0:
        print(f"No existe la clave {clave}", file=sys.stderr)
        sys.exit(1)
    print(f"{clave}: {'reactivada' if activa else 'revocada'}.")


def listar():
    with conexion() as con:
        filas = con.execute(
            "SELECT clave, comprador, activa, creada, nota FROM licencias ORDER BY creada DESC"
        ).fetchall()
    if not filas:
        print("Sin licencias todavía.")
        return
    for f in filas:
        estado = "activa" if f["activa"] else "REVOCADA"
        print(f"{f['clave']}  {estado:9}  {f['comprador']}  ({f['creada']})"
              + (f"  — {f['nota']}" if f["nota"] else ""))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="accion", required=True)

    p_crear = sub.add_parser("crear")
    p_crear.add_argument("comprador")
    p_crear.add_argument("--nota", default=None)

    p_rev = sub.add_parser("revocar")
    p_rev.add_argument("clave")

    p_react = sub.add_parser("reactivar")
    p_react.add_argument("clave")

    sub.add_parser("listar")

    args = parser.parse_args()
    preparar_bd()

    if args.accion == "crear":
        crear(args.comprador, args.nota)
    elif args.accion == "revocar":
        cambiar_estado(args.clave, False)
    elif args.accion == "reactivar":
        cambiar_estado(args.clave, True)
    elif args.accion == "listar":
        listar()


if __name__ == "__main__":
    main()
