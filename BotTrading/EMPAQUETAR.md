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

## Antes de entregarlo a un comprador

1. **Que arranque en inglés**: copia `dist\BotTrading.exe` a una carpeta
   limpia, créale `data\idioma.txt` con el contenido `en` (sin comillas), y
   compruébalo abriéndolo — el panel tiene que salir en inglés.
2. **Que no lleve tus datos**: la carpeta `dist/` nunca incluye `data/`
   (PyInstaller solo empaqueta código, no esa carpeta), así que un comprador
   siempre arranca con una wallet a cero. No hace falta hacer nada para
   esto, pero compruébalo una vez: en una carpeta limpia, sin `data/` previo,
   el bot debe arrancar con las wallets vacías.
3. **Un solo archivo, nada más**: lo que le mandas al comprador es
   únicamente `BotTrading.exe`. Al arrancarlo por primera vez, él mismo crea
   su carpeta `data/` al lado del `.exe`.

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
