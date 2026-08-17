import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the login screen offers Google company sign-in and controlled temporary setup access", async () => {
  const source = await read("app/login-screen.tsx");
  assert.equal((source.match(/google-login-button/gu) || []).length, 1);
  assert.match(source, /Continue with Google/u);
  assert.match(source, /Sign in with admin username/u);
  assert.match(source, /api\/auth\/temp-admin/u);
  assert.match(source, /@takeme\.taxi/u);
  assert.doesNotMatch(source, /Forgot password|Create account|Sign up/iu);
});

test("temporary admin login is hashed, rate limited and automatically expires", async () => {
  const source = await read("app/api/auth/temp-admin/route.ts");
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
  for (const step of ["Welcome", "Daily work", "Projects", "Google", "Requests", "People & info", "Work life"]) assert.match(help, new RegExp(`short: "${step}"`, "u"));
  for (const topic of ["Calendar and Meet", "Drive and documents", "Requests and approvals", "Chat and conversations", "Leave, shifts and rota", "Security and signing out"]) assert.match(help, new RegExp(topic, "u"));
  assert.match(help, /Start guided introduction/u);
});
