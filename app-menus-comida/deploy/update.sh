#!/usr/bin/env bash
# Updates the app on the server to the latest version on GitHub.
#   sudo /opt/menus/app-menus-comida/deploy/update.sh
# The data (backend/data) and the configuration (backend/.env) are not touched.
set -euo pipefail

BASE_DIR="/opt/menus"
APP_DIR="$BASE_DIR/app-menus-comida"
APP_USER="menus"

[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo."; exit 1; }

echo "==> Copia de seguridad antes de actualizar"
/etc/cron.daily/menus-backup || true

echo "==> Descargando la última versión"
sudo -u "$APP_USER" git -C "$BASE_DIR" pull --ff-only --quiet

echo "==> Instalando dependencias y construyendo"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent"

echo "==> Reiniciando la app"
systemctl restart menus.service
sleep 3
systemctl is-active --quiet menus.service && echo "Actualizada." || echo "No ha arrancado: sudo journalctl -u menus -n 50"
