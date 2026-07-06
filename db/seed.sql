-- Fete Store Manager — demo seed data
-- Run after schema.sql:  psql "$DATABASE_URL" -f db/seed.sql
-- Safe to re-run: it truncates the app tables first.
--
-- NOTE: PINs are stored in plaintext, matching the original Retool app.
-- The demo credentials below are shown on the login screen.

BEGIN;

TRUNCATE fete_requirements, fete_volunteers, withdrawals, fetes, assets, store_locations, fete_users
  RESTART IDENTITY CASCADE;

-- Users (credentials shown on the login page) ---------------------------------
INSERT INTO fete_users (name, email, role, pin) VALUES
  ('Alice Adams',  'alice@charity.org', 'admin', '1234'),
  ('Bob Brown',    'bob@charity.org',   'admin', '2345'),
  ('Carol Clarke', 'carol@charity.org', 'user',  '3456'),
  ('Dan Davies',   'dan@charity.org',   'user',  '4567');

-- Storage locations -----------------------------------------------------------
INSERT INTO store_locations (name, description) VALUES
  ('Main Cupboard', 'Hallway cupboard by the office'),
  ('Garage',        'Lock-up garage behind the hall'),
  ('Loft',          'Above the main hall — ladder access'),
  ('Kitchen Store', 'Shelving in the kitchen pantry');

-- Assets ----------------------------------------------------------------------
INSERT INTO assets (name, category, quantity_total, quantity_available, location_id, notes) VALUES
  ('Folding Table 6ft',      'Furniture',   12, 12, 2, 'Heavy — two people to carry'),
  ('Folding Chair',          'Furniture',   60, 60, 2, ''),
  ('Gazebo 3x3m',            'Shelter',      4,  4, 2, 'Check all poles before use'),
  ('Bunting (10m)',          'Decoration',  20, 20, 1, 'Assorted colours'),
  ('Tablecloth (white)',     'Linen',       30, 30, 4, ''),
  ('Extension Lead 10m',     'Electrical',   8,  8, 1, 'PAT tested Jan 2026'),
  ('Float Cash Box',         'Equipment',    6,  6, 1, 'Combination 0000'),
  ('First Aid Kit',          'Safety',       3,  3, 1, 'Check expiry dates'),
  ('Raffle Drum',            'Equipment',    2,  2, 3, ''),
  ('Tea Urn (20L)',          'Equipment',    3,  3, 4, 'Descale after each use'),
  ('Signage A-Board',        'Stationery',   5,  5, 1, ''),
  ('Tombola Tickets (roll)', 'Stationery',  15, 15, 1, '');

-- Fetes -----------------------------------------------------------------------
INSERT INTO fetes (name, event_date, description, status, created_by, location_id) VALUES
  ('Summer Fete 2026',  '2026-07-18', 'Annual summer fundraiser on the green', 'planned',   1, NULL),
  ('Christmas Bazaar',  '2026-12-05', 'Indoor craft and gift stalls',          'planned',   1, NULL),
  ('Spring Open Day',   '2026-04-12', 'Community open day',                     'completed', 2, NULL);

-- An example active withdrawal (Folding Tables out for the Summer Fete) --------
INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, status, notes) VALUES
  (1, 1, 4, 3, 'out', 'Taken early for setup');
UPDATE assets SET quantity_available = quantity_available - 4 WHERE id = 1;

-- Volunteers assigned to fetes ------------------------------------------------
INSERT INTO fete_volunteers (fete_id, user_id, role, notes) VALUES
  (1, 3, 'Stall Lead', 'Tombola stall'),
  (1, 4, 'Setup Crew', ''),
  (2, 3, 'Helper',     '');

-- Pre-planned equipment requirements for the Summer Fete ----------------------
INSERT INTO fete_requirements (fete_id, asset_id, quantity_needed, notes) VALUES
  (1, 1, 8,  'For stalls'),
  (1, 2, 40, 'Seating'),
  (1, 3, 2,  'Shade for cake stall'),
  (1, 4, 10, 'Decorate fence line');

COMMIT;
