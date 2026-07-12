-- ================================================================
-- Portfolio contact form + admin panel schema
-- Run this in pgAdmin's Query Tool against your target database
-- (Right click your database -> Query Tool -> paste -> Execute)
-- ================================================================

CREATE TABLE IF NOT EXISTS contacts (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    subject         VARCHAR(200),
    message         TEXT          NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'unread', -- unread | read | replied
    ip_address      VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);

CREATE TABLE IF NOT EXISTS admin_users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255)  UNIQUE NOT NULL,
    password_hash   TEXT          NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Note: the first admin user is created automatically by
-- `npm run init-db` (scripts/initDb.js) using ADMIN_EMAIL / ADMIN_PASSWORD
-- from your .env file, so you don't need to insert one by hand.
