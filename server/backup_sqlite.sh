#!/bin/bash
# Replaced by deploy/backup-db.sh, which finds the live database from DB_PATH
# in server/.env (it moved to /home/timmi/fete-data/). Kept so an old cron
# entry pointing here still makes a correct backup.
exec bash "$(dirname "$(readlink -f "$0")")/../deploy/backup-db.sh" "$@"
