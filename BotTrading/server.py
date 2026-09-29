"""
Servidor web local. Solo escucha en 127.0.0.1, no es accesible desde fuera.
Es una vista del estado: cerrar el navegador no afecta al bot.
"""
import logging

from flask import Flask, jsonify, render_template, request

import bot
import config
import storage
import strategy

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
    return render_template("index.html", v=_version_estatica())


@app.after_request
def _sin_cache(respuesta):
    if request.path.startswith("/static/"):
        respuesta.headers["Cache-Control"] = "no-cache, must-revalidate"
    return respuesta


@app.route("/api/estado")
def api_estado():
    estado = storage.cargar_estado()

    wallets = {}
    for nombre in estado["wallets"]:
        datos = estado["wallets"][nombre]
        total, seguro, loteria = bot.valor_wallet(estado, nombre)
        invertido = seguro + loteria
        objetivo = datos["ajustes"]["reparto"]

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
                for activo in config.ACTIVOS[nombre]
            ],
            "historial": storage.leer_operaciones(nombre, limite=50),
            "grafica": storage.leer_saldos(nombre, limite=500),
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
        return jsonify({"error": "wallet desconocida"}), 400

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
                avisos.append(f"El reparto de lotería se ajustó a {valor*100:.0f} %.")
            ajustes["reparto"] = {"loteria": valor, "seguro": 1 - valor}

        # Porcentajes que la interfaz manda en entero y aquí se guardan en tanto por uno.
        for clave, campo in [("umbral_rebalanceo", "umbral_rebalanceo"),
                             ("max_por_posicion", "max_por_posicion"),
                             ("fraccion_parcial", "fraccion_parcial")]:
            if campo in entrada:
                valor, recortado = _validar(
                    clave, abs(float(entrada[campo])) / 100, config.LIMITES[clave])
                if recortado:
                    avisos.append(f"«{campo}» se ajustó a {valor*100:.0f} %.")
                ajustes[clave] = valor

        # Estos dos son caídas: siempre negativos, venga como venga el dato.
        # Si alguien manda 28 queriendo decir «una caída del 28 %», se entiende.
        for campo in ["stop_perdida", "caida_desde_maximo"]:
            if campo in entrada:
                valor, recortado = _validar(
                    campo, -abs(float(entrada[campo])), config.LIMITES[campo])
                if recortado:
                    avisos.append(f"«{campo}» se ajustó a {abs(valor):.0f} %.")
                ajustes[campo] = valor

        if "objetivo_parcial" in entrada:
            valor, recortado = _validar(
                "objetivo_parcial", abs(float(entrada["objetivo_parcial"])),
                config.LIMITES["objetivo_parcial"])
            if recortado:
                avisos.append(f"El multiplicador se ajustó a {valor}x.")
            ajustes["objetivo_parcial"] = valor

        if "aportacion_importe" in entrada:
            valor, recortado = _validar(
                "aportacion_importe", abs(float(entrada["aportacion_importe"])),
                config.LIMITES["aportacion_importe"])
            if recortado:
                avisos.append(f"La aportación se ajustó a {valor:.2f} €.")
            ajustes["aportacion_importe"] = valor

        if "aportacion_dias" in entrada:
            valor, recortado = _validar(
                "aportacion_dias", abs(int(entrada["aportacion_dias"])),
                config.LIMITES["aportacion_dias"])
            if recortado:
                avisos.append(f"La frecuencia se ajustó a {valor} días.")
            ajustes["aportacion_dias"] = valor

        if "interes_anual" in entrada:
            valor, recortado = _validar(
                "interes_anual", abs(float(entrada["interes_anual"])) / 100,
                config.LIMITES["interes_anual"])
            if recortado:
                avisos.append(f"El interés se ajustó a {valor*100:.2f} %.")
            ajustes["interes_anual"] = valor

        if "cuarentena_dias" in entrada:
            valor, recortado = _validar(
                "cuarentena_dias", abs(int(entrada["cuarentena_dias"])),
                config.LIMITES["cuarentena_dias"])
            if recortado:
                avisos.append(f"La cuarentena se ajustó a {valor} días.")
            ajustes["cuarentena_dias"] = valor

        if "max_posiciones" in entrada:
            valor, recortado = _validar(
                "max_posiciones", abs(int(entrada["max_posiciones"])),
                config.LIMITES["max_posiciones"])
            if recortado:
                avisos.append(f"El máximo de posiciones se ajustó a {valor}.")
            ajustes["max_posiciones"] = valor

        storage.guardar_estado(estado)

    log.info("[%s] Ajustes actualizados: %s", wallet, ajustes)
    return jsonify({"ok": True, "ajustes": ajustes, "avisos": avisos})


@app.route("/api/ajustes/<wallet>/defecto", methods=["POST"])
def api_ajustes_defecto(wallet):
    with bot.candado:
        estado = storage.cargar_estado()
        if wallet not in estado["wallets"]:
            return jsonify({"error": "wallet desconocida"}), 400
        estado["wallets"][wallet]["ajustes"] = config.ajustes_por_defecto(wallet)
        storage.guardar_estado(estado)
    log.info("[%s] Ajustes devueltos a los valores por defecto.", wallet)
    return jsonify({"ok": True})


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
            return jsonify({"error": "wallet desconocida"}), 400

        w = estado["wallets"][wallet]
        disponible = strategy.valor_cubo(estado, wallet, "seguro")
        minima = strategy.orden_minima(wallet)
        if importe <= 0:
            return jsonify({"error": "el importe debe ser mayor que cero"}), 400
        if importe > disponible:
            return jsonify({
                "error": f"solo hay {disponible:.2f} € en el cubo seguro"}), 400
        if importe < minima:
            return jsonify({
                "error": f"en esta wallet la orden mínima es de {minima:.0f} € "
                         f"(la comisión se comería una más pequeña)"}), 400

        # El cubo seguro está invertido, así que hay que vender para sacar
        # el efectivo. Se recorta proporcionalmente de cada posición.
        if not strategy.liberar_efectivo_seguro(estado, wallet, importe):
            return jsonify({"error": "no se pudo liberar ese importe"}), 400

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