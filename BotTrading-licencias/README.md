# Servidor de licencias de BotTrading

Proyecto aparte, no se vende ni se reparte junto con BotTrading. Es lo que
revoca o confirma las claves de las copias vendidas.

No es antipiratería de verdad (eso no existe en Python sin más). Lo que
aporta: poder cortarle el acceso a una copia concreta, y saber cuántas hay
activas. BotTrading, si no tiene nada de esto configurado, arranca igual de
siempre — esto es opt-in, solo para copias que se vendan.

## Probarlo en local

```
pip install -r requirements.txt
python servidor.py
```

Arranca en `http://127.0.0.1:8787`. Crear una clave de prueba:

```
python gestionar.py crear "Prueba"
```

Y en la copia de BotTrading que quieras probar, en `config.py`:

```python
SERVIDOR_LICENCIAS = "http://127.0.0.1:8787"
```

y guardar la clave que te imprimió `gestionar.py` en `data/licencia.txt`.

## Gestionar claves

```
python gestionar.py crear "Nombre del comprador" --nota "venta Gumroad #3"
python gestionar.py listar
python gestionar.py revocar BT-XXXX-XXXX-XXXX-XXXX
python gestionar.py reactivar BT-XXXX-XXXX-XXXX-XXXX
```

## Pasar esto a internet (pendiente)

Para que las copias vendidas puedan comprobar su licencia de verdad, este
servidor tiene que vivir en algún sitio con URL pública — Render, Railway o
PythonAnywhere tienen capa gratuita y les vale de sobra para este volumen
(es una app Flask + SQLite, sin nada especial). Elegir plataforma y desplegar
es una decisión y una cuenta de Guille, no algo que se pueda dejar hecho de
antemano.

Mientras tanto, `SERVIDOR_LICENCIAS = ""` en cada copia que no se haya
vendido (incluida la personal) para que esto no afecte a nadie.
