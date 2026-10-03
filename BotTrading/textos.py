"""
Todo el texto que ve el usuario, en los idiomas soportados. El español es
exactamente el texto que ya había (la copia personal no cambia ni una
palabra); el inglés usa "core"/"satellite" en vez de "seguro"/"lotería",
que es solo una etiqueta — el dato interno (`cubo: "seguro"/"loteria"`)
no cambia en ningún sitio, ver config.idioma()/config.texto().
"""

TEXTOS = {
    "es": {
        # --- server.py: ajustes --------------------------------------
        "wallet_desconocida": "wallet desconocida",
        "ajuste_reparto": "El reparto de lotería se ajustó a {valor:.0f} %.",
        "ajuste_campo_pct": "«{campo}» se ajustó a {valor:.0f} %.",
        "ajuste_multiplicador": "El multiplicador se ajustó a {valor}x.",
        "ajuste_aportacion": "La aportación se ajustó a {valor:.2f} €.",
        "ajuste_frecuencia": "La frecuencia se ajustó a {valor} días.",
        "ajuste_interes": "El interés se ajustó a {valor:.2f} %.",
        "ajuste_cuarentena": "La cuarentena se ajustó a {valor} días.",
        "ajuste_max_posiciones": "El máximo de posiciones se ajustó a {valor}.",

        # --- server.py: activos ---------------------------------------
        "activos_lista_vacia": "la lista de activos no puede quedar vacía",
        "activos_falta_campo": "cada activo necesita símbolo e identificador",
        "activos_simbolo_repetido": "el símbolo {simbolo} está repetido",
        "activos_id_invalido": "no se encontró precio para «{id_fuente}»; revisa el identificador",
        "activos_no_se_puede_quitar": "no se puede quitar {simbolo}: tiene una posición abierta. "
                                      "Véndela o espera a que el bot la cierre, y vuelve a intentarlo.",

        # --- server.py: reponer -----------------------------------------
        "reponer_importe_invalido": "el importe debe ser mayor que cero",
        "reponer_sin_fondos": "solo hay {disponible:.2f} € en el cubo seguro",
        "reponer_bajo_minimo": "en esta wallet la orden mínima es de {minima:.0f} € "
                               "(la comisión se comería una más pequeña)",
        "reponer_fallo_liberar": "no se pudo liberar ese importe",

        # --- strategy.py: motivos de operación ---------------------------
        "motivo_cierre_loteria": "cierre del cubo lotería",
        "motivo_recogida_ganancias": "recogida de ganancias: el cubo lotería creció de más",
        "motivo_rebalanceo_sube": "rebalanceo: subió por encima de su peso",
        "motivo_inversion_inicial": "inversión inicial del cubo seguro",
        "motivo_rebalanceo_baja": "rebalanceo: bajó por debajo de su peso",
        "motivo_stop_perdida": "stop de pérdida ({desde_entrada:+.0f} %)",
        "motivo_desplome": "se desplomó {desde_maximo:.0f} % desde su máximo",
        "motivo_toma_beneficios": "toma de beneficios: alcanzó {objetivo:.0f}x",
        "motivo_entrada": "entrada: volumen {actividad:.1f}x, {cambio:+.0f} % en 24 h",

        # --- strategy.py: diagnostico() -----------------------------------
        "diag_seguro_no_compra": "El cubo seguro no puede comprar: le tocarían {menor:.0f} € por "
                                 "activo y la orden mínima aquí es de {minima:.0f} €. Harían falta "
                                 "unos {necesita:.0f} € en esta wallet.",
        "diag_margen_subir": "Subiendo el margen al {necesario:.0f} % sí actuaría.",
        "diag_margen_imposible": "Ni con el margen máximo del {limite:.0f} % llegaría: "
                                 "esta wallet necesita más capital.",
        "diag_rebalanceo_nunca": "El rebalanceo nunca se ejecutará: un desvío del {umbral:.0f} % "
                                 "son {trade:.0f} € y la orden mínima es de {minima:.0f} €. {arreglo}",
        "diag_loteria_no_abre": "El cubo lotería no puede abrir posiciones: cada apuesta sería de "
                                "{apuesta:.0f} € y la orden mínima es de {minima:.0f} €. Con estas "
                                "comisiones el cubo necesitaría al menos {necesario:.0f} €.",
        "diag_loteria_vacio": "El cubo lotería está vacío. El bot no lo rellena solo: usa "
                              "«Reponer…» para pasarle dinero desde el cubo seguro.",

        # --- prices.py ----------------------------------------------------
        "error_cripto": "cripto: {e}",
        "error_broker": "bróker: {e}",

        # --- templates/index.html: lo que ya está en el HTML antes de que
        # cargue app.js (que trae su propio TEXTOS para el resto del panel) --
        "titulo_pagina": "Panel local — bot de trading",
        "encabezado": "PANEL LOCAL",
        "conectando": "conectando…",
        "boton_parar_inicial": "Parar bot",
    },
    "en": {
        # --- server.py: settings --------------------------------------
        "wallet_desconocida": "unknown wallet",
        "ajuste_reparto": "The satellite allocation was adjusted to {valor:.0f}%.",
        "ajuste_campo_pct": "\"{campo}\" was adjusted to {valor:.0f}%.",
        "ajuste_multiplicador": "The multiplier was adjusted to {valor}x.",
        "ajuste_aportacion": "The contribution was adjusted to €{valor:.2f}.",
        "ajuste_frecuencia": "The frequency was adjusted to {valor} days.",
        "ajuste_interes": "The interest rate was adjusted to {valor:.2f}%.",
        "ajuste_cuarentena": "The quarantine period was adjusted to {valor} days.",
        "ajuste_max_posiciones": "The maximum number of positions was adjusted to {valor}.",

        # --- server.py: assets ------------------------------------------
        "activos_lista_vacia": "the asset list can't be empty",
        "activos_falta_campo": "each asset needs a symbol and an identifier",
        "activos_simbolo_repetido": "the symbol {simbolo} is duplicated",
        "activos_id_invalido": "no price found for \"{id_fuente}\"; check the identifier",
        "activos_no_se_puede_quitar": "can't remove {simbolo}: it has an open position. "
                                      "Sell it or wait for the bot to close it, then try again.",

        # --- server.py: top up --------------------------------------------
        "reponer_importe_invalido": "the amount must be greater than zero",
        "reponer_sin_fondos": "there's only €{disponible:.2f} in the core bucket",
        "reponer_bajo_minimo": "the minimum order in this wallet is €{minima:.0f} "
                               "(a smaller one would be eaten by fees)",
        "reponer_fallo_liberar": "couldn't free up that amount",

        # --- strategy.py: trade reasons -----------------------------------
        "motivo_cierre_loteria": "closing the satellite bucket",
        "motivo_recogida_ganancias": "profit skim: the satellite bucket grew past its target",
        "motivo_rebalanceo_sube": "rebalance: rose above its target weight",
        "motivo_inversion_inicial": "initial investment into the core bucket",
        "motivo_rebalanceo_baja": "rebalance: fell below its target weight",
        "motivo_stop_perdida": "stop loss ({desde_entrada:+.0f}%)",
        "motivo_desplome": "dropped {desde_maximo:.0f}% from its peak",
        "motivo_toma_beneficios": "profit taking: reached {objetivo:.0f}x",
        "motivo_entrada": "entry: volume {actividad:.1f}x, {cambio:+.0f}% in 24h",

        # --- strategy.py: diagnostico() ------------------------------------
        "diag_seguro_no_compra": "The core bucket can't buy: each asset would get €{menor:.0f} and "
                                 "the minimum order here is €{minima:.0f}. This wallet would need "
                                 "around €{necesita:.0f}.",
        "diag_margen_subir": "Raising the threshold to {necesario:.0f}% would fix it.",
        "diag_margen_imposible": "Even at the maximum threshold of {limite:.0f}% it still wouldn't: "
                                 "this wallet needs more capital.",
        "diag_rebalanceo_nunca": "Rebalancing will never trigger: a {umbral:.0f}% deviation is "
                                 "€{trade:.0f} and the minimum order is €{minima:.0f}. {arreglo}",
        "diag_loteria_no_abre": "The satellite bucket can't open positions: each bet would be "
                                "€{apuesta:.0f} and the minimum order is €{minima:.0f}. With these "
                                "fees the bucket would need at least €{necesario:.0f}.",
        "diag_loteria_vacio": "The satellite bucket is empty. The bot never refills it on its own: "
                              "use \"Top up…\" to move money from the core bucket.",

        # --- prices.py ------------------------------------------------------
        "error_cripto": "crypto: {e}",
        "error_broker": "broker: {e}",

        # --- templates/index.html --------------------------------------------
        "titulo_pagina": "Local panel — trading bot",
        "encabezado": "LOCAL PANEL",
        "conectando": "connecting…",
        "boton_parar_inicial": "Stop bot",
    },
}
