-- PlaceFind app data. License-admin tokens and mail API keys stay in gitignored
-- files. Maps credentials are also sealed into hosted_keys when DATABASE_URL is
-- set so Railway can read them after a restart. Prefer Railway variables
-- DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, and SCRAPPEY_API_KEY as the durable source.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL,
  license_id TEXT,
  license_key TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  emailed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS issued_licenses (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expiry TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hosted_keys (
  id TEXT PRIMARY KEY,
  sealed TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
