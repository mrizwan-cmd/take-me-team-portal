import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("primary navigation uses calm task-oriented hubs while preserving direct routes", async () => {
  const [portal, employee, admin] = await Promise.all([read("app/portal.tsx"), read("app/employee-portal.tsx"), read("app/admin-portal.tsx")]);
  for (const marker of ["employeeRoutes", "Work", "Resources", "adminRoutes", "Organisation", "Content & communication", "Security & audit"]) assert.ok(portal.includes(marker), marker);
  assert.match(employee, /function WorkHub/u);
  assert.match(employee, /function ResourcesHub/u);
  assert.match(admin, /function AdminHub/u);
});

test("accessibility preferences have real visual behavior", async () => {
  const css = await read("app/globals.css");
  for (const marker of [".large-text", ".high-contrast", ".reduced-motion", "prefers-reduced-motion", "--motion-standard"]) assert.ok(css.includes(marker), marker);
});

test("home prioritises attention and agenda before supporting widgets", async () => {
  const employee = await read("app/employee-portal.tsx");
  for (const marker of ["NEEDS YOUR ATTENTION", "Start with what matters", "Your agenda", "home-focus-grid", "home-secondary-grid"]) assert.ok(employee.includes(marker), marker);
});

test("forms progressively disclose optional details and explain disabled actions", async () => {
  const portal = await read("app/portal.tsx");
  assert.match(portal, /className="advanced-details"/u);
  assert.match(portal, /className="disabled-explanation"/u);
  assert.match(portal, /Purchase order.*Expense/u);
});

test("project records use a responsive side sheet and simplified view switcher", async () => {
  const [projects, css] = await Promise.all([read("app/projects-portal.tsx"), read("app/globals.css")]);
  assert.match(projects, /aria-label="Project insights"/u);
  assert.match(css, /backdrop:has\(\.project-card-modal\)/u);
  assert.match(css, /height: 100dvh/u);
});
