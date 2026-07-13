-- Fete Store Manager — PostgreSQL schema
--
-- NOT used by the running app: server/src/db.ts is SQLite-only. This file is
-- kept as a reference schema (and for anyone who wants to run this app
-- against real Postgres instead) — the live database is built by
-- db/init-sqlite.js. Keep the two in sync if you change the data model.
--
-- Run once against an empty database:  psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS fete_users (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  pin        TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_locations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  town_city     TEXT NOT NULL DEFAULT '',
  county        TEXT NOT NULL DEFAULT '',
  postcode      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fete_locations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS assets (
  id                 SERIAL PRIMARY KEY,
  name               TEXT        NOT NULL,
  category           TEXT        NOT NULL DEFAULT 'Other',
  quantity_total     INTEGER     NOT NULL DEFAULT 0,
  quantity_available INTEGER     NOT NULL DEFAULT 0,
  location_id        INTEGER     REFERENCES store_locations(id) ON DELETE SET NULL,
  notes              TEXT        NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fetes (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  event_date  DATE,
  description TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'planned',
  created_by  INTEGER     REFERENCES fete_users(id) ON DELETE SET NULL,
  location_id INTEGER     REFERENCES fete_locations(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id           SERIAL PRIMARY KEY,
  asset_id     INTEGER     NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  fete_id      INTEGER     REFERENCES fetes(id) ON DELETE SET NULL,
  quantity     INTEGER     NOT NULL CHECK (quantity > 0),
  withdrawn_by INTEGER     NOT NULL REFERENCES fete_users(id),
  returned_by  INTEGER     REFERENCES fete_users(id),
  withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at  TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'out' CHECK (status IN ('out', 'returned')),
  notes        TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fete_volunteers (
  id       SERIAL PRIMARY KEY,
  fete_id  INTEGER     NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
  user_id  INTEGER     NOT NULL REFERENCES fete_users(id) ON DELETE CASCADE,
  role     TEXT        NOT NULL DEFAULT '',
  notes    TEXT        NOT NULL DEFAULT '',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fete_id, user_id)
);

CREATE TABLE IF NOT EXISTS fete_requirements (
  id              SERIAL PRIMARY KEY,
  fete_id         INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
  asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  quantity_needed INTEGER NOT NULL DEFAULT 1 CHECK (quantity_needed > 0),
  notes           TEXT    NOT NULL DEFAULT ''
);

-- Helpful indexes for the common lookups the app performs
CREATE INDEX IF NOT EXISTS idx_assets_location      ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status   ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_asset    ON withdrawals(asset_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_fete     ON withdrawals(fete_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_fete      ON fete_volunteers(fete_id);
CREATE INDEX IF NOT EXISTS idx_requirements_fete    ON fete_requirements(fete_id);

COMMIT;
