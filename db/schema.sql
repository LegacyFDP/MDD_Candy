-- Fete Store Manager — SQL Server schema
--
-- NOTE: The running app is SQLite-only (server/src/db.ts and db/init-sqlite.cjs).
-- This file is for SQL Server environments.
--
-- Run in SQL Server (example):
--   sqlcmd -S <server> -d <database> -i db/schema.sql

BEGIN TRANSACTION;

IF OBJECT_ID('dbo.fete_users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fete_users (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(255) NOT NULL,
    email      NVARCHAR(255) NOT NULL,
    role       NVARCHAR(20)  NOT NULL CONSTRAINT DF_fete_users_role DEFAULT 'user',
    pin        NVARCHAR(255) NOT NULL,
    created_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_fete_users_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT UQ_fete_users_email UNIQUE (email),
    CONSTRAINT CK_fete_users_role CHECK (role IN ('admin', 'user'))
  );
END;

IF OBJECT_ID('dbo.store_locations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_locations (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(255) NOT NULL,
    description   NVARCHAR(MAX) NOT NULL CONSTRAINT DF_store_locations_description DEFAULT '',
    notes         NVARCHAR(MAX) NOT NULL CONSTRAINT DF_store_locations_notes DEFAULT '',
    address_line1 NVARCHAR(255) NOT NULL CONSTRAINT DF_store_locations_address_line1 DEFAULT '',
    address_line2 NVARCHAR(255) NOT NULL CONSTRAINT DF_store_locations_address_line2 DEFAULT '',
    town_city     NVARCHAR(255) NOT NULL CONSTRAINT DF_store_locations_town_city DEFAULT '',
    county        NVARCHAR(255) NOT NULL CONSTRAINT DF_store_locations_county DEFAULT '',
    postcode      NVARCHAR(50)  NOT NULL CONSTRAINT DF_store_locations_postcode DEFAULT '',
    location_type NVARCHAR(20)  NOT NULL CONSTRAINT DF_store_locations_location_type DEFAULT 'Store',
    CONSTRAINT CK_store_locations_location_type CHECK (location_type IN ('Store', 'Fetes'))
  );
END;

IF OBJECT_ID('dbo.assets', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.assets (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    name               NVARCHAR(255) NOT NULL,
    category           NVARCHAR(100) NOT NULL CONSTRAINT DF_assets_category DEFAULT 'Other',
    quantity_total     INT           NOT NULL CONSTRAINT DF_assets_quantity_total DEFAULT 0,
    quantity_available INT           NOT NULL CONSTRAINT DF_assets_quantity_available DEFAULT 0,
    location_id        INT           NULL,
    notes              NVARCHAR(MAX) NOT NULL CONSTRAINT DF_assets_notes DEFAULT '',
    created_at         DATETIMEOFFSET NOT NULL CONSTRAINT DF_assets_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT FK_assets_location FOREIGN KEY (location_id)
      REFERENCES dbo.store_locations(id) ON DELETE SET NULL
  );
END;

IF OBJECT_ID('dbo.fetes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fetes (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(255) NOT NULL,
    event_date  DATE          NULL,
    description NVARCHAR(MAX) NOT NULL CONSTRAINT DF_fetes_description DEFAULT '',
    notes       NVARCHAR(MAX) NOT NULL CONSTRAINT DF_fetes_notes DEFAULT '',
    status      NVARCHAR(50)  NOT NULL CONSTRAINT DF_fetes_status DEFAULT 'planned',
    created_by  INT           NULL,
    location_id INT           NULL,
    created_at  DATETIMEOFFSET NOT NULL CONSTRAINT DF_fetes_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT FK_fetes_created_by FOREIGN KEY (created_by)
      REFERENCES dbo.fete_users(id) ON DELETE SET NULL,
    CONSTRAINT FK_fetes_location FOREIGN KEY (location_id)
      REFERENCES dbo.store_locations(id) ON DELETE SET NULL
  );
END;

IF OBJECT_ID('dbo.withdrawals', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.withdrawals (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    asset_id     INT           NOT NULL,
    fete_id      INT           NULL,
    quantity     INT           NOT NULL,
    withdrawn_by INT           NOT NULL,
    returned_by  INT           NULL,
    withdrawn_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_withdrawals_withdrawn_at DEFAULT SYSDATETIMEOFFSET(),
    returned_at  DATETIMEOFFSET NULL,
    status       NVARCHAR(20)  NOT NULL CONSTRAINT DF_withdrawals_status DEFAULT 'out',
    notes        NVARCHAR(MAX) NOT NULL CONSTRAINT DF_withdrawals_notes DEFAULT '',
    CONSTRAINT CK_withdrawals_quantity CHECK (quantity > 0),
    CONSTRAINT CK_withdrawals_status CHECK (status IN ('out', 'returned')),
    CONSTRAINT FK_withdrawals_asset FOREIGN KEY (asset_id)
      REFERENCES dbo.assets(id) ON DELETE CASCADE,
    CONSTRAINT FK_withdrawals_fete FOREIGN KEY (fete_id)
      REFERENCES dbo.fetes(id) ON DELETE SET NULL,
    CONSTRAINT FK_withdrawals_withdrawn_by FOREIGN KEY (withdrawn_by)
      REFERENCES dbo.fete_users(id),
    CONSTRAINT FK_withdrawals_returned_by FOREIGN KEY (returned_by)
      REFERENCES dbo.fete_users(id)
  );
END;

IF OBJECT_ID('dbo.fete_volunteers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fete_volunteers (
    id       INT IDENTITY(1,1) PRIMARY KEY,
    fete_id  INT           NOT NULL,
    user_id  INT           NOT NULL,
    role     NVARCHAR(100) NOT NULL CONSTRAINT DF_fete_volunteers_role DEFAULT '',
    notes    NVARCHAR(MAX) NOT NULL CONSTRAINT DF_fete_volunteers_notes DEFAULT '',
    added_at DATETIMEOFFSET NOT NULL CONSTRAINT DF_fete_volunteers_added_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT UQ_fete_volunteers_fete_user UNIQUE (fete_id, user_id),
    CONSTRAINT FK_fete_volunteers_fete FOREIGN KEY (fete_id)
      REFERENCES dbo.fetes(id) ON DELETE CASCADE,
    CONSTRAINT FK_fete_volunteers_user FOREIGN KEY (user_id)
      REFERENCES dbo.fete_users(id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID('dbo.volunteer_roles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.volunteer_roles (
    role_key     NVARCHAR(100) PRIMARY KEY,
    display_name NVARCHAR(255) NOT NULL,
    CONSTRAINT UQ_volunteer_roles_display_name UNIQUE (display_name)
  );
END;

IF OBJECT_ID('dbo.volunteers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.volunteers (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(255) NOT NULL,
    email         NVARCHAR(255) NOT NULL,
    address_line1 NVARCHAR(255) NOT NULL CONSTRAINT DF_volunteers_address_line1 DEFAULT '',
    address_line2 NVARCHAR(255) NOT NULL CONSTRAINT DF_volunteers_address_line2 DEFAULT '',
    town_city     NVARCHAR(255) NOT NULL CONSTRAINT DF_volunteers_town_city DEFAULT '',
    county        NVARCHAR(255) NOT NULL CONSTRAINT DF_volunteers_county DEFAULT '',
    postcode      NVARCHAR(50)  NOT NULL CONSTRAINT DF_volunteers_postcode DEFAULT '',
    phone_home    NVARCHAR(50)  NOT NULL CONSTRAINT DF_volunteers_phone_home DEFAULT '',
    phone_mobile  NVARCHAR(50)  NOT NULL CONSTRAINT DF_volunteers_phone_mobile DEFAULT '',
    skills        NVARCHAR(MAX) NOT NULL CONSTRAINT DF_volunteers_skills DEFAULT '',
    notes         NVARCHAR(MAX) NOT NULL CONSTRAINT DF_volunteers_notes DEFAULT '',
    created_at    DATETIMEOFFSET NOT NULL CONSTRAINT DF_volunteers_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT UQ_volunteers_email UNIQUE (email)
  );
END;

IF OBJECT_ID('dbo.fete_volunteer_assignments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fete_volunteer_assignments (
    id                       INT IDENTITY(1,1) PRIMARY KEY,
    fete_id                  INT           NOT NULL,
    volunteer_id             INT           NOT NULL,
    role_key                 NVARCHAR(100) NOT NULL,
    role_other               NVARCHAR(255) NOT NULL CONSTRAINT DF_fva_role_other DEFAULT '',
    notes                    NVARCHAR(MAX) NOT NULL CONSTRAINT DF_fva_notes DEFAULT '',
    added_by_user_id         INT           NULL,
    legacy_fete_volunteer_id INT           NULL,
    created_at               DATETIMEOFFSET NOT NULL CONSTRAINT DF_fva_created_at DEFAULT SYSDATETIMEOFFSET(),
    updated_at               DATETIMEOFFSET NOT NULL CONSTRAINT DF_fva_updated_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT UQ_fva_fete_volunteer UNIQUE (fete_id, volunteer_id),
    CONSTRAINT FK_fva_fete FOREIGN KEY (fete_id)
      REFERENCES dbo.fetes(id) ON DELETE CASCADE,
    CONSTRAINT FK_fva_volunteer FOREIGN KEY (volunteer_id)
      REFERENCES dbo.volunteers(id) ON DELETE CASCADE,
    CONSTRAINT FK_fva_role_key FOREIGN KEY (role_key)
      REFERENCES dbo.volunteer_roles(role_key),
    CONSTRAINT FK_fva_added_by FOREIGN KEY (added_by_user_id)
      REFERENCES dbo.fete_users(id) ON DELETE SET NULL
  );
END;

IF OBJECT_ID('dbo.fete_volunteer_availability', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fete_volunteer_availability (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    assignment_id INT  NOT NULL,
    slot_date     DATE NOT NULL,
    start_hour    INT  NOT NULL,
    end_hour      INT  NOT NULL,
    CONSTRAINT UQ_fva_slot UNIQUE (assignment_id, slot_date, start_hour),
    CONSTRAINT CK_fva_start_hour CHECK (start_hour BETWEEN 9 AND 17),
    CONSTRAINT CK_fva_end_hour CHECK (end_hour = start_hour + 1 AND end_hour BETWEEN 10 AND 18),
    CONSTRAINT FK_fva_assignment FOREIGN KEY (assignment_id)
      REFERENCES dbo.fete_volunteer_assignments(id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID('dbo.db_backups', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.db_backups (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    filename           NVARCHAR(260) NOT NULL,
    absolute_path      NVARCHAR(1024) NOT NULL,
    byte_size          BIGINT        NOT NULL CONSTRAINT DF_db_backups_byte_size DEFAULT 0,
    reason             NVARCHAR(100) NOT NULL CONSTRAINT DF_db_backups_reason DEFAULT 'manual',
    created_by_user_id INT           NULL,
    deleted_by_user_id INT           NULL,
    created_at         DATETIMEOFFSET NOT NULL CONSTRAINT DF_db_backups_created_at DEFAULT SYSDATETIMEOFFSET(),
    deleted_at         DATETIMEOFFSET NULL,
    CONSTRAINT UQ_db_backups_filename UNIQUE (filename),
    CONSTRAINT FK_db_backups_created_by FOREIGN KEY (created_by_user_id)
      REFERENCES dbo.fete_users(id) ON DELETE SET NULL,
    CONSTRAINT FK_db_backups_deleted_by FOREIGN KEY (deleted_by_user_id)
      REFERENCES dbo.fete_users(id) ON DELETE SET NULL
  );
END;

IF OBJECT_ID('dbo.fete_requirements', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fete_requirements (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    fete_id         INT           NOT NULL,
    asset_id        INT           NOT NULL,
    quantity_needed INT           NOT NULL CONSTRAINT DF_fete_requirements_quantity_needed DEFAULT 1,
    notes           NVARCHAR(MAX) NOT NULL CONSTRAINT DF_fete_requirements_notes DEFAULT '',
    CONSTRAINT CK_fete_requirements_quantity_needed CHECK (quantity_needed > 0),
    CONSTRAINT FK_fete_requirements_fete FOREIGN KEY (fete_id)
      REFERENCES dbo.fetes(id) ON DELETE CASCADE,
    CONSTRAINT FK_fete_requirements_asset FOREIGN KEY (asset_id)
      REFERENCES dbo.assets(id) ON DELETE CASCADE
  );
END;

-- Helpful indexes for the common lookups the app performs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_assets_location' AND object_id = OBJECT_ID('dbo.assets'))
  CREATE INDEX idx_assets_location ON dbo.assets(location_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_withdrawals_status' AND object_id = OBJECT_ID('dbo.withdrawals'))
  CREATE INDEX idx_withdrawals_status ON dbo.withdrawals(status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_withdrawals_asset' AND object_id = OBJECT_ID('dbo.withdrawals'))
  CREATE INDEX idx_withdrawals_asset ON dbo.withdrawals(asset_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_withdrawals_fete' AND object_id = OBJECT_ID('dbo.withdrawals'))
  CREATE INDEX idx_withdrawals_fete ON dbo.withdrawals(fete_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_volunteers_fete' AND object_id = OBJECT_ID('dbo.fete_volunteers'))
  CREATE INDEX idx_volunteers_fete ON dbo.fete_volunteers(fete_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_requirements_fete' AND object_id = OBJECT_ID('dbo.fete_requirements'))
  CREATE INDEX idx_requirements_fete ON dbo.fete_requirements(fete_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_volunteers_name' AND object_id = OBJECT_ID('dbo.volunteers'))
  CREATE INDEX idx_volunteers_name ON dbo.volunteers(name);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_assignment_fete' AND object_id = OBJECT_ID('dbo.fete_volunteer_assignments'))
  CREATE INDEX idx_assignment_fete ON dbo.fete_volunteer_assignments(fete_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_assignment_volunteer' AND object_id = OBJECT_ID('dbo.fete_volunteer_assignments'))
  CREATE INDEX idx_assignment_volunteer ON dbo.fete_volunteer_assignments(volunteer_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_availability_assign' AND object_id = OBJECT_ID('dbo.fete_volunteer_availability'))
  CREATE INDEX idx_availability_assign ON dbo.fete_volunteer_availability(assignment_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_backups_created_at' AND object_id = OBJECT_ID('dbo.db_backups'))
  CREATE INDEX idx_backups_created_at ON dbo.db_backups(created_at);

COMMIT TRANSACTION;
