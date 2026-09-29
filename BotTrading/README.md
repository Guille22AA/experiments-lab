# Bot de trading — panel local (paso 1)

Proyecto personal, uso local, **solo dinero simulado**.

## Qué hace ahora mismo

Nada de comprar ni vender. Este paso monta la base:

- Un bot que consulta precios reales cada 5 minutos (Bitcoin, Ethereum, S&P 500, oro).
- Guarda su estado en disco de forma segura y lo retoma si lo apagas.
- Guarda todo el historial en una base de datos que no se borra nunca.
- Un panel en el navegador con las dos wallets (cripto y bróker) lado a lado.

## Cómo arrancarlo

```
pip install -r requirements.txt
python run.py
```

Se abre solo en http://127.0.0.1:5000

Cerrar el navegador no para el bot. Para pararlo del todo, cierra la ventana
de la consola o pulsa Ctrl+C. También hay un botón de pausa en el panel.

## Arranque automático al encender el PC

Una sola vez, desde la carpeta del proyecto:

```
.\instalar-arranque.ps1
```

A partir de ahí arranca solo dos minutos después de iniciar sesión, sin
ventana de consola. El retardo evita que la primera lectura de precios falle
por no haber conexión todavía.

- `panel.bat` — abre el panel; si el bot no está en marcha, lo arranca
- `parar.bat` — detiene el bot por completo
- `.\desinstalar-arranque.ps1` — quita el arranque automático

No se pueden arrancar dos copias a la vez: si el puerto ya está ocupado, la
segunda se cierra sola en lugar de operar sobre el mismo estado.

## Clave de CoinGecko (precios de cripto)

CoinGecko empezó a exigir una clave gratuita ("Demo API key") incluso para
uso público. Sin ella, las peticiones fallan con un error 403.

1. Crea una cuenta gratis en https://www.coingecko.com/en/developers/dashboard
   (no pide tarjeta) y genera una "Demo API Key".
2. Guarda esa clave en un archivo nuevo `data/coingecko_key.txt`, solo con la
   clave dentro, sin comillas ni nada más.

El bot la recoge sola en el siguiente ciclo, sin reiniciar nada. Si el
archivo no existe, sigue intentando sin clave por si CoinGecko volviera a
permitirlo.

## Dónde están los datos

Todo dentro de `data/`:

- `estado.json` — la foto del momento actual. Se sobreescribe.
- `historial.sqlite` — todo lo que ha pasado. **No se borra.**
- `backups/` — una copia del estado por día, automática.
- `logs/` — registro técnico. Se borra solo a los 30 días.

## Siguientes pasos

2. Cubo seguro con rebalanceo automático al alza.
3. Cubo lotería con reglas de entrada y salida.
4. Arranque automático al encender el PC.
5. (Fase 2) Dinero real, confirmación de retiradas, seguridad.
