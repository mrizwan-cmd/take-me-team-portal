import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const port = Number(process.env.REALTIME_PORT || 3001);
const secret = process.env.REALTIME_TOKEN_SECRET || "";
const workspace = "take-me-group";
const allowedOrigins = new Set((process.env.REALTIME_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
const clients = new Map();

if (secret.length < 32) throw new Error("REALTIME_TOKEN_SECRET must contain at least 32 characters");
if (process.env.NODE_ENV === "production" && !allowedOrigins.size) throw new Error("REALTIME_ALLOWED_ORIGINS is required in production");

function verifyToken(token) {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims.sub || !claims.name || claims.workspace !== workspace || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}

function protocolToken(request) {
  const protocols = String(request.headers["sec-websocket-protocol"] || "").split(",").map(value => value.trim());
  const auth = protocols.find(value => value.startsWith("auth."));
  return auth ? auth.slice(5) : "";
}

function send(client, message) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
}

function snapshot() {
  const users = new Map();
  for (const meta of clients.values()) users.set(meta.claims.sub, { id: meta.claims.sub, name: meta.claims.name });
  return [...users.values()];
}

function broadcast(message, except = null) {
  for (const client of clients.keys()) if (client !== except) send(client, message);
}

function chatParticipants(event, claims) {
  if (!Array.isArray(event.participants) || typeof claims.email !== "string") return null;
  const participants = [...new Set(event.participants.map(value => String(value).trim().toLowerCase()).filter(Boolean))];
  const sender = claims.email.toLowerCase();
  const domain = sender.split("@")[1];
  if (participants.length !== 2 || !participants.includes(sender) || !domain || participants.some(email => !email.endsWith(`@${domain}`))) return null;
  return participants;
}

function broadcastToParticipants(message, participants, except = null) {
  for (const [client, meta] of clients) {
    if (client === except || !participants.includes(String(meta.claims.email || "").toLowerCase())) continue;
    send(client, message);
  }
}

function broadcastPresence() {
  broadcast({ type: "presence.snapshot", users: snapshot(), sentAt: Date.now() });
}

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ healthy: true, connections: clients.size, checkedAt: new Date().toISOString() }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false, handleProtocols: protocols => protocols.has("take-me-realtime-v1") ? "take-me-realtime-v1" : false });

httpServer.on("upgrade", (request, socket, head) => {
  const origin = String(request.headers.origin || "");
  if ((allowedOrigins.size && !allowedOrigins.has(origin)) || (!origin && process.env.NODE_ENV === "production")) return socket.destroy();
  const claims = verifyToken(protocolToken(request));
  if (!claims) return socket.destroy();
  websocketServer.handleUpgrade(request, socket, head, client => websocketServer.emit("connection", client, request, claims));
});

websocketServer.on("connection", (client, _request, claims) => {
  clients.set(client, { claims, alive: true, messages: [] });
  send(client, { type: "connection.ready", actor: { id: claims.sub, name: claims.name }, sentAt: Date.now() });
  broadcastPresence();

  client.on("pong", () => { const meta = clients.get(client); if (meta) meta.alive = true; });
  client.on("message", payload => {
    const meta = clients.get(client); if (!meta) return;
    const now = Date.now();
    meta.messages = meta.messages.filter(time => now - time < 10_000);
    if (meta.messages.length >= 80) return client.close(1008, "Rate limit exceeded");
    meta.messages.push(now);
    let event;
    try { event = JSON.parse(String(payload)); } catch { return; }
    if (!event || typeof event.type !== "string") return;
    const actor = { id: claims.sub, name: claims.name };
    const chatActor = { ...actor, email: claims.email };
    if (event.type === "ping") return send(client, { type: "pong", sentAt: now });
    if (event.type === "state.changed") {
      const allowed = new Set(["requests", "approvals", "conversations", "documents", "articles", "projectBoards", "projectAutomations", "adminSettings", "features", "operations", "personal"]);
      const areas = Array.isArray(event.areas) ? event.areas.filter(value => typeof value === "string" && allowed.has(value)).slice(0, 12) : [];
      return broadcast({ type: "state.changed", actor, areas, revision: Number(event.revision || 0), personalRevision: Number(event.personalRevision || 0), sentAt: now }, client);
    }
    if (event.type === "chat.typing" && typeof event.conversationId === "string" && event.conversationId.length <= 120) {
      const participants = chatParticipants(event, claims); if (!participants) return;
      return broadcastToParticipants({ type: "chat.typing", actor: chatActor, conversationId: event.conversationId, active: Boolean(event.active), sentAt: now }, participants, client);
    }
    if (event.type === "chat.message" && typeof event.conversationId === "string" && event.conversationId.length <= 120 && typeof event.messageId === "string" && event.messageId.length <= 120) {
      const participants = chatParticipants(event, claims); if (!participants) return;
      return broadcastToParticipants({ type: "chat.message", actor: chatActor, conversationId: event.conversationId, messageId: event.messageId, sentAt: now }, participants, client);
    }
    if (event.type === "chat.receipt" && typeof event.conversationId === "string" && event.conversationId.length <= 120 && typeof event.messageId === "string" && event.messageId.length <= 120 && ["delivered", "read"].includes(event.status)) {
      const participants = chatParticipants(event, claims); if (!participants) return;
      return broadcastToParticipants({ type: "chat.receipt", actor: chatActor, conversationId: event.conversationId, messageId: event.messageId, status: event.status, sentAt: now }, participants, client);
    }
    if (event.type === "presence.viewing" && typeof event.area === "string" && event.area.length <= 80) {
      const resourceId = typeof event.resourceId === "string" ? event.resourceId.slice(0, 120) : "";
      return broadcast({ type: "presence.viewing", actor, area: event.area, resourceId, sentAt: now }, client);
    }
  });
  client.on("close", () => { clients.delete(client); broadcastPresence(); });
});

const heartbeat = setInterval(() => {
  for (const [client, meta] of clients) {
    if (!meta.alive) { client.terminate(); clients.delete(client); continue; }
    meta.alive = false;
    client.ping();
  }
}, 30_000);
heartbeat.unref();

httpServer.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Take Me realtime gateway listening on 127.0.0.1:${port}\n`);
});

function shutdown() {
  broadcast({ type: "server.restart", sentAt: Date.now() });
  for (const client of clients.keys()) client.close(1012, "Service restarting");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
