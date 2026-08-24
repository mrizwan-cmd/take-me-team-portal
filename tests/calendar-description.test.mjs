import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google Calendar descriptions render supported formatting through a safe DOM allowlist", async () => {
  const employee = await read("app/employee-portal.tsx");
  assert.match(employee, /function SafeCalendarDescription/u);
  assert.match(employee, /allowedTags = new Set/u);
  assert.match(employee, /script, style, iframe, object, embed/u);
  assert.match(employee, /noreferrer noopener/u);
  assert.match(employee, /<SafeCalendarDescription value=\{selected\.notes\}/u);
});
