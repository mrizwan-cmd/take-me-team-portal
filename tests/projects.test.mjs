import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("projects are a first-class employee and administrator module", async () => {
  const [shell, employee, admin] = await Promise.all([
    read("app/portal.tsx"),
    read("app/employee-portal.tsx"),
    read("app/admin-portal.tsx"),
  ]);
  assert.match(shell, /\["Projects",\s*"▦",\s*"projects"\]/u);
  assert.match(employee, /case "Projects"/u);
  assert.match(admin, /Project management/u);
  assert.match(admin, /projectGoogleCalendar/u);
  assert.match(admin, /projectGoogleDrive/u);
});

test("project workspace covers visual planning and detailed collaboration", async () => {
  const source = await read("app/projects-portal.tsx");
  for (const view of ["Board", "Table", "Calendar", "Timeline", "Dashboard", "Activity"]) assert.match(source, new RegExp(`"${view}"`, "u"));
  for (const capability of ["Checklist", "Attachments", "Comments", "Automation", "Google Calendar", "Google Drive", "Share", "Archive"]) assert.match(source, new RegExp(capability, "u"));
  assert.match(source, /draggable/u);
  assert.match(source, /onDrop/u);
  assert.match(source, /projectTemplates/u);
});

test("project data is durable and included in state validation", async () => {
  const [data, route] = await Promise.all([read("app/portal-data.ts"), read("app/api/portal-state/route.ts")]);
  for (const field of ["projectBoards", "projectAutomations", "projectTemplates"]) {
    assert.match(data, new RegExp(`${field}:`, "u"));
    assert.match(route, new RegExp(`arrayFields[^;]+${field}`, "su"));
  }
});

test("approval records are not returned to employees without approval access", async () => {
  const route = await read("app/api/portal-state/route.ts");
  assert.match(route, /if \(!auth\.user\.canApprove\)[\s\S]+data\.approvals = \[\]/u);
});
