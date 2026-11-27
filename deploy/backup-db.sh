#!/usr/bin/env bash
#
# Daily backup of the live app database. Safe to run while the app is up
# (uses SQLite's online backup), so it needs no sudo and no downtime.
#
# It finds the database from DB_PATH in server/.env, so it keeps working if
# the database moves again.
#
#   bash ~/projects/MDD_Candy/deploy/backup-db.sh        # run by hand
#
# Install as a daily job (03:15) for the user timmi -- run once on the server:
#
#   ( crontab -l 2>/dev/null | grep -v 'backup_sqlite.sh\|deploy/backup-db.sh'; \
#     echo '15 3 * * * bash /home/timmi/projects/MDD_Candy/deploy/backup-db.sh >> /home/timmi/fete-data/backups/backup.log 2>&1' ) | crontab -
#
# Backups go to /home/timmi/fete-data/backups/daily/fete_store-YYYY-MM-DD.db
# and are kept for KEEP_DAYS days. The "before-update" backups made by
# update-production.sh are in the folder above and are never deleted here.
#
# Off-site copy: if Dropbox Uploader is set up for this user (~/.dropbox_uploader
# exists; run the repo's dropbox_uploader.sh once to set it up), each backup is
# also uploaded to /fete-backups/ in Dropbox.

set -euo pipefail

APP_ROOT="/home/timmi/projects/MDD_Candy"
ENV_FILE="${APP_ROOT}/server/.env"
BACKUP_DIR="/home/timmi/fete-data/backups/daily"
KEEP_DAYS=30
DROPBOX_UPLOADER="${APP_ROOT}/dropbox_uploader.sh"
DROPBOX_DIR="/fete-backups"

log()  { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

command -v sqlite3 >/dev/null || fail "sqlite3 is not installed (sudo apt install sqlite3)"
[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} not found"

# The database the app uses: DB_PATH in server/.env (relative paths are
# relative to the server folder), same rule as the app and update script.
DB="$(grep -E '^DB_PATH=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
[[ -n "${DB}" ]] || DB="./fete_store.db"
[[ "${DB}" = /* ]] || DB="$(realpath -m "${APP_ROOT}/server/${DB}")"
[[ -f "${DB}" ]] || fail "Database not found at ${DB}"

mkdir -p "${BACKUP_DIR}"
OUT="${BACKUP_DIR}/fete_store-$(date +%F).db"
TMP="${OUT}.partial"
rm -f "${TMP}"

# Online backup: a consistent snapshot even while the app is writing.
sqlite3 "${DB}" ".timeout 10000" ".backup '${TMP}'"
CHECK="$(sqlite3 "${TMP}" 'PRAGMA integrity_check;')"
[[ "${CHECK}" == "ok" ]] || { rm -f "${TMP}"; fail "Backup failed integrity check: ${CHECK}"; }
mv -f "${TMP}" "${OUT}"
log "Backed up ${DB} -> ${OUT} ($(du -h "${OUT}" | cut -f1))"

# Remove old daily backups (only files this script made).
find "${BACKUP_DIR}" -maxdepth 1 -name 'fete_store-????-??-??.db' -mtime "+${KEEP_DAYS}" -print -delete \
  | sed 's/^/Removed old backup: /'

if [[ -f "${HOME}/.dropbox_uploader" && -f "${DROPBOX_UPLOADER}" ]]; then
  bash "${DROPBOX_UPLOADER}" -q upload "${OUT}" "${DROPBOX_DIR}/$(basename "${OUT}")" \
    && log "Uploaded to Dropbox ${DROPBOX_DIR}/" \
    || fail "Dropbox upload failed (local backup is fine: ${OUT})"
fi
