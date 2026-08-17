import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("loaded portal data is not immediately written back", async () => {
  const source = await read("app/use-portal-state.ts");
  assert.match(source, /if \(!ready\.current \|\| !dirty\.current/u);
  assert.match(source, /dirty\.current = false;[\s\S]*?setState\(next\)/u);
  assert.match(source, /dirty\.current = true;[\s\S]*?scheduleSave\(\)/u);
});

test("the secure session and requested route resolve before portal content renders", async () => {
  const source = await read("app/portal.tsx");
  assert.match(source, /!identity \|\| !routeReady/u);
  assert.match(source, /Opening your secure workspace/u);
  assert.match(source, /if \(!identity \|\| admin \|\| !routeReady \|\| createKind !== null \|\| commandOpen \|\| panel \|\| profileOpen/u);
});

test("home uses the employee's current local day and readable count labels", async () => {
  const source = await read("app/employee-portal.tsx");
  assert.doesNotMatch(source, /THURSDAY, 13 AUGUST/u);
  assert.match(source, /localDateKey\(now\)/u);
  assert.match(source, /todayEvents\.length === 1/u);
});

test("Google OAuth inputs resist password-manager credential autofill", async () => {
  const [admin, fields] = await Promise.all([read("app/admin-portal.tsx"), read("app/portal-ui.tsx")]);
  assert.match(fields, /autoComplete/u);
  assert.match(admin, /autoComplete="new-password"/u);
  assert.match(admin, /Google Cloud project ID[\s\S]*?autoComplete="off"/u);
});

test("small-screen carousels and onboarding controls stay inside usable phone bounds", async () => {
  const [mobile, onboarding] = await Promise.all([read("app/mobile.css"), read("app/login-onboarding.css")]);
  assert.match(mobile, /\.today-strip\s*\{[\s\S]*?margin-right:\s*-10px/u);
  assert.match(onboarding, /\.onboarding-close\{width:44px;height:44px/u);
});

test("modals prioritise their explicitly marked initial field", async () => {
  const source = await read("app/portal-ui.tsx");
  assert.match(source, /querySelector<HTMLElement>\("\[data-initial-focus\]"\)\s*\|\|/u);
  assert.doesNotMatch(source, /\[data-initial-focus\], button/u);
});
