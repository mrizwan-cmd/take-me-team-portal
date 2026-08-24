import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("direct chat includes the selected communication and productivity features", async () => {
  const [chat, data, css] = await Promise.all([
    read("app/employee-portal.tsx"),
    read("app/portal-data.ts"),
    read("app/globals.css"),
  ]);
  for (const marker of [
    "Search conversations",
    "Search this conversation",
    "delivery-state",
    "Mark unread",
    "Editing message",
    "Replying to",
    "reactions",
    "Attach a file",
    "onlineUsers",
    "chat.typing",
    "Notification.permission",
    "Follow-up task created",
    "pinned",
    "savedBy",
    "Files and links",
    "Create Calendar event",
    "EMPLOYEE PROFILE",
    "chat-draft:",
    "link-preview",
    "Enter to send",
    "MediaRecorder",
    "chat-image",
    "Message formatting",
    "Mention",
  ])
    assert.ok(`${chat}\n${data}\n${css}`.includes(marker), marker);
});

test("chat attachments and message events use private server contracts", async () => {
  const [chat, files, realtime, schema] = await Promise.all([
    read("app/employee-portal.tsx"),
    read("app/api/files/route.ts"),
    read("realtime/server.mjs"),
    read("app/api/portal-state/_schema.ts"),
  ]);
  assert.match(chat, /direct\.uploadUrl/u);
  assert.match(chat, /uploadPrivateBlob/u);
  assert.match(files, /audio\/webm/u);
  assert.match(files, /handleUpload/u);
  assert.match(files, /access: "private"/u);
  assert.match(files, /canReadSharedChatFile/u);
  assert.match(files, /You do not have access to this file/u);
  assert.match(realtime, /event\.type === "chat\.message"/u);
  assert.match(realtime, /broadcastToParticipants/u);
  assert.match(realtime, /participants\.length !== 2/u);
  assert.match(chat, /participants: active\.members/u);
  assert.match(chat, /authorizedChatEvent/u);
  assert.match(schema, /message\.attachments/u);
});

test("chat prevents stale sends and reviews operational actions", async () => {
  const [chat, css, realtime] = await Promise.all([
    read("app/employee-portal.tsx"),
    read("app/mobile.css"),
    read("app/use-realtime.ts"),
  ]);
  assert.match(chat, /setPendingAttachments/u);
  assert.match(chat, /!event\.shiftKey/u);
  assert.match(chat, /event\.preventDefault\(\);[\s\S]*?send\(pendingAttachments\)/u);
  assert.match(chat, /Attachment ready to send/u);
  assert.match(chat, /if \(fileRef\.current\) fileRef\.current\.value = ""/u);
  assert.match(chat, /REVIEW BEFORE CREATING/u);
  assert.ok(chat.includes('aria-label={`Messages with'));
  assert.match(chat, /message-more-menu/u);
  assert.match(chat, /unreadBy/u);
  assert.match(css, /overflow-x: hidden/u);
  assert.match(realtime, /setEvents/u);
  assert.match(realtime, /current\.slice\(-49\)/u);
});
