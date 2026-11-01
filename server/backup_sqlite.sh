#!/bin/bash
set -e

DB="server/fete_store.db"
OUTDIR="server/backup"
STAMP=$(date +%F)
OUTFILE="$OUTDIR/fete_store_$STAMP.db"

mkdir -p "$OUTDIR"

sqlite3 "$DB" ".backup $OUTFILE"

