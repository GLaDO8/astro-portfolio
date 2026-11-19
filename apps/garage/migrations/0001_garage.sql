BEGIN;
CREATE SCHEMA IF NOT EXISTS garage;
CREATE TABLE IF NOT EXISTS garage.products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  original_url TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  image_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'available', 'reserved', 'gone')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_status ON garage.products(status, created_at DESC);
CREATE TABLE IF NOT EXISTS garage.requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  city TEXT NOT NULL,
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS requests_created ON garage.requests(created_at DESC);
CREATE TABLE IF NOT EXISTS garage.sessions (token_hash TEXT PRIMARY KEY, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS garage.rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at BIGINT NOT NULL);
COMMIT;
