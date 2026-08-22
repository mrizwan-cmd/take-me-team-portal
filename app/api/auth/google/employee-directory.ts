import { env } from "@/app/api/_runtime";

export type VerifiedGoogleEmployee = {
  sub: string;
  email: string;
  name: string;
  givenName: string;
  familyName: string;
  picture: string;
  locale: string;
};

function canonicalGoogleId(value: string) {
  return value.startsWith("google:") ? value : `google:${value}`;
}

export async function ensureEmployeeDirectoryTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_employees (
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
  )`).run();
}

export async function upsertGoogleEmployee(user: VerifiedGoogleEmployee) {
  await ensureEmployeeDirectoryTable();
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO portal_employees (
      google_id, email, name, given_name, family_name, photo_url, locale, joined_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      google_id = excluded.google_id,
      email = excluded.email,
      name = excluded.name,
      given_name = excluded.given_name,
      family_name = excluded.family_name,
      photo_url = excluded.photo_url,
      locale = excluded.locale,
      last_login_at = excluded.last_login_at`)
    .bind(canonicalGoogleId(user.sub), user.email, user.name, user.givenName, user.familyName, user.picture, user.locale, now, now)
    .run();
}

export async function ensureSessionEmployee(user: { id: string; email: string; name: string }) {
  await ensureEmployeeDirectoryTable();
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO portal_employees (
      google_id, email, name, given_name, family_name, photo_url, locale, joined_at, last_login_at
    ) VALUES (?, ?, ?, '', '', '', '', ?, ?)
    ON CONFLICT(google_id) DO NOTHING`)
    .bind(canonicalGoogleId(user.id), user.email, user.name, now, now)
    .run();
}
