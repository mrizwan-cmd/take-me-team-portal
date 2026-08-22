import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the production login offers only Google company sign-in", async () => {
  const source = await read("app/login-screen.tsx");
  assert.equal((source.match(/google-login-button/gu) || []).length, 1);
  assert.match(source, /Continue with Google/u);
  assert.doesNotMatch(source, /Sign in with admin username|Temporary setup access|api\/auth\/temp-admin/u);
  assert.match(source, /@takeme\.taxi/u);
  assert.doesNotMatch(source, /Forgot password|Create account|Sign up/iu);
});

test("temporary admin login is hashed, rate limited and automatically expires", async () => {
  const source = await read("app/api/auth/temp-admin/route.ts");
  assert.match(source, /NODE_ENV === "production"/u);
  assert.match(source, /scryptSync/u);
  assert.match(source, /timingSafeEqual/u);
  assert.match(source, /maximumFailures = 5/u);
  assert.match(source, /TEMP_ADMIN_EXPIRES_AT/u);
  assert.match(source, /60 \* 60/u);
});

test("Google login uses OIDC state, nonce, PKCE and Workspace restriction", async () => {
  const start = await read("app/api/auth/google/login/route.ts");
  for (const value of ["scope: \"openid email profile\"", "state", "nonce", "code_challenge", "code_challenge_method: \"S256\"", "hd: config.domain"]) assert.match(start, new RegExp(value, "u"));
  assert.doesNotMatch(start, /calendar|drive/iu);
});

test("Google identity tokens and company domain are fully verified", async () => {
  const source = await read("app/api/auth/google/login/_lib.ts");
  for (const check of ["RS256", "crypto.subtle.verify", "accounts.google.com", "audience.includes", "claims.azp", "claims.exp", "email_verified", "claims.nonce", "claims.hd", "@${expectedDomain}"]) assert.match(source, new RegExp(check.replace(/[${}]/gu, "\\$&"), "u"));
});

test("Google callback failures identify the safe operational stage", async () => {
  const [callback, login] = await Promise.all([
    read("app/api/auth/google/login/callback/route.ts"),
    read("app/login-screen.tsx"),
  ]);
  for (const stage of ["token_exchange", "identity_verification", "employee_directory", "session_cookie"]) assert.match(callback, new RegExp(stage, "u"));
  for (const reason of ["credentials", "identity", "directory", "session"]) assert.match(login, new RegExp(`${reason}:`, "u"));
  assert.match(callback, /recordGoogleLoginDiagnostic/u);
  assert.match(callback, /login_trace/u);
  assert.match(login, /Support reference:/u);
  assert.doesNotMatch(callback, /console\.error\(`\[google-login\]/u);
});

test("verified Google sign-ins create or refresh an employee directory record", async () => {
  const [callback, directory, state, migration] = await Promise.all([
    read("app/api/auth/google/login/callback/route.ts"),
    read("app/api/auth/google/employee-directory.ts"),
    read("app/api/portal-state/route.ts"),
    read("db/migrations/005_employee_directory.sql"),
  ]);
  assert.match(callback, /await upsertGoogleEmployee\(user\)/u);
  assert.match(directory, /canonicalGoogleId\(user\.sub\)/u);
  assert.match(directory, /ON CONFLICT\(email\) DO UPDATE SET/u);
  assert.match(directory, /google_id = excluded\.google_id/u);
  assert.match(directory, /last_login_at = excluded\.last_login_at/u);
  assert.match(directory, /ON CONFLICT\(google_id\) DO NOTHING/u);
  assert.match(state, /await ensureSessionEmployee\(auth\.user\)/u);
  assert.match(state, /FROM portal_employees WHERE status = 'Active'/u);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_employees/u);
});

test("portal sessions are signed, short lived and not readable by scripts", async () => {
  const session = await read("app/portal-session.ts");
  assert.match(session, /createHmac/u);
  assert.match(session, /sha256/iu);
  assert.match(session, /HttpOnly/u);
  assert.match(session, /SameSite=Lax/u);
  assert.match(session, /8 \* 60 \* 60/u);
  const auth = await read("app/api/_auth.ts");
  assert.match(auth, /verifyPortalSession/u);
  assert.doesNotMatch(auth, /oai-authenticated-user-id/u);
});

test("first-time onboarding is saved and remains available from Help", async () => {
  const data = await read("app/portal-data.ts");
  assert.match(data, /onboardingComplete: boolean/u);
  assert.match(data, /onboardingStep: number/u);
  const portal = await read("app/portal.tsx");
  assert.match(portal, /<LoginScreen/u);
  assert.match(portal, /<OnboardingGuide/u);
  assert.match(portal, /<HelpCentre/u);
  const help = await read("app/onboarding.tsx");
  for (const step of ["Welcome", "Daily work", "Projects", "Google", "Requests", "People & info", "Time off & help"]) assert.match(help, new RegExp(`short: "${step}"`, "u"));
  for (const topic of ["Calendar and Meet", "Drive and documents", "Requests and approvals", "Chat and conversations", "Leave and time off", "Security and signing out"]) assert.match(help, new RegExp(topic, "u"));
  assert.match(help, /Start guided introduction/u);
});
