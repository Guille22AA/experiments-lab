#!/usr/bin/env bash
# One-time setup of a fresh Debian 12 server (Google Cloud e2-micro) for the app.
#
# Run it on the server (from the browser "SSH" window), as explained in docs/DEPLOY.md:
#   curl -fsSL https://raw.githubusercontent.com/Guille22AA/experiments-lab/main/app-menus-comida/deploy/setup-server.sh \
#     | sudo bash -s -- <name>.duckdns.org <duckdns-token>
#
# What it does:
#   1. Swap file (the machine has only 1 GB of RAM).
#   2. Installs Node.js 22, git, sqlite3 and Caddy (web server with automatic HTTPS).
#   3. Keeps <name>.duckdns.org pointing at this server's IP.
#   4. Downloads the app (only the app-menus-comida folder) and builds it.
#   5. Creates backend/.env, asking for the Gemini key.
#   6. Runs the app as a system service (starts on boot, restarts if it fails).
#   7. Caddy: HTTPS on the domain, forwarding to the app.
#   8. Daily database backup (last 14 days kept) and automatic security updates.
# Running it again is safe: finished steps are skipped or refreshed.
set -euo pipefail

DOMAIN="${1:?Uso: setup-server.sh <nombre>.duckdns.org <token-de-duckdns>}"
DUCKDNS_TOKEN="${2:?Falta el token de DuckDNS}"
DUCKDNS_NAME="${DOMAIN%%.duckdns.org}"

REPO_URL="https://github.com/Guille22AA/experiments-lab.git"
BASE_DIR="/opt/menus"
APP_DIR="$BASE_DIR/app-menus-comida"
APP_USER="menus"

step() { echo; echo "==> $*"; }

[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo."; exit 1; }

step "1/8 Memoria de intercambio (swap)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "2/8 Instalando Node.js 22, git, sqlite3 y Caddy"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git sqlite3 build-essential python3 ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
echo "Node $(node -v), Caddy $(caddy version | cut -d' ' -f1)"

step "3/8 DuckDNS: $DOMAIN apuntando a este servidor"
cat > /usr/local/bin/duckdns-update <<EOF
#!/bin/sh
# Tells DuckDNS this server's current IP (empty ip= means "the IP of this request").
curl -fsS "https://www.duckdns.org/update?domains=$DUCKDNS_NAME&token=$DUCKDNS_TOKEN&ip=" >/dev/null
EOF
chmod 700 /usr/local/bin/duckdns-update
echo "*/5 * * * * root /usr/local/bin/duckdns-update" > /etc/cron.d/duckdns
/usr/local/bin/duckdns-update || echo "Aviso: DuckDNS no ha respondido; se reintentará cada 5 minutos."

step "4/8 Descargando la app"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
if [ ! -d "$BASE_DIR/.git" ]; then
  # Only the app folder of the experiments-lab repository.
  git clone --quiet --filter=blob:none --sparse "$REPO_URL" "$BASE_DIR"
  git -C "$BASE_DIR" sparse-checkout set app-menus-comida
fi
chown -R "$APP_USER:$APP_USER" "$BASE_DIR"

step "5/8 Configuración (backend/.env)"
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  GEMINI_KEY=""
  # The script arrives through a pipe, so the question is read from the terminal.
  if [ -r /dev/tty ]; then
    read -r -p "Pega tu clave de Gemini (o deja vacío para ponerla luego): " GEMINI_KEY < /dev/tty || true
  fi
  cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
  sed -i \
    -e 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' \
    -e 's/^TRUST_PROXY=.*/TRUST_PROXY=true/' \
    -e 's/^HOST=.*/HOST=127.0.0.1/' \
    -e "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$GEMINI_KEY|" \
    "$ENV_FILE"
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE" # only the app user can read the key
else
  echo "Ya existe; no se toca."
fi

step "6/8 Instalando dependencias y construyendo la app (tarda unos minutos)"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent"

cat > /etc/systemd/system/menus.service <<EOF
[Unit]
Description=Despensa y menús
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node --env-file=.env src/server.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5
# Hardening: the app can only write to its data folder.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/backend/data

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now menus.service >/dev/null
systemctl restart menus.service

step "7/8 HTTPS con Caddy en https://$DOMAIN"
cat > /etc/caddy/Caddyfile <<EOF
# Caddy gets and renews the HTTPS certificate by itself.
$DOMAIN {
  encode gzip
  header Strict-Transport-Security "max-age=31536000"
  reverse_proxy 127.0.0.1:3001
}
EOF
systemctl reload caddy || systemctl restart caddy

step "8/8 Copias de seguridad diarias y actualizaciones de seguridad"
mkdir -p /var/backups/menus
cat > /etc/cron.daily/menus-backup <<EOF
#!/bin/sh
# Consistent copy of the database (safe while the app is running); keeps 14 days.
sqlite3 "$APP_DIR/backend/data/app.db" ".backup '/var/backups/menus/app-\$(date +%F).db'" 2>/dev/null
find /var/backups/menus -name 'app-*.db' -mtime +14 -delete
EOF
chmod 755 /etc/cron.daily/menus-backup
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades

sleep 3
if systemctl is-active --quiet menus.service; then
  echo
  echo "Listo. Abre https://$DOMAIN (el certificado puede tardar un minuto la primera vez)."
else
  echo
  echo "La app no ha arrancado. Mira el error con: sudo journalctl -u menus -n 50"
fi
