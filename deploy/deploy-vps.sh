#!/usr/bin/env bash

set -euo pipefail

APP_USER="fete"
APP_GROUP="fete"
APP_ROOT="/opt/MDD_Candy"
SERVICE_NAME="mdd-candy"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
CADDYFILE_PATH="/etc/caddy/Caddyfile"
NODE_SETUP_URL="https://deb.nodesource.com/setup_20.x"
CADDY_GPG_URL="https://dl.cloudsmith.io/public/caddy/stable/gpg.key"
CADDY_LIST_URL="https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt"

DOMAIN="fete.oxongroup.co.uk"
REPO_URL="https://github.com/LegacyFDP/MDD_Copy"
ENABLE_UFW=1
SKIP_APT=0

usage() {
  cat <<EOF
Usage: sudo bash deploy/deploy-vps.sh --domain example.com [options]

Options:
  --domain DOMAIN       Domain Caddy should serve. Required.
  --repo-url URL        Clone this repo into ${APP_ROOT} if it is missing.
  --enable-ufw          Open SSH/HTTP/HTTPS and enable UFW if available.
  --skip-apt            Skip apt and package installation steps.
  -h, --help            Show this help text.

Examples:
  sudo bash deploy/deploy-vps.sh --domain fete.example.com
  sudo bash deploy/deploy-vps.sh --domain fete.example.com --repo-url https://github.com/org/repo.git
EOF
}

log() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Run this script as root: sudo bash deploy/deploy-vps.sh --domain <domain>"
  fi
}

run_as_app_user() {
  runuser -u "${APP_USER}" -- "$@"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        DOMAIN="${2:-}"
        shift 2
        ;;
      --repo-url)
        REPO_URL="${2:-}"
        shift 2
        ;;
      --enable-ufw)
        ENABLE_UFW=1
        shift
        ;;
      --skip-apt)
        SKIP_APT=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done

  if [[ -z "${DOMAIN}" ]]; then
    usage
    fail "--domain is required"
  fi
}

install_base_packages() {
  if [[ "${SKIP_APT}" -eq 1 ]]; then
    log "Skipping apt installation as requested"
    return
  fi

  log "Installing base packages"
  apt update
  apt upgrade -y
  apt install -y curl git build-essential ca-certificates gnupg sqlite3

  if ! command -v node >/dev/null 2>&1; then
    log "Installing Node.js 20"
    curl -fsSL "${NODE_SETUP_URL}" | bash -
    apt install -y nodejs
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    log "Installing Caddy"
    curl -1sLf "${CADDY_GPG_URL}" | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf "${CADDY_LIST_URL}" > /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
  fi
}

ensure_app_user() {
  log "Ensuring application user and root directory exist"
  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "${APP_ROOT}" --shell /bin/bash "${APP_USER}"
  fi

  mkdir -p "${APP_ROOT}"
  chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"
}

sync_repo() {
  if [[ -d "${APP_ROOT}/.git" ]]; then
    log "Using existing repository at ${APP_ROOT}"
    return
  fi

  if [[ -z "${REPO_URL}" ]]; then
    fail "${APP_ROOT} does not contain a git checkout. Provide --repo-url for first-time setup."
  fi

  log "Cloning repository into ${APP_ROOT}"
  rm -rf "${APP_ROOT}"
  install -d -o "${APP_USER}" -g "${APP_GROUP}" "${APP_ROOT}"
  run_as_app_user git clone "${REPO_URL}" "${APP_ROOT}"
}

ensure_server_env() {
  if [[ ! -f "${APP_ROOT}/server/.env" ]]; then
    log "Creating server/.env from example"
    cp "${APP_ROOT}/server/.env.example" "${APP_ROOT}/server/.env"
    chown "${APP_USER}:${APP_GROUP}" "${APP_ROOT}/server/.env"
  fi
}

init_database() {
  log "Initializing SQLite database"
  cd "${APP_ROOT}"
  node db/init-sqlite.cjs
  chown "${APP_USER}:${APP_GROUP}" "${APP_ROOT}/MDD_Candy.db"
}

install_dependencies_and_build() {
  log "Installing frontend dependencies and building assets"
  cd "${APP_ROOT}/frontend"
  run_as_app_user npm install
  run_as_app_user npm run build

  log "Installing server dependencies"
  cd "${APP_ROOT}/server"
  run_as_app_user npm install
}

install_systemd_service() {
  log "Installing systemd service"
  cp "${APP_ROOT}/deploy/mdd-candy.service" "${SERVICE_PATH}"
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
}

write_caddyfile() {
  log "Writing Caddy configuration"
  cat > "${CADDYFILE_PATH}" <<EOF
${DOMAIN} {
    handle /api* {
        reverse_proxy 127.0.0.1:8080
    }

    root * ${APP_ROOT}/frontend/dist
    try_files {path} {path}/ /index.html
    file_server
}
EOF

  caddy validate --config "${CADDYFILE_PATH}"
  systemctl reload caddy
}

configure_firewall() {
  if [[ "${ENABLE_UFW}" -ne 1 ]]; then
    return
  fi

  if ! command -v ufw >/dev/null 2>&1; then
    log "Installing UFW"
    apt install -y ufw
  fi

  log "Configuring firewall"
  ufw allow OpenSSH
  ufw allow 'WWW Full'
  ufw --force enable
}

show_summary() {
  log "Deployment complete"
  printf 'App root: %s\n' "${APP_ROOT}"
  printf 'Domain: %s\n' "${DOMAIN}"
  printf 'Service: %s\n' "${SERVICE_NAME}"
  printf 'Health check: curl http://127.0.0.1:8080/api/health\n'
  printf 'Logs: journalctl -u %s -f\n' "${SERVICE_NAME}"
}

main() {
  require_root
  parse_args "$@"
  install_base_packages
  ensure_app_user
  sync_repo
  ensure_server_env
  init_database
  install_dependencies_and_build
  install_systemd_service
  write_caddyfile
  configure_firewall
  show_summary
}

main "$@"