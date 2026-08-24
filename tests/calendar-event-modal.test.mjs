import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google Calendar event details use a focused responsive event sheet", async () => {
  const [employee, css] = await Promise.all([read("app/employee-portal.tsx"), read("app/globals.css")]);
  for (const marker of ["calendar-event-modal", "event-facts", "event-attendees", "event-agenda", "event-modal-actions", "Join Google Meet", "Open in Calendar"]) assert.ok(employee.includes(marker), marker);
  assert.match(css, /\.event-facts\s*\{/u);
  assert.match(css, /\.event-modal-actions\s*\{/u);
  assert.match(css, /@media \(max-width: 700px\)/u);
});
