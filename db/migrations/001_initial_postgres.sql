CREATE TABLE IF NOT EXISTS portal_state (
  workspace_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_user_state (
  user_id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  preferences TEXT NOT NULL,
  widgets TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_user_data (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_login_sessions (
  state TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_oauth_sessions (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_user_tokens (
  user_id TEXT PRIMARY KEY,
  encrypted_tokens TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT,
  size BIGINT NOT NULL,
  owner_id TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_files_owner_id_idx ON portal_files(owner_id);
CREATE INDEX IF NOT EXISTS portal_login_sessions_expires_at_idx ON portal_login_sessions(expires_at);
CREATE INDEX IF NOT EXISTS google_oauth_sessions_expires_at_idx ON google_oauth_sessions(expires_at);
