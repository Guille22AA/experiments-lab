"""
La estrategia.

Paso 2 — solo el cubo seguro:

  1. Reparte el 85 % de la wallet entre los activos seguros, a partes iguales.
  2. Vigila la desviación. Si un activo se aleja de su objetivo más que el
     umbral, compra o vende hasta devolverlo a su sitio.
  3. El 15 % restante se queda en efectivo, reservado para el cubo lotería
     (que llega en el paso 3).

El rebalanceo dentro del cubo seguro es simétrico: vende un poco de lo que
sube y compra un poco de lo que baja. No predice nada, solo mantiene el
reparto que se decidió.

Aparte, y esto sí es asimétrico a propósito: si el cubo lotería crece por
encima de su objetivo, se vende el exceso. Si encoge, NO se repone sola.
Esa es la regla que limita la pérdida máxima del cubo arriesgado.
"""
import logging
import math
from datetime import datetime, timedelta, timezone

import config
import storage

log = logging.getLogger("bot")


def ajustes(estado, wallet):
    """Los ajustes vivos de una wallet. Nunca se leen de config directamente."""
    return estado["wallets"][wallet]["ajustes"]


# --- Utilidades --------------------------------------------------------
def precio_de(estado, simbolo):
    dato = estado["precios"].get(simbolo)
    return dato["precio"] if dato else None


def deslizamiento(wallet, cubo):
    """
    Cuánto peor es el precio real respecto al que se ve en pantalla.
    Nunca se compra al precio de la pantalla: hay horquilla, y en activos
    pequeños la propia orden mueve el precio en tu contra.
    """
    return config.DESLIZAMIENTO[wallet][cubo]


def comision(wallet, importe):
    reglas = config.COMISION[wallet]
    if reglas["tipo"] == "fijo":
        return reglas["valor"]
    return max(importe * reglas["valor"], reglas["minimo"])


def mercado_abierto(wallet):
    if not config.SOLO_DIAS_HABILES.get(wallet):
        return True
    return datetime.now().weekday() < 5


def buscar_posicion(datos, simbolo):
    for p in datos["posiciones"]:
        if p["simbolo"] == simbolo:
            return p
    return None


def valor_posicion(estado, posicion):
    precio = precio_de(estado, posicion["simbolo"]) or posicion["precio_entrada"]
    return posicion["cantidad"] * precio


def valor_cubo(estado, wallet, cubo):
    """Valor de un cubo = su efectivo sin invertir + sus posiciones."""
    datos = estado["wallets"][wallet]
    invertido = sum(valor_posicion(estado, p)
                    for p in datos["posiciones"] if p["cubo"] == cubo)
    return datos["efectivo"][cubo] + invertido


def valor_invertido(estado, wallet, cubo):
    datos = estado["wallets"][wallet]
    return sum(valor_posicion(estado, p)
               for p in datos["posiciones"] if p["cubo"] == cubo)


def valor_total(estado, wallet):
    datos = estado["wallets"][wallet]
    return (sum(datos["efectivo"].values())
            + sum(valor_posicion(estado, p) for p in datos["posiciones"]))


# --- Ejecución de órdenes ---------------------------------------------
def comprar(estado, wallet, simbolo, cubo, importe, motivo, id_fuente=None):
    """Compra por un importe en euros. La comisión sale aparte del efectivo."""
    datos = estado["wallets"][wallet]
    precio = precio_de(estado, simbolo)
    if not precio:
        return False

    bolsillo = datos["efectivo"][cubo]
    fee = comision(wallet, importe)
    if importe + fee > bolsillo:
        importe = bolsillo - comision(wallet, bolsillo)
        if importe < config.OPERACION_MINIMA:
            return False
        fee = comision(wallet, importe)

    if fee > importe * config.COSTE_MAXIMO_OPERACION:
        log.info("[%s] Descartada compra de %s por %.2f €: la comisión sería "
                 "el %.1f %% del importe.", wallet, simbolo, importe,
                 fee / importe * 100)
        return False

    # Se compra un poco más caro que el precio de pantalla.
    desliz = deslizamiento(wallet, cubo)
    precio_real = precio * (1 + desliz)
    cantidad = importe / precio_real
    datos["efectivo"][cubo] -= importe + fee
    datos["comisiones"] += fee
    datos["deslizamiento"] = datos.get("deslizamiento", 0.0) + importe * desliz

    posicion = buscar_posicion(datos, simbolo)
    if posicion:
        # Precio medio ponderado: mezcla la compra nueva con lo que ya había.
        total_cantidad = posicion["cantidad"] + cantidad
        posicion["precio_entrada"] = (
            posicion["cantidad"] * posicion["precio_entrada"] + cantidad * precio_real
        ) / total_cantidad
        posicion["cantidad"] = total_cantidad
        posicion["importe"] += importe
    else:
        datos["posiciones"].append({
            "simbolo": simbolo,
            "id_fuente": id_fuente or simbolo,
            "cubo": cubo,
            "cantidad": cantidad,
            "precio_entrada": precio_real,
            "precio_maximo": precio_real,      # para la salida por desplome
            "parcial_hecho": False,       # si ya se recogió la mitad al 2x
            "importe": importe,
            "abierta": storage.ahora(),
        })

    storage.registrar_operacion(
        wallet, cubo, "compra", simbolo, cantidad, precio_real, importe, fee,
        None, None, motivo,
    )
    log.info("[%s] COMPRA %s por %.2f € (%s)", wallet, simbolo, importe, motivo)
    return True


def vender(estado, wallet, simbolo, importe, motivo):
    """Vende por un importe en euros. Si pide más de lo que hay, vende todo."""
    datos = estado["wallets"][wallet]
    posicion = buscar_posicion(datos, simbolo)
    precio = precio_de(estado, simbolo)
    if not posicion or not precio:
        return False

    desliz = deslizamiento(wallet, posicion["cubo"])
    precio_real = precio * (1 - desliz)
    valor_total = posicion["cantidad"] * precio_real
    importe = min(importe, valor_total)

    # El mínimo protege de operaciones ridículas, pero NUNCA debe impedir
    # cerrar una posición entera: si no, una que se hunde queda atrapada.
    cierre_total = importe >= valor_total - 0.001
    if valor_total <= 0:
        return False
    if not cierre_total:
        if importe < config.OPERACION_MINIMA:
            return False
        if comision(wallet, importe) > importe * config.COSTE_MAXIMO_OPERACION:
            log.info("[%s] Descartada venta parcial de %s por %.2f €: comisión "
                     "demasiado alta para ese importe.", wallet, simbolo, importe)
            return False

    proporcion = importe / valor_total
    cantidad = posicion["cantidad"] * proporcion
    coste = posicion["importe"] * proporcion       # lo que costó esa parte
    fee = comision(wallet, importe)

    pl_abs = importe - coste - fee
    pl_pct = (pl_abs / coste) * 100 if coste else None

    datos["efectivo"][posicion["cubo"]] += max(importe - fee, 0.0)
    datos["comisiones"] += fee
    datos["deslizamiento"] = datos.get("deslizamiento", 0.0) + importe * desliz
    posicion["cantidad"] -= cantidad
    posicion["importe"] -= coste

    # Si queda una miga irrelevante, se cierra la posición del todo.
    if posicion["cantidad"] * precio_real < 0.01:
        datos["posiciones"].remove(posicion)
        # Al cerrar una apuesta, el activo queda vetado unos días. Sin esto,
        # un token que salta por stop y sigue pasando los filtros se recompra
        # en el ciclo siguiente y se entra en un bucle de comisiones.
        if posicion["cubo"] == "loteria":
            dias = ajustes(estado, wallet).get("cuarentena_dias", 0)
            if dias > 0:
                hasta = datetime.now(timezone.utc) + timedelta(days=dias)
                datos.setdefault("cuarentena", {})[simbolo] = hasta.isoformat(
                    timespec="seconds")

    # El contador de aciertos es solo del cubo lotería: en el cubo seguro
    # las ventas son rebalanceo, no apuestas, y contarlas no diría nada.
    if posicion["cubo"] == "loteria":
        if pl_abs > 0:
            datos["aciertos"] += 1
        else:
            datos["fallos"] += 1

    storage.registrar_operacion(
        wallet, posicion["cubo"], "venta", simbolo, cantidad, precio_real, importe, fee,
        pl_pct, pl_abs, motivo,
    )
    log.info("[%s] VENTA %s por %.2f € (%+.1f %%) (%s)",
             wallet, simbolo, importe, pl_pct or 0, motivo)
    return True


# --- Rebalanceo entre cubos -------------------------------------------
def recortar_loteria(estado, wallet):
    """
    Si el cubo lotería ha crecido por encima de su objetivo, se vende el
    exceso y ese dinero pasa al cubo seguro. Es recoger ganancias.

    Solo actúa hacia arriba. Si el cubo ha encogido no se hace nada:
    reponerlo es decisión manual, y así la pérdida queda acotada a lo que
    se le asignó. Esta asimetría es deliberada.
    """
    datos = estado["wallets"][wallet]
    total = valor_total(estado, wallet)
    if total <= 0:
        return

    objetivo = total * ajustes(estado, wallet)["reparto"]["loteria"]
    actual = valor_cubo(estado, wallet, "loteria")
    exceso = actual - objetivo

    if exceso / total <= ajustes(estado, wallet)["umbral_rebalanceo"]:
        return

    # Primero se usa el efectivo del propio cubo, sin vender nada.
    desde_efectivo = min(exceso, datos["efectivo"]["loteria"])
    if desde_efectivo > 0:
        datos["efectivo"]["loteria"] -= desde_efectivo
        datos["efectivo"]["seguro"] += desde_efectivo
        exceso -= desde_efectivo
        log.info("[%s] %.2f € pasan de lotería a seguro (recogida de ganancias)",
                 wallet, desde_efectivo)

    if exceso < config.OPERACION_MINIMA:
        return

    # Si aún sobra, se recorta proporcionalmente de cada posición.
    invertido = valor_invertido(estado, wallet, "loteria")
    if invertido <= 0:
        return

    for posicion in list(p for p in datos["posiciones"] if p["cubo"] == "loteria"):
        valor = valor_posicion(estado, posicion)
        parte = exceso * (valor / invertido)
        # Si el recorte se lleva casi toda la posición, se cierra entera:
        # dejar una miga de dos euros solo sirve para pagar otra comisión.
        if parte >= valor * 0.9:
            parte = valor
        if parte >= config.OPERACION_MINIMA or parte >= valor:
            motivo = ("cierre del cubo lotería" if objetivo <= 0
                      else "recogida de ganancias: el cubo lotería creció de más")
            vender(estado, wallet, posicion["simbolo"], parte, motivo)

    # Lo liberado por esas ventas se traslada al cubo seguro.
    sobrante = valor_cubo(estado, wallet, "loteria") - objetivo
    traslado = min(max(sobrante, 0.0), datos["efectivo"]["loteria"])
    if traslado > 0:
        datos["efectivo"]["loteria"] -= traslado
        datos["efectivo"]["seguro"] += traslado


# --- Rebalanceo dentro del cubo seguro --------------------------------
def ajustar_seguro(estado, wallet):
    """
    Lleva cada activo seguro de vuelta a su peso objetivo dentro del cubo.
    Simétrico: vende un poco de lo que sube, compra un poco de lo que baja.
    No predice nada, solo mantiene el reparto decidido.
    """
    datos = estado["wallets"][wallet]
    activos = [a for a in config.activos_de(estado, wallet, "seguro")
               if precio_de(estado, a["simbolo"]) is not None]
    if not activos:
        return

    presupuesto = valor_cubo(estado, wallet, "seguro")
    objetivo_activo = presupuesto / len(activos)
    if objetivo_activo < config.OPERACION_MINIMA:
        return

    ordenes = []
    for activo in activos:
        simbolo = activo["simbolo"]
        posicion = buscar_posicion(datos, simbolo)
        actual = valor_posicion(estado, posicion) if posicion else 0.0
        desviacion = (actual - objetivo_activo) / presupuesto
        if abs(desviacion) > ajustes(estado, wallet)["umbral_rebalanceo"]:
            ordenes.append((simbolo, actual - objetivo_activo, posicion is None))

    # Las ventas primero: liberan efectivo para las compras de después.
    for simbolo, diferencia, es_nueva in sorted(ordenes, key=lambda o: -o[1]):
        if diferencia > 0:
            vender(estado, wallet, simbolo, diferencia,
                   "rebalanceo: subió por encima de su peso")
        else:
            importe = min(-diferencia, datos["efectivo"]["seguro"])
            if importe >= config.OPERACION_MINIMA:
                motivo = ("inversión inicial del cubo seguro" if es_nueva
                          else "rebalanceo: bajó por debajo de su peso")
                comprar(estado, wallet, simbolo, "seguro", importe, motivo)


def liberar_efectivo_seguro(estado, wallet, importe):
    """
    Vende parte del cubo seguro para conseguir efectivo.

    Vende de la posición más grande cada vez, no un trozo de cada una: repartir
    genera órdenes diminutas que el mínimo y el filtro de comisión bloquean, y
    además paga una comisión por cada activo en vez de una sola. De paso, tirar
    siempre de la mayor deja el cubo más equilibrado, no menos.

    Solo se usa para la reposición manual del cubo lotería. El bot nunca llama
    a esto por su cuenta.
    """
    datos = estado["wallets"][wallet]
    falta = importe - datos["efectivo"]["seguro"]
    if falta <= 0.01:
        return True

    if valor_invertido(estado, wallet, "seguro") < falta:
        return False

    minima = orden_minima(wallet)

    for _ in range(20):
        if falta <= 0.5:
            break
        posiciones = sorted(
            (p for p in datos["posiciones"] if p["cubo"] == "seguro"),
            key=lambda p: -valor_posicion(estado, p))
        if not posiciones:
            break

        posicion = posiciones[0]
        valor = valor_posicion(estado, posicion)
        # Se pide de más para cubrir la comisión, y nunca menos que la orden
        # mínima ni más de lo que vale la posición.
        pedir = min(max(falta + comision(wallet, falta), minima), valor)

        antes = datos["efectivo"]["seguro"]
        if not vender(estado, wallet, posicion["simbolo"], pedir,
                      "venta para reponer el cubo lotería (decisión manual)"):
            break
        conseguido = datos["efectivo"]["seguro"] - antes
        if conseguido <= 0:
            break
        falta -= conseguido

    return datos["efectivo"]["seguro"] >= importe - 0.5


# --- Cubo lotería: salidas --------------------------------------------
def revisar_salidas(estado, wallet):
    """
    Se revisa antes que nada. Aquí es donde se gana o se pierde de verdad:
    entrar es fácil, salir a tiempo es el problema.
    """
    reglas = ajustes(estado, wallet)
    datos = estado["wallets"][wallet]

    for posicion in list(datos["posiciones"]):
        if posicion["cubo"] != "loteria":
            continue
        precio = precio_de(estado, posicion["simbolo"])
        if not precio:
            continue

        # El máximo alcanzado se actualiza siempre, suba o baje.
        posicion["precio_maximo"] = max(posicion.get("precio_maximo", precio), precio)

        desde_entrada = (precio / posicion["precio_entrada"] - 1) * 100
        desde_maximo = (precio / posicion["precio_maximo"] - 1) * 100
        valor = posicion["cantidad"] * precio

        # 1. Stop de pérdida: se corta y no se discute.
        if desde_entrada <= reglas["stop_perdida"]:
            vender(estado, wallet, posicion["simbolo"], valor,
                   f"stop de pérdida ({desde_entrada:+.0f} %)")
            continue

        # 2. Desplome desde el máximo: subió y se dio la vuelta.
        if desde_maximo <= reglas["caida_desde_maximo"]:
            vender(estado, wallet, posicion["simbolo"], valor,
                   f"se desplomó {desde_maximo:.0f} % desde su máximo")
            continue

        # 3. Toma de beneficios: al doblar, se recoge la mitad.
        #    Recuperas lo puesto y el resto sigue corriendo sin riesgo propio.
        if not posicion.get("parcial_hecho") and \
           precio >= posicion["precio_entrada"] * reglas["objetivo_parcial"]:
            if vender(estado, wallet, posicion["simbolo"],
                      valor * reglas["fraccion_parcial"],
                      f"toma de beneficios: alcanzó {reglas['objetivo_parcial']:.0f}x"):
                posicion["parcial_hecho"] = True


# --- Cubo lotería: entradas -------------------------------------------
def en_cuarentena(estado, wallet):
    """Activos vetados ahora mismo. De paso limpia los que ya caducaron."""
    datos = estado["wallets"][wallet]
    cuarentena = datos.get("cuarentena", {})
    ahora = datetime.now(timezone.utc)
    vigentes = {}
    for simbolo, hasta in cuarentena.items():
        try:
            if datetime.fromisoformat(hasta) > ahora:
                vigentes[simbolo] = hasta
        except (TypeError, ValueError):
            continue
    datos["cuarentena"] = vigentes
    return set(vigentes)


def abrir_posiciones(estado, wallet, candidatos):
    """
    Abre apuestas nuevas usando SOLO el bolsillo del cubo lotería.
    Nunca toca el dinero del cubo seguro: si el bolsillo se vacía, el bot
    deja de apostar hasta que se reponga a mano.
    """
    if not candidatos:
        return

    datos = estado["wallets"][wallet]
    abiertas = [p for p in datos["posiciones"] if p["cubo"] == "loteria"]
    hueco = ajustes(estado, wallet)["max_posiciones"] - len(abiertas)
    if hueco <= 0:
        return

    disponible = datos["efectivo"]["loteria"]
    presupuesto = valor_cubo(estado, wallet, "loteria")
    tamano = min(presupuesto * ajustes(estado, wallet)["max_por_posicion"], disponible)
    if tamano < config.OPERACION_MINIMA:
        return

    ya_tengo = {p["simbolo"] for p in datos["posiciones"]}
    vetados = en_cuarentena(estado, wallet)

    for candidato in candidatos:
        if candidato["simbolo"] in vetados:
            continue
        if hueco <= 0 or datos["efectivo"]["loteria"] < config.OPERACION_MINIMA:
            break
        if candidato["simbolo"] in ya_tengo:
            continue

        estado["precios"][candidato["simbolo"]] = {
            "precio": candidato["precio"], "wallet": wallet, "ts": storage.ahora(),
        }
        importe = min(tamano, datos["efectivo"]["loteria"])
        motivo = (f"entrada: volumen {candidato['actividad']:.1f}x, "
                  f"{candidato['cambio']:+.0f} % en 24 h")
        if comprar(estado, wallet, candidato["simbolo"], "loteria",
                   importe, motivo, id_fuente=candidato.get("id")):
            ya_tengo.add(candidato["simbolo"])
            hueco -= 1


# --- Aportación periódica ---------------------------------------------
def aportacion_periodica(estado, wallet):
    """
    Mete dinero nuevo cada cierto tiempo, como un plan de inversión.
    Comprar una cantidad fija cada X días, sin intentar acertar el momento,
    es de lo poco con respaldo sólido en inversión pasiva.

    Va entera al cubo seguro. Si fuera al de lotería sería una reposición
    automática, y esa puerta se cerró a propósito.
    """
    a = ajustes(estado, wallet)
    importe = a.get("aportacion_importe", 0.0)
    if importe <= 0:
        return

    datos = estado["wallets"][wallet]
    ultima = datos.get("ultima_aportacion")
    ahora = datetime.now(timezone.utc)

    if ultima:
        transcurrido = (ahora - datetime.fromisoformat(ultima)).days
        if transcurrido < a.get("aportacion_dias", 30):
            return
    else:
        # La primera se programa, no se ejecuta al instante.
        datos["ultima_aportacion"] = ahora.isoformat(timespec="seconds")
        return

    datos["efectivo"]["seguro"] += importe
    datos["aportado"] += importe
    datos["ultima_aportacion"] = ahora.isoformat(timespec="seconds")
    storage.registrar_aportacion(wallet, importe)
    log.info("[%s] Aportación periódica de %.2f €.", wallet, importe)


# --- Interés sobre el efectivo parado ---------------------------------
def aplicar_interes(estado, wallet):
    """
    El efectivo sin invertir no está muerto: en una cuenta remunerada o en
    una stablecoin genera algo. Simularlo hace la curva más honesta,
    sobre todo cuando el escáner no encuentra nada y el dinero se queda quieto.
    """
    a = ajustes(estado, wallet)
    tasa = a.get("interes_anual", 0.0)
    if tasa <= 0:
        return

    datos = estado["wallets"][wallet]
    ahora = datetime.now(timezone.utc)
    ultimo = datos.get("ultimo_interes")
    if not ultimo:
        datos["ultimo_interes"] = ahora.isoformat(timespec="seconds")
        return

    segundos = (ahora - datetime.fromisoformat(ultimo)).total_seconds()
    if segundos <= 0:
        return

    proporcion = segundos / (365 * 24 * 3600)
    ganado = 0.0
    for cubo in ("seguro", "loteria"):
        interes = datos["efectivo"][cubo] * tasa * proporcion
        datos["efectivo"][cubo] += interes
        ganado += interes

    datos["intereses"] = datos.get("intereses", 0.0) + ganado
    datos["ultimo_interes"] = ahora.isoformat(timespec="seconds")


# --- Chequeo de viabilidad --------------------------------------------
def orden_minima(wallet):
    """
    Importe por debajo del cual el bot no operará nunca en esta wallet.
    Con comisión fija manda el filtro de coste; con porcentual, el mínimo.
    """
    reglas = config.COMISION[wallet]
    if reglas["tipo"] == "fijo":
        por_coste = reglas["valor"] / config.COSTE_MAXIMO_OPERACION
    else:
        por_coste = config.OPERACION_MINIMA
    return max(por_coste, config.OPERACION_MINIMA)


def diagnostico(estado, wallet):
    """
    Comprueba si la configuración actual puede funcionar con el capital que
    hay. Sin esto, una wallet mal dimensionada se queda inerte y parece
    estropeada en vez de mal configurada.
    """
    a = ajustes(estado, wallet)
    datos = estado["wallets"][wallet]
    total = valor_total(estado, wallet)
    minima = orden_minima(wallet)
    avisos = []

    if total <= 0:
        return avisos

    # ¿Puede comprar el cubo seguro?
    activos = config.activos_de(estado, wallet, "seguro")
    presupuesto = total * a["reparto"]["seguro"]
    if activos:
        pesos = sum(x.get("peso", 1) for x in activos)
        menor = presupuesto * (min(x.get("peso", 1) for x in activos) / pesos)
        if menor < minima:
            necesita = math.ceil(minima * pesos
                                 / min(x.get("peso", 1) for x in activos))
            avisos.append(
                f"El cubo seguro no puede comprar: le tocarían {menor:.0f} € por "
                f"activo y la orden mínima aquí es de {minima:.0f} €. Harían falta "
                f"unos {necesita:.0f} € en esta wallet.")

    # ¿Puede rebalancear?
    trade = presupuesto * a["umbral_rebalanceo"]
    if presupuesto > 0 and trade < minima:
        # Se redondea hacia arriba: sugerir un margen que tampoco llega
        # sería peor que no sugerir nada.
        necesario = math.ceil(minima / presupuesto * 100)
        limite = config.LIMITES["umbral_rebalanceo"][1] * 100
        arreglo = (f"Subiendo el margen al {necesario:.0f} % sí actuaría."
                   if necesario <= limite else
                   f"Ni con el margen máximo del {limite:.0f} % llegaría: "
                   f"esta wallet necesita más capital.")
        avisos.append(
            f"El rebalanceo nunca se ejecutará: un desvío del "
            f"{a['umbral_rebalanceo']*100:.0f} % son {trade:.0f} € y la orden mínima "
            f"es de {minima:.0f} €. {arreglo}")

    # ¿Puede apostar el cubo lotería?
    objetivo_lot = total * a["reparto"]["loteria"]
    if objetivo_lot > 0:
        apuesta = objetivo_lot * a["max_por_posicion"]
        if apuesta < minima:
            avisos.append(
                f"El cubo lotería no puede abrir posiciones: cada apuesta sería de "
                f"{apuesta:.0f} € y la orden mínima es de {minima:.0f} €. Con estas "
                f"comisiones el cubo necesitaría al menos "
                f"{minima / a['max_por_posicion']:.0f} €.")
        elif valor_cubo(estado, wallet, "loteria") < minima:
            avisos.append(
                "El cubo lotería está vacío. El bot no lo rellena solo: usa "
                "«Reponer…» para pasarle dinero desde el cubo seguro.")

    return avisos


# --- Cartera de referencia: comprar y no tocar nada -------------------
def actualizar_referencia(estado, wallet):
    """
    Simula en paralelo qué habría pasado comprando los mismos activos al
    principio y no tocando nada más: sin rebalanceos, sin stops, sin escaneo.

    Es la única forma de responder a la pregunta que importa. Si dentro de
    unos meses las dos curvas van iguales, toda la maquinaria del bot es
    ruido caro y conviene saberlo. No opera: solo calcula.
    """
    datos = estado["wallets"][wallet]
    ref = datos.setdefault("referencia", {"posiciones": {}, "aportado": 0.0})

    activos = [a for a in config.activos_de(estado, wallet, "seguro")
               if precio_de(estado, a["simbolo"])]
    if not activos:
        return

    # Dinero pendiente de invertir en la referencia: el capital inicial la
    # primera vez, y luego cada aportación periódica que reciba la wallet.
    pendiente = datos["aportado"] - ref["aportado"]
    if pendiente > 0.01:
        pesos = sum(a.get("peso", 1) for a in activos)
        for activo in activos:
            parte = pendiente * (activo.get("peso", 1) / pesos)
            precio = precio_de(estado, activo["simbolo"])
            # Paga los mismos costes de entrada que el bot: si no, la
            # comparación estaría trucada a favor de la referencia.
            coste = comision(wallet, parte)
            neto = max(parte - coste, 0.0)
            precio_real = precio * (1 + deslizamiento(wallet, "seguro"))
            ref["posiciones"][activo["simbolo"]] = (
                ref["posiciones"].get(activo["simbolo"], 0.0) + neto / precio_real)
        ref["aportado"] = datos["aportado"]


def valor_referencia(estado, wallet):
    ref = estado["wallets"][wallet].get("referencia")
    if not ref:
        return None
    total = 0.0
    for simbolo, cantidad in ref["posiciones"].items():
        precio = precio_de(estado, simbolo)
        if precio:
            total += cantidad * precio
    return total if ref["posiciones"] else None


# --- Punto de entrada de la estrategia --------------------------------
def ejecutar(estado, wallet, candidatos=None):
    if not mercado_abierto(wallet):
        return
    if not any(precio_de(estado, a["simbolo"]) for a in config.activos_de(estado, wallet)):
        log.warning("[%s] Sin precios válidos, no se opera este ciclo.", wallet)
        return

    aplicar_interes(estado, wallet)      # el efectivo parado renta algo
    aportacion_periodica(estado, wallet) # dinero nuevo si toca
    actualizar_referencia(estado, wallet)  # cartera de comparación, no opera

    revisar_salidas(estado, wallet)      # primero cerrar lo que toque
    recortar_loteria(estado, wallet)     # recortar el exceso si lo hay
    ajustar_seguro(estado, wallet)       # mantener el ancla en su sitio
    abrir_posiciones(estado, wallet, candidatos or [])