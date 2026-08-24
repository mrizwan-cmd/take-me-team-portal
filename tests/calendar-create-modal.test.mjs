import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the portal uses a self-hosted modern font and a focused event creation flow", async () => {
  const [layout, portal, css] = await Promise.all([read("app/layout.tsx"), read("app/portal.tsx"), read("app/globals.css")]);
  assert.match(layout, /import \{ Manrope \} from "next\/font\/google"/u);
  assert.match(layout, /variable: "--font-portal"/u);
  for (const marker of ["calendar-create-modal", "event-create-form", "event-schedule-card", "event-meet-choice", "event-repeat-choice"]) assert.ok(portal.includes(marker), marker);
  assert.match(css, /\.event-schedule-grid\s*\{/u);
  assert.match(css, /html body \*/u);
});
