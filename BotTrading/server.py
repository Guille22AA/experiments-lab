"""
Servidor web local. Solo escucha en 127.0.0.1, no es accesible desde fuera.
Es una vista del estado: cerrar el navegador no afecta al bot.
"""
import logging

from flask import Flask, jsonify, render_template, request

import bot
import config
import prices
import scanner
import storage
import strategy
import textos

log = logging.getLogger("bot")

app = Flask(__name__)


def _version_estatica():
    """
    Marca de tiempo de los archivos estáticos. Se añade a la URL para que el
    navegador nunca sirva una copia antigua tras una actualización.
    """
    marcas = []
    for nombre in ("style.css", "app.js"):
        ruta = config.PROJECT_DIR / "static" / nombre
        marcas.append(int(ruta.stat().st_mtime) if ruta.exists() else 0)
    return max(marcas)


@app.route("/")
def inicio():
    idioma = config.idioma()
    return render_template("index.html", v=_version_estatica(),
                           idioma=idioma, textos=textos.TEXTOS[idioma])


@app.after_request
def _sin_cache(respuesta):
    if request.path.startswith("/static/"):
        respuesta.headers["Cache-Control"] = "no-cache, must-revalidate"
    return respuesta


@app.route("/api/estado")
def api_estado():
    estado = storage.cargar_estado()

    candidatos_estado = estado.get("candidatos", {})

    wallets = {}
    for nombre in estado["wallets"]:
        datos = estado["wallets"][nombre]
        total, seguro, loteria = bot.valor_wallet(estado, nombre)
        invertido = seguro + loteria
        objetivo = datos["ajustes"]["reparto"]
        abiertas = {p["simbolo"] for p in datos["posiciones"]}

        posiciones = []
        for p in datos["posiciones"]:
            precio = estado["precios"].get(p["simbolo"], {}).get("precio") or p["precio_entrada"]
            valor = p["cantidad"] * precio
            posiciones.append({
                **p,
                "precio_actual": precio,
                "valor_actual": valor,
                "pl_abs": valor - p["importe"],
                "pl_pct": ((valor / p["importe"]) - 1) * 100 if p["importe"] else None,
            })

        wallets[nombre] = {
            "total": total,
            "efectivo": sum(datos["efectivo"].values()),
            "efectivo_seguro": datos["efectivo"]["seguro"],
            "efectivo_loteria": datos["efectivo"]["loteria"],
            "aportado": datos["aportado"],
            "resultado": total - datos["aportado"],
            "seguro": seguro,
            "loteria": loteria,
            "reparto_real": {
                "seguro": (seguro / invertido * 100) if invertido else None,
                "loteria": (loteria / invertido * 100) if invertido else None,
            },
            "reparto_objetivo": {
                "seguro": objetivo["seguro"] * 100,
                "loteria": objetivo["loteria"] * 100,
            },
            "posiciones": posiciones,
            "ajustes": datos["ajustes"],
            "intereses": datos.get("intereses", 0.0),
            "deslizamiento": datos.get("deslizamiento", 0.0),
            "cuarentena": datos.get("cuarentena", {}),
            "referencia": strategy.valor_referencia(estado, nombre),
            "diagnostico": strategy.diagnostico(estado, nombre),
            "orden_minima": strategy.orden_minima(nombre),
            "plusvalias": storage.plusvalias_del_ano(nombre),
            "impuesto": storage.impuesto_estimado(storage.plusvalias_del_ano(nombre)),
            "ultima_aportacion": datos.get("ultima_aportacion"),
            "repuesto": datos["repuesto"],
            "comisiones": datos["comisiones"],
            "aciertos": datos["aciertos"],
            "fallos": datos["fallos"],
            "activos": [
                {
                    **activo,
                    "precio": estado["precios"].get(activo["simbolo"], {}).get("precio"),
                }
                for activo in config.activos_de(estado, nombre)
            ],
            "historial": storage.leer_operaciones(nombre, limite=50),
            "grafica": storage.leer_saldos(nombre, limite=500),
            "candidatos": [
                {**c, "en_cartera": c["simbolo"] in abiertas}
                for c in candidatos_estado.get(nombre, [])
            ],
            "candidatos_actualizado": candidatos_estado.get("actualizado"),
        }

    return jsonify({
        # El estado real lo manda la memoria, no el archivo: si acaban de
        # pulsar pausa, el disco puede ir un ciclo por detrás.
        "bot_activo": bot.esta_activo(),
        "ultima_consulta": estado.get("ultima_consulta"),
        "ultimo_error": estado.get("ultimo_error"),
        "moneda": config.MONEDA,
        "intervalo": config.INTERVALO_SEGUNDOS,
        "wallets": wallets,
        "total_conjunto": sum(w["total"] for w in wallets.values()),
        "aportado_conjunto": sum(w["aportado"] for w in wallets.values()),
    })


@app.route("/api/precios/<simbolo>")
def api_precios(simbolo):
    return jsonify(storage.leer_precios(simbolo, limite=500))


def _validar(clave, valor, limites):
    """Recorta un ajuste a su rango permitido. Devuelve (valor, avisado)."""
    minimo, maximo = limites
    recortado = max(minimo, min(maximo, valor))
    return recortado, recortado != valor


@app.route("/api/ajustes/<wallet>", methods=["GET", "POST"])
def api_ajustes(wallet):
    estado = storage.cargar_estado()
    if wallet not in estado["wallets"]:
        return jsonify({"error": config.texto("wallet_desconocida")}), 400

    if request.method == "GET":
        return jsonify({
            "ajustes": estado["wallets"][wallet]["ajustes"],
            "defecto": config.ajustes_por_defecto(wallet),
            "limites": config.LIMITES,
        })

    entrada = request.json or {}
    avisos = []

    with bot.candado:
        estado = storage.cargar_estado()
        ajustes = estado["wallets"][wallet]["ajustes"]

        # El reparto se define por el lado lotería; el seguro es el resto.
        if "reparto_loteria" in entrada:
            valor, recortado = _validar(
                "reparto_loteria", abs(float(entrada["reparto_loteria"])) / 100,
                config.LIMITES["reparto_loteria"])
            if recortado:
                avisos.append(config.texto("ajuste_reparto", valor=valor * 100))
            ajustes["reparto"] = {"loteria": valor, "seguro": 1 - valor}

        # Porcentajes que la interfaz manda en entero y aquí se guardan en tanto por uno.
        for clave, campo in [("umbral_rebalanceo", "umbral_rebalanceo"),
                             ("max_por_posicion", "max_por_posicion"),
                             ("fraccion_parcial", "fraccion_parcial")]:
            if campo in entrada:
                valor, recortado = _validar(
                    clave, abs(float(entrada[campo])) / 100, config.LIMITES[clave])
                if recortado:
                    avisos.append(config.texto("ajuste_campo_pct", campo=campo, valor=valor * 100))
                ajustes[clave] = valor

        # Estos dos son caídas: siempre negativos, venga como venga el dato.
        # Si alguien manda 28 queriendo decir «una caída del 28 %», se entiende.
        for campo in ["stop_perdida", "caida_desde_maximo"]:
            if campo in entrada:
                valor, recortado = _validar(
                    campo, -abs(float(entrada[campo])), config.LIMITES[campo])
                if recortado:
                    avisos.append(config.texto("ajuste_campo_pct", campo=campo, valor=abs(valor)))
                ajustes[campo] = valor

        if "objetivo_parcial" in entrada:
            valor, recortado = _validar(
                "objetivo_parcial", abs(float(entrada["objetivo_parcial"])),
                config.LIMITES["objetivo_parcial"])
            if recortado:
                avisos.append(config.texto("ajuste_multiplicador", valor=valor))
            ajustes["objetivo_parcial"] = valor

        if "aportacion_importe" in entrada:
            valor, recortado = _validar(
                "aportacion_importe", abs(float(entrada["aportacion_importe"])),
                config.LIMITES["aportacion_importe"])
            if recortado:
                avisos.append(config.texto("ajuste_aportacion", valor=valor))
            ajustes["aportacion_importe"] = valor

        if "aportacion_dias" in entrada:
            valor, recortado = _validar(
                "aportacion_dias", abs(int(entrada["aportacion_dias"])),
                config.LIMITES["aportacion_dias"])
            if recortado:
                avisos.append(config.texto("ajuste_frecuencia", valor=valor))
            ajustes["aportacion_dias"] = valor

        if "interes_anual" in entrada:
            valor, recortado = _validar(
                "interes_anual", abs(float(entrada["interes_anual"])) / 100,
                config.LIMITES["interes_anual"])
            if recortado:
                avisos.append(config.texto("ajuste_interes", valor=valor * 100))
            ajustes["interes_anual"] = valor

        if "cuarentena_dias" in entrada:
            valor, recortado = _validar(
                "cuarentena_dias", abs(int(entrada["cuarentena_dias"])),
                config.LIMITES["cuarentena_dias"])
            if recortado:
                avisos.append(config.texto("ajuste_cuarentena", valor=valor))
            ajustes["cuarentena_dias"] = valor

        if "max_posiciones" in entrada:
            valor, recortado = _validar(
                "max_posiciones", abs(int(entrada["max_posiciones"])),
                config.LIMITES["max_posiciones"])
            if recortado:
                avisos.append(config.texto("ajuste_max_posiciones", valor=valor))
            ajustes["max_posiciones"] = valor

        # Filtros de entrada del escáner: cambian según la wallet (cripto
        # tiene mcap, bróker no), así que solo se tocan los que ya existen
        # en los ajustes de esta wallet.
        for campo in ajustes:
            if not campo.startswith("filtro_") or campo not in entrada:
                continue
            valor, recortado = _validar(campo, abs(float(entrada[campo])), config.LIMITES[campo])
            if recortado:
                avisos.append(config.texto("ajuste_campo", campo=campo, valor=valor))
            ajustes[campo] = valor

        storage.guardar_estado(estado)

    log.info("[%s] Ajustes actualizados: %s", wallet, ajustes)
    return jsonify({"ok": True, "ajustes": ajustes, "avisos": avisos})


@app.route("/api/ajustes/<wallet>/defecto", methods=["POST"])
def api_ajustes_defecto(wallet):
    with bot.candado:
        estado = storage.cargar_estado()
        if wallet not in estado["wallets"]:
            return jsonify({"error": config.texto("wallet_desconocida")}), 400
        estado["wallets"][wallet]["ajustes"] = config.ajustes_por_defecto(wallet)
        storage.guardar_estado(estado)
    log.info("[%s] Ajustes devueltos a los valores por defecto.", wallet)
    return jsonify({"ok": True})


LIMITES_ACTIVO = {"peso": (0.1, 10.0)}


def _id_valido(wallet, id_fuente):
    """Comprueba que la fuente de precios reconoce ese id antes de guardarlo."""
    if wallet == "crypto":
        return bool(scanner.precios_cripto_por_id([id_fuente]))
    return prices.verificar_id_broker(id_fuente)


def _normalizar_activos(wallet, datos_wallet, entrada):
    """
    Valida y normaliza la lista de activos que llega del panel. Todo o nada:
    si algo falla, no se devuelve nada y se explica el motivo.
    Devuelve (lista_normalizada, None) o (None, "mensaje de error").
    """
    if not isinstance(entrada, list) or not entrada:
        return None, config.texto("activos_lista_vacia")

    actuales = {a["simbolo"]: a for a in datos_wallet["activos"]}
    nuevos = []
    vistos = set()

    for fila in entrada:
        simbolo = str(fila.get("simbolo", "")).strip().upper()
        id_fuente = str(fila.get("id", "")).strip()
        if not simbolo or not id_fuente:
            return None, config.texto("activos_falta_campo")
        if simbolo in vistos:
            return None, config.texto("activos_simbolo_repetido", simbolo=simbolo)
        vistos.add(simbolo)

        nombre = str(fila.get("nombre") or simbolo).strip()
        peso, _ = _validar("peso", float(fila.get("peso", 1) or 1), LIMITES_ACTIVO["peso"])

        # Solo hay que comprobar el precio si el activo es nuevo o ha
        # cambiado de identificador: si no, ya sabíamos que funcionaba.
        previo = actuales.get(simbolo)
        if not previo or previo["id"] != id_fuente:
            if not _id_valido(wallet, id_fuente):
                return None, config.texto("activos_id_invalido", id_fuente=id_fuente)

        nuevos.append({"simbolo": simbolo, "id": id_fuente, "nombre": nombre,
                       "cubo": "seguro", "peso": peso})

    # Los símbolos que desaparecen de la lista no pueden tener posición abierta:
    # el bot nunca vende nada por su cuenta sin que lo pida el usuario.
    for simbolo, activo in actuales.items():
        if simbolo in vistos:
            continue
        posicion = strategy.buscar_posicion(datos_wallet, simbolo)
        if posicion and posicion["cantidad"] > 0:
            return None, config.texto("activos_no_se_puede_quitar", simbolo=simbolo)

    return nuevos, None


@app.route("/api/activos/<wallet>", methods=["GET", "POST"])
def api_activos(wallet):
    estado = storage.cargar_estado()
    if wallet not in estado["wallets"]:
        return jsonify({"error": config.texto("wallet_desconocida")}), 400

    if request.method == "GET":
        return jsonify({
            "activos": estado["wallets"][wallet]["activos"],
            "defecto": config.ACTIVOS[wallet],
        })

    with bot.candado:
        estado = storage.cargar_estado()
        datos_wallet = estado["wallets"][wallet]
        nuevos, error = _normalizar_activos(wallet, datos_wallet, (request.json or {}).get("activos"))
        if error:
            return jsonify({"error": error}), 400
        datos_wallet["activos"] = nuevos
        storage.guardar_estado(estado)

    log.info("[%s] Lista de activos actualizada: %s", wallet,
             [a["simbolo"] for a in nuevos])
    return jsonify({"ok": True, "activos": nuevos})


@app.route("/api/activos/<wallet>/defecto", methods=["POST"])
def api_activos_defecto(wallet):
    with bot.candado:
        estado = storage.cargar_estado()
        if wallet not in estado["wallets"]:
            return jsonify({"error": config.texto("wallet_desconocida")}), 400
        datos_wallet = estado["wallets"][wallet]
        nuevos, error = _normalizar_activos(
            wallet, datos_wallet, [dict(a) for a in config.ACTIVOS[wallet]])
        if error:
            return jsonify({"error": error}), 400
        datos_wallet["activos"] = nuevos
        storage.guardar_estado(estado)
    log.info("[%s] Activos devueltos a los valores por defecto.", wallet)
    return jsonify({"ok": True, "activos": nuevos})


@app.route("/api/reponer", methods=["POST"])
def api_reponer():
    """
    Reposición manual del cubo lotería. A propósito NO es automática:
    es la decisión donde se rompe la disciplina, así que la toma el usuario.
    """
    datos = request.json or {}
    wallet = datos.get("wallet")
    importe = float(datos.get("importe", 0))

    with bot.candado:
        estado = storage.cargar_estado()
        if wallet not in estado["wallets"]:
            return jsonify({"error": config.texto("wallet_desconocida")}), 400

        w = estado["wallets"][wallet]
        disponible = strategy.valor_cubo(estado, wallet, "seguro")
        minima = strategy.orden_minima(wallet)
        if importe <= 0:
            return jsonify({"error": config.texto("reponer_importe_invalido")}), 400
        if importe > disponible:
            return jsonify({
                "error": config.texto("reponer_sin_fondos", disponible=disponible)}), 400
        if importe < minima:
            return jsonify({
                "error": config.texto("reponer_bajo_minimo", minima=minima)}), 400

        # El cubo seguro está invertido, así que hay que vender para sacar
        # el efectivo. Se recorta proporcionalmente de cada posición.
        if not strategy.liberar_efectivo_seguro(estado, wallet, importe):
            return jsonify({"error": config.texto("reponer_fallo_liberar")}), 400

        importe = min(importe, w["efectivo"]["seguro"])
        w["efectivo"]["seguro"] -= importe
        w["efectivo"]["loteria"] += importe
        w["repuesto"] += importe
        storage.registrar_reposicion(wallet, importe)
        storage.guardar_estado(estado)

    log.info("[%s] Reposición manual de %.2f € al cubo lotería.", wallet, importe)
    return jsonify({"ok": True, "repuesto_total": w["repuesto"]})


@app.route("/api/bot", methods=["POST"])
def api_bot():
    """Activar o parar el bot sin cerrar el programa."""
    activo = bool(request.json.get("activo", True))

    # Primero el cambio en memoria: surte efecto ya, aunque el bot esté
    # ocupado leyendo precios.
    bot.poner_activo(activo)

    # Después se intenta guardar en disco. Si el bot tiene el cerrojo, no se
    # espera: él mismo lo persistirá al terminar su ciclo.
    if bot.candado.acquire(timeout=1.0):
        try:
            estado = storage.cargar_estado()
            estado["bot_activo"] = activo
            storage.guardar_estado(estado)
        finally:
            bot.candado.release()

    log.info("Bot %s desde la interfaz.", "activado" if activo else "parado")
    return jsonify({"bot_activo": activo})