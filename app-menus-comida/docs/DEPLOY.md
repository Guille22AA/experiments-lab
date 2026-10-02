# Subir la app a internet (Google Cloud, gratis)

Resultado: la app en `https://<tu-nombre>.duckdns.org`, con HTTPS, funcionando aunque tu PC esté apagado.

**Coste: 0 €** si sigues los pasos tal cual. Google pide una tarjeta para verificar que eres una persona; lo gratuito
es una máquina **e2-micro** en EE. UU. con **disco estándar de 30 GB**. Lo que cambia el precio es elegir otra
región, otro tamaño de máquina u otro tipo de disco: por eso los pasos insisten en ellos.

Tiempo: unos 30-45 minutos la primera vez.

---

## 1. Cuenta de Google Cloud

1. Entra en <https://console.cloud.google.com> con tu cuenta de Google.
2. Acepta las condiciones y **crea una cuenta de facturación** con tu tarjeta. Te ofrecerán una prueba con crédito
   gratis de 90 días: acéptala.
3. Cuando termine de crearse, busca arriba el aviso **"Activar cuenta completa"** (o en *Facturación*) y actívala.
   Así la máquina no se para cuando acaben los 90 días de prueba. Lo gratuito sigue siéndolo.

## 2. Aviso de gasto (tu red de seguridad)

1. Menú ☰ → **Facturación** → **Presupuestos y alertas** → **Crear presupuesto**.
2. Nombre: `aviso`. Importe: **1 €**. Deja las alertas al 50 %, 90 % y 100 %.
3. Guardar. Si alguna vez algo empezara a costar dinero, te llega un correo.

## 3. Crear la máquina

1. Menú ☰ → **Compute Engine** → **Instancias de VM**. Si te pide habilitar la API, acepta y espera un minuto.
2. **Crear instancia** y rellena **exactamente** esto:

| Campo | Valor |
|---|---|
| Nombre | `menus` |
| Región | **us-east1 (Carolina del Sur)** (también valen us-central1 o us-west1; ninguna otra) |
| Zona | cualquiera de esa región |
| Configuración de máquina | Serie **E2** → tipo **e2-micro** |
| Disco de arranque → Cambiar | Sistema: **Debian**, versión **Debian 12 (bookworm)**. Tipo de disco: **Disco persistente estándar** (¡no "equilibrado"!). Tamaño: **30 GB** |
| Cortafuegos | Marca **Permitir tráfico HTTP** y **Permitir tráfico HTTPS** |

3. A la derecha verás una estimación de precio mensual: es normal que salga algo; el descuento del nivel gratuito
   se aplica después en la factura.
4. **Crear**. En un minuto aparece con una **IP externa**.

## 4. Tu dirección fija (DuckDNS, gratis)

1. Entra en <https://www.duckdns.org> e inicia sesión (con Google o GitHub).
2. En *sub domain* escribe un nombre (por ejemplo `guille-menus`) y pulsa **add domain**.
3. Copia el **token** que aparece arriba (una cadena larga). No hace falta que pongas la IP: el servidor la
   actualiza solo.

## 5. Instalar la app (un solo comando)

1. En *Instancias de VM*, pulsa el botón **SSH** de tu máquina `menus`. Se abre una ventana negra en el navegador.
2. Pega este comando, cambiando el nombre y el token por los tuyos, y pulsa Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/Guille22AA/experiments-lab/main/app-menus-comida/deploy/setup-server.sh | sudo bash -s -- guille-menus.duckdns.org TU_TOKEN_DE_DUCKDNS
   ```

3. Cuando te lo pida, **pega tu clave de Gemini** y pulsa Enter.
4. Espera a que termine (unos 5 minutos). Al final dice **"Listo. Abre https://…"**.

## 6. Usarla

1. Abre `https://guille-menus.duckdns.org` en el móvil. La primera vez el certificado puede tardar un minuto.
2. Crea tu contraseña y haz la entrevista.
3. Añádela a la pantalla de inicio (Chrome: ⋮ → *Añadir a pantalla de inicio*).

Ya no hace falta el PC encendido.

---

## Mantenimiento

Todo se hace desde la ventana **SSH** de la máquina.

| Para… | Comando |
|---|---|
| Actualizar la app a la última versión de GitHub | `sudo bash /opt/menus/app-menus-comida/deploy/update.sh` |
| Ver si está funcionando | `sudo systemctl status menus` |
| Ver los últimos errores | `sudo journalctl -u menus -n 50` |
| Reiniciarla | `sudo systemctl restart menus` |
| Olvidé la contraseña | `cd /opt/menus/app-menus-comida && sudo -u menus npm run reset-password` |
| Cambiar la clave de Gemini | `sudo nano /opt/menus/app-menus-comida/backend/.env` y luego reiniciarla |
| Ver las copias de seguridad | `ls /var/backups/menus` (una al día, se guardan 14 días) |

**Bajarte una copia de tus datos al PC:** en la ventana SSH, rueda dentada ⚙ → *Descargar archivo* →
`/var/backups/menus/app-AAAA-MM-DD.db`.

## Qué instala el script

- **Node.js 22** y la app (solo la carpeta `app-menus-comida` del repositorio), funcionando como servicio: arranca
  sola al encender la máquina y se reinicia si falla.
- **Caddy**: servidor web que consigue y renueva el certificado HTTPS automáticamente y pasa las peticiones a la app.
- **DuckDNS**: cada 5 minutos avisa de la IP del servidor, por si cambia.
- **Copia de seguridad diaria** de la base de datos y **actualizaciones de seguridad automáticas** del sistema.
- 1 GB de memoria de intercambio (la máquina gratuita solo tiene 1 GB de RAM).

La configuración del servidor (`backend/.env`) activa `COOKIE_SECURE` y `TRUST_PROXY`, y la app solo escucha
dentro de la máquina: desde fuera solo se llega a través de Caddy y HTTPS.
