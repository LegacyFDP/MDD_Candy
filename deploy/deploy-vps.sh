[Unit]
Description=MDD Candy Server
After=network.target

[Service]
Type=simple
User=timmi
Group=timmi
WorkingDirectory=/home/timmi/projects/MDD_Candy/server

EnvironmentFile=/home/timmi/projects/MDD_Candy/server/.env

ExecStart=/usr/bin/node /home/timmi/projects/MDD_Candy/server/index.js
Restart=always
RestartSec=3

# Ensure logs go to journalctl
StandardOutput=journal
StandardError=journal

# Hardening options
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
