#!/usr/bin/env bash
set -e

APP_USER="timmi"
APP_DIR="/home/timmi/projects/MDD_Candy"
REPO_URL="https://github.com/timmi/MDD_Candy.git"
SERVICE_FILE="/etc/systemd/system/mdd-candy.service"
CADDYFILE="/etc/caddy/Caddyfile"
DOMAIN="yourdomain.com"
SERVER_PORT=3000

echo "Updating system..."
sudo apt update -y
sudo apt install -y git nodejs npm caddy ufw

echo "Syncing repo..."
if [ ! -d "$APP_DIR" ]; then
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
    sudo -u "$APP_USER" git -C "$APP_DIR" pull
fi

echo "Installing server dependencies..."
sudo -u "$APP_USER" npm --prefix "$APP_DIR/server" install

echo "Installing frontend dependencies..."
sudo -u "$APP_USER" npm --prefix "$APP_DIR/frontend" install

echo "Building frontend..."
sudo -u "$APP_USER" npm --prefix "$APP_DIR/frontend" run build

echo "Building server..."
sudo -u "$APP_USER" npm --prefix "$APP_DIR/server" run build

echo "Initializing database..."
sudo -u "$APP_USER" node "$APP_DIR/server/dist/init-db.js"

echo "Installing systemd service..."
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=MDD Candy Server
After=network.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node $APP_DIR/server/dist/server.js
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mdd-candy
sudo systemctl restart mdd-candy

echo "Writing Caddyfile..."
sudo tee "$CADDYFILE" >/dev/null <<EOF
$DOMAIN {
    root * $APP_DIR/frontend/dist
    file_server

    reverse_proxy /api/* localhost:$SERVER_PORT
}
EOF

echo "Reloading Caddy..."
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "Configuring firewall..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow OpenSSH
sudo ufw --force enable

echo "VPS deploy complete."
