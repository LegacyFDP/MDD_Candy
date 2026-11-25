#!/usr/bin/env bash
#
# Update the production app to the latest code WITHOUT touching its data.
#
#   cd ~/projects/MDD_Candy
#   sudo bash deploy/update-production.sh            # updates from the main branch
#   sudo bash deploy/update-production.sh --branch feature/deletes
#
# What it does:
#   1. Stops the app.
#   2. First run only: moves the live database out of the git checkout to
#      /home/timmi/fete-data/fete_store.db and points server/.env at it, so a
#      git pull can never overwrite or delete the live data again (the repo
#      tracks a development copy of server/fete_store.db).
#   3. Backs up the live database to /home/timmi/fete-data/backups/.
#   4. Pulls the new code, installs, builds the frontend.
#   5. Upgrades the database layout (npm run db:migrate). Existing records are
#      kept; the people/roles changes and new tables are added.
#   6. Starts the app and checks it answers.
#
# If anything fails it stops; the app is left stopped and the backup path is
# printed so you can restore it.

set -euo pipefail

APP_USER="timmi"
APP_ROOT="/home/timmi/projects/MDD_Candy"
SERVICE_NAME="mdd-candy"
DATA_DIR="/home/timmi/fete-data"
LIVE_DB="${DATA_DIR}/fete_store.db"
BACKUP_DIR="${DATA_DIR}/backups"
ENV_FILE="${APP_ROOT}/server/.env"
BRANCH="main"

log()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
as_app() { runuser -u "${APP_USER}" -- "$@"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || fail "Run with sudo"
[[ -d "${APP_ROOT}/.git" ]] || fail "${APP_ROOT} is not a git checkout"
[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} not found"

# The database file the app currently uses, from DB_PATH in server/.env
# (relative paths are relative to the server folder).
current_db_path() {
  local value
  value="$(grep -E '^DB_PATH=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
  [[ -n "${value}" ]] || value="./fete_store.db"
  if [[ "${value}" = /* ]]; then echo "${value}"; else realpath -m "${APP_ROOT}/server/${value}"; fi
}

copy_db() { # copy a stopped SQLite database including any journal files
  cp -p "$1" "$2"
  for ext in -wal -shm -journal; do [[ -f "$1${ext}" ]] && cp -p "$1${ext}" "$2${ext}"; done
  return 0
}

STAMP="$(date +%Y-%m-%d-%H%M%S)"

log "Stopping ${SERVICE_NAME}"
systemctl stop "${SERVICE_NAME}"

install -d -o "${APP_USER}" -g "${APP_USER}" "${DATA_DIR}" "${BACKUP_DIR}"

CURRENT_DB="$(current_db_path)"
if [[ "${CURRENT_DB}" != "${LIVE_DB}" ]]; then
  log "First run: moving the live database out of the git checkout"
  [[ -f "${CURRENT_DB}" ]] || fail "Live database not found at ${CURRENT_DB}"
  [[ ! -e "${LIVE_DB}" ]] || fail "${LIVE_DB} already exists; check it and set DB_PATH=${LIVE_DB} in ${ENV_FILE} by hand"
  copy_db "${CURRENT_DB}" "${LIVE_DB}"
  chown "${APP_USER}:${APP_USER}" "${LIVE_DB}"*
  cmp -s "${CURRENT_DB}" "${LIVE_DB}" || fail "Copy of the database does not match the original"
  cp -p "${ENV_FILE}" "${ENV_FILE}.before-${STAMP}"
  if grep -qE '^DB_PATH=' "${ENV_FILE}"; then
    sed -i -E "s|^DB_PATH=.*|DB_PATH=${LIVE_DB}|" "${ENV_FILE}"
  else
    printf '\nDB_PATH=%s\n' "${LIVE_DB}" >> "${ENV_FILE}"
  fi
  echo "Live database is now ${LIVE_DB} (server/.env updated; old copy left in place)"
fi

log "Backing up the live database"
BACKUP="${BACKUP_DIR}/fete_store-before-update-${STAMP}.db"
copy_db "${LIVE_DB}" "${BACKUP}"
chown "${APP_USER}:${APP_USER}" "${BACKUP}"*
echo "Backup: ${BACKUP}"
echo "To restore:  sudo systemctl stop ${SERVICE_NAME} && cp ${BACKUP} ${LIVE_DB} && sudo systemctl start ${SERVICE_NAME}"

log "Fetching code (branch ${BRANCH})"
cd "${APP_ROOT}"
# The checkout's own database files are no longer used by the app, so local
# changes to them can be discarded. Anything else changed on the server stops
# the update, so nothing is lost.
OTHER_CHANGES="$(as_app git status --porcelain --untracked-files=no | grep -vE '\.db$' || true)"
[[ -z "${OTHER_CHANGES}" ]] || fail "Files changed on the server; commit or remove them first:
${OTHER_CHANGES}"
as_app git ls-files -m -- '*.db' | while read -r f; do as_app git checkout -- "$f"; done
as_app git fetch origin
as_app git checkout "${BRANCH}"
as_app git pull --ff-only origin "${BRANCH}"
echo "Now at: $(as_app git log --oneline -1)"

log "Installing and building"
as_app npm install --no-audit --no-fund
cd "${APP_ROOT}/frontend"
as_app npm install --no-audit --no-fund
as_app npm run build
cd "${APP_ROOT}/server"
as_app npm install --no-audit --no-fund

log "Upgrading the database layout"
cd "${APP_ROOT}/server"
as_app npm run db:migrate

log "Starting ${SERVICE_NAME}"
systemctl start "${SERVICE_NAME}"
PORT="$(grep -E '^PORT=' "${ENV_FILE}" | tail -n1 | cut -d= -f2 | tr -d ' \r' || true)"
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT:-8080}/api/health" >/dev/null 2>&1; then
    echo "App is up: $(curl -fsS "http://127.0.0.1:${PORT:-8080}/api/health")"
    echo
    echo "Done. If you have not yet made yourself the Superuser, run:"
    echo "  cd ${APP_ROOT}/server && sudo -u ${APP_USER} npm run superuser:grant -- <your login email>"
    exit 0
  fi
  sleep 1
done
fail "App did not answer on port ${PORT:-8080}. See: journalctl -u ${SERVICE_NAME} -n 50   Backup: ${BACKUP}"
