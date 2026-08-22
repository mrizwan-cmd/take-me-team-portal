import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("chat supports direct employee messages without channels or groups", async () => {
  const [portal, employeePortal, schema] = await Promise.all([
    read("app/portal.tsx"),
    read("app/employee-portal.tsx"),
    read("app/api/portal-state/_schema.ts"),
  ]);
  assert.match(portal, /type: "Direct"/u);
  assert.match(portal, /Only active employees who have signed in are shown/u);
  assert.match(portal, /Who would you like to message/u);
  assert.match(portal, /Type a name, email, role or department/u);
  assert.match(portal, /employee\.name, employee\.email, employee\.jobTitle, employee\.department/u);
  assert.match(portal, /No employees match your search/u);
  assert.match(portal, /aria-pressed=\{people === employee\.email\}/u);
  assert.match(portal, /kind === "conversation" \? "Start chat"/u);
  assert.doesNotMatch(portal, /\["Channel", "Group", "Direct"\]/u);
  assert.match(employeePortal, /Direct messages/u);
  assert.match(schema, /value\.type !== "Direct"/u);
});

test("universal search includes employees who have signed in", async () => {
  const portal = await read("app/portal.tsx");
  assert.match(portal, /\.\.\.state\.employees\.map/u);
  assert.match(portal, /item\.jobTitle \|\| "Employee"/u);
  assert.match(portal, /navigate\("People"\)/u);
});

test("mobile chat uses separate conversation-list and active-chat views", async () => {
  const mobile = await read("app/mobile.css");
  const chat = await read("app/employee-portal.tsx");
  assert.match(mobile, /\.chat-layout\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(mobile, /mobile-conversation-list \.conversation/u);
  assert.match(mobile, /mobile-conversation-open \.chat-contacts/u);
  assert.match(mobile, /\.active-chat-page > \.page-intro[\s\S]*?display: none/u);
  assert.match(mobile, /mobile-conversation-open[\s\S]*?position: fixed/u);
  assert.match(mobile, /mobile-conversation-open[\s\S]*?height: 100dvh/u);
  assert.match(mobile, /\.chat-contacts \.chat-icon-button/u);
  assert.match(chat, /Back to conversations/u);
  assert.match(mobile, /\.composer input\s*\{[\s\S]*?font-size: 16px/u);
});
