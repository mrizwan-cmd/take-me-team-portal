import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google Calendar sync preserves a dedicated Meet join link", async () => {
  const [employee, portal, data, schema] = await Promise.all([read("app/employee-portal.tsx"), read("app/portal.tsx"), read("app/portal-data.ts"), read("app/api/portal-state/_schema.ts")]);
  assert.match(employee, /conferenceData\?\.entryPoints/u);
  assert.match(employee, /function googleMeetLink/u);
  assert.match(employee, /missingLinks/u);
  assert.match(employee, /Join Google Meet/u);
  assert.match(employee, /href=\{selected\.meetLink\}/u);
  assert.match(portal, /meetLink: googleEvent\?\.hangoutLink/u);
  assert.match(data, /meetLink\?: string/u);
  assert.match(schema, /url\.hostname === "meet\.google\.com"/u);
});
