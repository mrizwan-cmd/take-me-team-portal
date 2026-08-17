import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all private API routes enforce company identity", async () => {
  const routes = [
    "app/api/portal-state/route.ts",
    "app/api/files/route.ts",
    "app/api/google/calendar/route.ts",
    "app/api/google/drive/route.ts",
    "app/api/google/status/route.ts",
    "app/api/google/config/route.ts",
    "app/api/auth/google/start/route.ts",
    "app/api/health/route.ts",
  ];
  for (const route of routes) assert.match(await read(route), /requirePortalUser\(request/iu, route);
});

test("all mutation routes enforce same-origin requests", async () => {
  for (const route of ["app/api/portal-state/route.ts", "app/api/files/route.ts", "app/api/google/calendar/route.ts", "app/api/google/status/route.ts", "app/api/google/config/route.ts"]) {
    assert.match(await read(route), /requireSameOrigin\(request\)/u, route);
  }
});

test("Google credentials are encrypted and isolated per portal user", async () => {
  const source = await read("app/api/google/_lib.ts");
  assert.match(source, /AES-GCM/u);
  assert.match(source, /google_user_tokens/u);
  assert.match(source, /portal_integration_config/u);
  assert.match(source, /saveStoredGoogleConfig/u);
  assert.match(source, /WHERE user_id = \?/u);
  assert.doesNotMatch(source, /workspace_id TEXT PRIMARY KEY/u);
});

test("the portable Next.js server applies baseline production security headers", async () => {
  const source = await read("next.config.ts");
  for (const header of ["x-content-type-options", "strict-transport-security", "content-security-policy", "permissions-policy", "referrer-policy"]) assert.match(source, new RegExp(header, "iu"));
});

test("the application no longer depends on Cloudflare runtime bindings", async () => {
  const files = ["app/api/_runtime.ts", "app/api/_auth.ts", "db/index.ts", "package.json"];
  for (const file of files) assert.doesNotMatch(await read(file), /cloudflare:workers|vinext|drizzle-orm\/d1/u, file);
});

test("personal employee records are isolated from shared company state", async () => {
  const source = await read("app/api/portal-state/route.ts");
  assert.match(source, /portal_user_data/u);
  for (const field of ["tasks", "events", "notifications", "leave", "shifts"]) assert.match(source, new RegExp(`personalFields[^;]+${field}`, "su"));
  assert.match(source, /mergeEmployeeRequests/u);
});
