import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const employee = await readFile(new URL("../app/employee-portal.tsx", import.meta.url), "utf8");
const googleChat = await readFile(new URL("../app/google-chat-portal.tsx", import.meta.url), "utf8");
const oauth = await readFile(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/google/chat/route.ts", import.meta.url), "utf8");

test("Google Chat is an additive test tab that preserves portal chat", () => {
  assert.match(employee, /Portal chat/u);
  assert.match(employee, /Google Chat/u);
  assert.match(employee, /source === "portal" \? <ChatPage/u);
  assert.match(googleChat, /Open in Google Chat/u);
  for (const feature of ["Employee profiles", "Projects", "Approvals", "Requests"]) assert.match(googleChat, new RegExp(feature, "u"));
});

test("Google Chat uses user-scoped server routes and same-origin writes", () => {
  assert.match(oauth, /auth\/chat\.spaces\.readonly/u);
  assert.match(oauth, /auth\/chat\.messages/u);
  assert.match(api, /requirePortalUser/u);
  assert.match(api, /requireSameOrigin/u);
  assert.match(api, /chat\.googleapis\.com/u);
});
