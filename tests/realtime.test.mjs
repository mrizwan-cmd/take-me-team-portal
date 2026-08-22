import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WebSocket } from "ws";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function sign(secret, sub, name) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      email: `${sub}@takeme.taxi`,
      name,
      workspace: "take-me-group",
      iat: now,
      exp: now + 60,
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function openSocket(port, token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}`,
      ["take-me-realtime-v1", `auth.${token}`],
      { origin: "http://127.0.0.1:3000" },
    );
    const timer = setTimeout(
      () => reject(new Error("Realtime socket did not open")),
      4_000,
    );
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

function nextMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Expected realtime message was not received"));
    }, 4_000);
    const onMessage = (payload) => {
      const message = JSON.parse(String(payload));
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

test("realtime collaboration has authenticated tokens, origin checks and a polling fallback", async () => {
  const [tokenRoute, client, server, state] = await Promise.all([
    read("app/api/realtime/token/route.ts"),
    read("app/use-realtime.ts"),
    read("realtime/server.mjs"),
    read("app/use-portal-state.ts"),
  ]);
  assert.match(tokenRoute, /requirePortalUser\(request\)/u);
  assert.match(tokenRoute, /exp: now \+ 5 \* 60/u);
  assert.match(server, /REALTIME_ALLOWED_ORIGINS/u);
  assert.match(server, /Rate limit exceeded/u);
  assert.match(server, /maxPayload: 16 \* 1024/u);
  assert.match(client, /"syncing"/u);
  assert.match(
    state,
    /window\.setInterval\([\s\S]*?refreshFromServer\(\)[\s\S]*?seconds \* 1000\)/u,
  );
  assert.match(
    state,
    /equalRevisions\(featureRevisions\.current, result\.featureRevisions\)/u,
  );
  assert.match(state, /mergeThreeWay/u);
});

test(
  "the Forge gateway broadcasts presence, typing and state-change signals",
  { timeout: 15_000 },
  async () => {
    const port = 34_000 + Math.floor(Math.random() * 1_000);
    const secret = "test-realtime-secret-that-is-more-than-32-characters";
    const child = spawn(process.execPath, ["realtime/server.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        NODE_ENV: "test",
        REALTIME_PORT: String(port),
        REALTIME_TOKEN_SECRET: secret,
        REALTIME_ALLOWED_ORIGINS: "http://127.0.0.1:3000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Realtime gateway did not start")),
        4_000,
      );
      child.stdout.on("data", (data) => {
        if (String(data).includes("realtime gateway listening")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", (code) =>
        reject(new Error(`Realtime gateway exited early (${code})`)),
      );
    });
    let first;
    let second;
    try {
      await ready;
      const health = await fetch(`http://127.0.0.1:${port}/health`).then(
        (response) => response.json(),
      );
      assert.equal(health.healthy, true);
      first = await openSocket(port, sign(secret, "muneeb", "Muneeb Rizwan"));
      const presence = nextMessage(
        first,
        (message) =>
          message.type === "presence.snapshot" && message.users?.length === 2,
      );
      second = await openSocket(port, sign(secret, "sam", "Sam Wilson"));
      assert.equal((await presence).users.length, 2);
      const typing = nextMessage(
        second,
        (message) => message.type === "chat.typing",
      );
      first.send(
        JSON.stringify({
          type: "chat.typing",
          conversationId: "CHAT-01",
          active: true,
        }),
      );
      assert.deepEqual(await typing, {
        type: "chat.typing",
        actor: { id: "muneeb", name: "Muneeb Rizwan" },
        conversationId: "CHAT-01",
        active: true,
        sentAt: (await typing).sentAt,
      });
      const changed = nextMessage(
        second,
        (message) => message.type === "state.changed",
      );
      first.send(
        JSON.stringify({
          type: "state.changed",
          areas: ["conversations"],
          revision: 42,
        }),
      );
      const event = await changed;
      assert.deepEqual(event.areas, ["conversations"]);
      assert.equal(event.revision, 42);
    } finally {
      first?.close();
      second?.close();
      child.kill("SIGTERM");
    }
  },
);
