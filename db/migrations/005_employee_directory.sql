CREATE TABLE IF NOT EXISTS portal_employees (
  google_id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  locale TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  joined_at BIGINT NOT NULL,
  last_login_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS portal_employees_email_idx ON portal_employees(email);
CREATE INDEX IF NOT EXISTS portal_employees_status_idx ON portal_employees(status);
