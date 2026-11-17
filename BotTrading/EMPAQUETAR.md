# Construir el .exe vendible

Esto genera `dist/BotTrading.exe`: un único archivo que no necesita Python
instalado ni abrir una terminal para usarlo. Tarda 1-2 minutos.

## Un único paso

```
.venv\Scripts\pip install pyinstaller
.venv\Scripts\pyinstaller BotTrading.spec
```

El resultado queda en `dist\BotTrading.exe`. `build/` y `dist/` no se suben a
git (ver `.gitignore`) — lo único versionado es `BotTrading.spec`, la receta.

## Paso obligatorio: que arranque en inglés

El `.exe` solo no sabe en qué idioma arrancar — sin nada más, arranca en
**español** (el valor por defecto de `config.idioma()`, pensado para que tu
copia personal nunca cambie). Para que la copia que vendes arranque en
inglés sin que el comprador toque nada, el paquete que le das tiene que
incluir, YA CREADO, `data\idioma.txt` con el contenido `en` (sin comillas,
sin BOM — usa el bloc de notas y guarda como "UTF-8", no "UTF-8 con BOM", o
hazlo desde una terminal).

El paquete final para vender es, en una carpeta:
```
BotTrading.exe
data\idioma.txt      (contiene: en)
```
Comprímelo en un .zip y eso es lo que subes a Gumroad/LemonSqueezy. Al
arrancarlo, el propio `.exe` rellena el resto de `data/` solo (estado,
historial, backups) — nunca hace falta crear nada más a mano.

**Compruébalo siempre antes de subir una versión nueva**: descomprime el zip
en una carpeta limpia, ábrelo, y verifica que el panel sale en inglés y que
las wallets arrancan a cero (sin tus datos). Se comprobó así el
2026-10-03 y funcionó de principio a fin, incluyendo añadir un activo y ver
los candidatos del escáner.

## Si algo falla al construir

`pandas` y `yfinance` a veces necesitan módulos que PyInstaller no detecta
solo. El `.spec` ya incluye `collect_submodules` para los dos, que es lo que
lo arregló la primera vez que se construyó aquí (2026-10-03). Si una futura
versión de alguna librería rompe esto otra vez, el síntoma es que el `.exe`
se abre y se cierra solo sin más: reconstruye quitando temporalmente
`--windowed`/`console=False` del `.spec` para ver el error de verdad en una
consola, y añade el módulo que falte a `hiddenimports`.

## Pendiente, no bloqueante

El `.exe` pesa ~50 MB porque `collect_submodules('pandas')` mete también los
tests internos de pandas. Se podría recortar con `excludes` en el `.spec`,
pero no se ha tocado para no arriesgar la build que ya funciona.
