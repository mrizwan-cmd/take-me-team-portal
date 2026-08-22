"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RealtimeStatus = "live" | "connecting" | "syncing" | "offline" | "disabled";
export type RealtimeEvent = {
  type: string;
  actor?: { id: string; name: string };
  conversationId?: string;
  messageId?: string;
  status?: "delivered" | "read";
  active?: boolean;
  area?: string;
  resourceId?: string;
  areas?: string[];
  users?: Array<{ id: string; name: string }>;
  sentAt?: number;
  eventId?: string;
};

export type RealtimeControls = {
  status: RealtimeStatus;
  configured: boolean;
  onlineUsers: Array<{ id: string; name: string }>;
  latestEvent: RealtimeEvent | null;
  events: RealtimeEvent[];
  send: (event: Record<string, unknown>) => boolean;
};

export function useRealtime(enabled: boolean, onStateChanged: () => void): RealtimeControls {
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? "connecting" : "disabled");
  const [configured, setConfigured] = useState(false);
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string }>>([]);
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const heartbeatTimer = useRef<number | null>(null);
  const attempts = useRef(0);
  const active = useRef(true);
  const stateChanged = useRef(onStateChanged);

  useEffect(() => { stateChanged.current = onStateChanged; }, [onStateChanged]);

  const stopTimers = useCallback(() => {
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    if (heartbeatTimer.current) window.clearInterval(heartbeatTimer.current);
    reconnectTimer.current = null;
    heartbeatTimer.current = null;
  }, []);

  useEffect(() => {
    active.current = true;
    if (!enabled) {
      socket.current?.close(1000, "Realtime disabled");
      socket.current = null;
      stopTimers();
      return () => { active.current = false; };
    }

    const connect = async () => {
      stopTimers();
      if (!navigator.onLine) { setStatus("offline"); return; }
      setStatus(attempts.current ? "syncing" : "connecting");
      try {
        const response = await fetch("/api/realtime/token", { headers: { accept: "application/json" }, cache: "no-store" });
        const result = await response.json() as { configured?: boolean; url?: string; token?: string };
        if (!active.current) return;
        if (!response.ok || !result.configured || !result.url || !result.token) {
          setConfigured(false);
          setStatus("syncing");
          return;
        }
        setConfigured(true);
        const nextSocket = new WebSocket(result.url, ["take-me-realtime-v1", `auth.${result.token}`]);
        socket.current = nextSocket;
        nextSocket.onopen = () => {
          if (!active.current) return nextSocket.close();
          attempts.current = 0;
          setStatus("live");
          heartbeatTimer.current = window.setInterval(() => {
            if (nextSocket.readyState === WebSocket.OPEN) nextSocket.send(JSON.stringify({ type: "ping", sentAt: Date.now() }));
          }, 25_000);
        };
        nextSocket.onmessage = message => {
          try {
            const event = JSON.parse(String(message.data)) as RealtimeEvent;
            if (!event || typeof event.type !== "string") return;
            if (event.type === "state.changed") stateChanged.current();
            if (event.type === "presence.snapshot" && Array.isArray(event.users)) setOnlineUsers(event.users);
            const received = { ...event, eventId: crypto.randomUUID() };
            setLatestEvent(received);
            setEvents(current => [...current.slice(-49), received]);
          } catch { /* ignore malformed gateway messages */ }
        };
        nextSocket.onerror = () => nextSocket.close();
        nextSocket.onclose = event => {
          if (socket.current === nextSocket) socket.current = null;
          if (heartbeatTimer.current) window.clearInterval(heartbeatTimer.current);
          heartbeatTimer.current = null;
          setOnlineUsers([]);
          if (!active.current || event.code === 1000) return;
          setStatus(navigator.onLine ? "syncing" : "offline");
          attempts.current += 1;
          const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts.current, 5));
          reconnectTimer.current = window.setTimeout(connect, delay);
        };
      } catch {
        if (!active.current) return;
        setConfigured(false);
        setStatus(navigator.onLine ? "syncing" : "offline");
        attempts.current += 1;
        reconnectTimer.current = window.setTimeout(connect, Math.min(30_000, 2_000 * attempts.current));
      }
    };

    const online = () => { attempts.current = 0; void connect(); };
    const offline = () => { setStatus("offline"); socket.current?.close(); };
    const visible = () => { if (document.visibilityState === "visible" && !socket.current) void connect(); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    void connect();
    return () => {
      active.current = false;
      stopTimers();
      socket.current?.close(1000, "Page closed");
      socket.current = null;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, stopTimers]);

  const send = useCallback((event: Record<string, unknown>) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(event));
    return true;
  }, []);

  return { status: enabled ? status : "disabled", configured: enabled && configured, onlineUsers: enabled ? onlineUsers : [], latestEvent: enabled ? latestEvent : null, events: enabled ? events : [], send };
}
