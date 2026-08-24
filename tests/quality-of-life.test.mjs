import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("notifications support useful sections, preferences, deep links and undo", async () => {
  const [portal, data] = await Promise.all([read("app/portal.tsx"), read("app/portal-data.ts")]);
  for (const marker of ["Today", "Earlier", "Snoozed", "actionRequiredOnly", "mutedNotificationGroups", "Undo mark all read", "targetPage", "targetId", "actorEmail"]) assert.ok(`${portal}\n${data}`.includes(marker), marker);
  assert.match(portal, /item\.actorEmail\?\.toLowerCase\(\) !== state\.profile\.email\.toLowerCase\(\)/u);
});

test("quick create recovers drafts and accelerates repeated forms", async () => {
  const portal = await read("app/portal.tsx");
  for (const marker of ["quick-create-draft:", "Recovered your unfinished form", "date-suggestions", "attachment-dropzone", "recentEmployeeEmails", "Create another after saving", "field-error"]) assert.ok(portal.includes(marker), marker);
  assert.match(portal, /fetch\("\/api\/files", \{ method: "POST", body \}\)/u);
});

test("absence delegation and planned integrations replace dead-end controls", async () => {
  const [portal, data, leave, admin] = await Promise.all([read("app/portal.tsx"), read("app/portal-data.ts"), read("app/employee-portal.tsx"), read("app/admin-portal.tsx")]);
  for (const marker of ["awayUntil", "delegateEmail", "delegateApprovals", "delegateProjects", "delegateRequests", "delegateUrgentNotifications"]) assert.ok(`${portal}\n${data}`.includes(marker), marker);
  assert.match(leave, /delegation-banner/u);
  assert.match(admin, /Planned integrations/u);
  assert.doesNotMatch(admin, /Export unavailable|Broadcast unavailable|Send test unavailable|Connector required/u);
});
