import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../app/api/portal-state/_schema.ts", import.meta.url), "utf8");
const featureRoute = await readFile(new URL("../app/api/portal-state/features/route.ts", import.meta.url), "utf8");
const stateHook = await readFile(new URL("../app/use-portal-state.ts", import.meta.url), "utf8");
const portalData = await readFile(new URL("../app/portal-data.ts", import.meta.url), "utf8");
const stateRoute = await readFile(new URL("../app/api/portal-state/route.ts", import.meta.url), "utf8");
const portal = await readFile(new URL("../app/portal.tsx", import.meta.url), "utf8");

test("portal state uses bounded semantic validation", () => {
  assert.match(schema, /MAX_TEXT/);
  assert.match(schema, /duplicate record IDs/);
  assert.match(schema, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  assert.match(schema, /projectBoards/);
});

test("high-change features persist independently with conflict detection", () => {
  assert.match(featureRoute, /portal_feature_state/);
  assert.match(featureRoute, /feature_revision_conflict/);
  assert.match(featureRoute, /Administrator access is required/);
  assert.match(featureRoute, /env\.DB\.batch\(statements, \{ requireSingleChange: true \}\)/u);
  assert.match(featureRoute, /DatabaseConflictError/u);
  assert.match(stateHook, /\/api\/portal-state\/features/);
  assert.match(stateHook, /featureRevisions/);
});

test("the operational default is empty and legacy sample workspaces are removed", () => {
  assert.match(portalData, /dataMode: "operational"/u);
  for (const field of ["employees", "requests", "approvals", "tasks", "events", "conversations", "documents", "articles", "leave", "notifications", "audit", "projectBoards"]) {
    assert.match(portalData, new RegExp(`${field}: \\[\\]`, "u"));
  }
  assert.match(stateRoute, /containsLegacySamples/u);
  assert.match(stateRoute, /DELETE FROM portal_user_data/u);
  assert.doesNotMatch(portal, /Sample workspace/u);
});
