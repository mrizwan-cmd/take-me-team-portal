CREATE TABLE IF NOT EXISTS portal_integration_config (
  provider TEXT PRIMARY KEY,
  public_data TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by TEXT NOT NULL
);
