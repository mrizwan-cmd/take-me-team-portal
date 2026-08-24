"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PortalState } from "./portal-data";
import { PageIntro, SvgIcon, type Notify } from "./portal-ui";

type GoogleSpace = {
  name: string;
  displayName?: string;
  spaceType?: "SPACE" | "GROUP_CHAT" | "DIRECT_MESSAGE";
  spaceUri?: string;
  lastActiveTime?: string;
};

type GoogleMessage = {
  name: string;
  text?: string;
  formattedText?: string;
  createTime?: string;
  sender?: { name?: string; displayName?: string; type?: string };
  thread?: { name?: string };
};

type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  scope?: string;
};

const requiredScopes = [
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages",
];

function safeChatUrl(value?: string) {
  try {
    const url = new URL(value || "https://chat.google.com/");
    return url.protocol === "https:" && url.hostname === "chat.google.com"
      ? url.href
      : "https://chat.google.com/";
  } catch {
    return "https://chat.google.com/";
  }
}

function initials(value: string) {
  return value.split(/\s+/u).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "GC";
}

function googleErrorMessage(payload: { error?: { message?: string } | string }, fallback: string) {
  return typeof payload.error === "string" ? payload.error : payload.error?.message || fallback;
}

export default function GoogleChatPortal({ state, notify, navigate }: { state: PortalState; notify: Notify; navigate: (page: string) => void }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [spaces, setSpaces] = useState<GoogleSpace[]>([]);
  const [activeName, setActiveName] = useState("");
  const [messages, setMessages] = useState<GoogleMessage[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const active = spaces.find(space => space.name === activeName) || spaces[0];
  const hasScopes = requiredScopes.every(scope => status?.scope?.includes(scope));
  const filteredSpaces = useMemo(() => spaces.filter(space =>
    `${space.displayName || "Direct message"} ${space.spaceType || ""}`.toLowerCase().includes(query.toLowerCase()),
  ), [spaces, query]);

  const loadSpaces = async () => {
    setLoading(true);
    setError("");
    try {
      const statusResponse = await fetch("/api/google/status", { cache: "no-store" });
      const nextStatus = await statusResponse.json() as GoogleStatus & { error?: string };
      if (!statusResponse.ok) throw new Error(nextStatus.error || "Google connection status could not be loaded");
      setStatus(nextStatus);
      if (!nextStatus.connected || !requiredScopes.every(scope => nextStatus.scope?.includes(scope))) return;
      const response = await fetch("/api/google/chat", { cache: "no-store" });
      const result = await response.json() as { spaces?: GoogleSpace[]; error?: { message?: string } | string };
      if (!response.ok) throw new Error(googleErrorMessage(result, "Google Chat spaces could not be loaded"));
      const nextSpaces = result.spaces || [];
      setSpaces(nextSpaces);
      setActiveName(current => nextSpaces.some(space => space.name === current) ? current : nextSpaces[0]?.name || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Google Chat could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSpaces(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!active?.name || !hasScopes) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMessagesLoading(true);
      setError("");
      fetch(`/api/google/chat?space=${encodeURIComponent(active.name)}`, { cache: "no-store", signal: controller.signal })
        .then(async response => {
          const result = await response.json() as { messages?: GoogleMessage[]; error?: { message?: string } | string };
          if (!response.ok) throw new Error(googleErrorMessage(result, "Messages could not be loaded"));
          setMessages((result.messages || []).reverse());
        })
        .catch(reason => { if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Messages could not be loaded"); })
        .finally(() => setMessagesLoading(false));
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [active?.name, hasScopes]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!active || !text || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/google/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ space: active.name, text }),
      });
      const result = await response.json() as GoogleMessage & { error?: { message?: string } | string };
      if (!response.ok) throw new Error(googleErrorMessage(result, "Message could not be sent"));
      setMessages(current => [...current, result]);
      setDraft("");
      notify("Message sent through Google Chat");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Message could not be sent";
      setError(message);
      notify(message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="google-chat-state"><i className="portal-spinner" /><b>Loading Google Chat…</b><span>Your portal messages remain available in the other tab.</span></div>;

  if (!status?.connected || !hasScopes) return (
    <div className="google-chat-state google-chat-connect">
      <i><SvgIcon name="chat" size={26} /></i>
      <span className="experimental-badge">TESTING</span>
      <h2>{status?.connected ? "Allow Google Chat access" : "Connect Google Workspace"}</h2>
      <p>{status?.connected ? "Your existing Google connection needs the additional Chat permissions. Reconnecting keeps Calendar and Drive access and adds spaces and messages." : "Connect the same company Google account you use for the portal. Your existing portal chat will stay unchanged."}</p>
      <a className="primary button-link" href="/api/auth/google/start">{status?.connected ? "Review Google permissions" : "Connect Google Chat"}</a>
      <small>Google will show exactly which permissions are requested before anything is connected.</small>
    </div>
  );

  return <div className="google-chat-experiment">
    <PageIntro eyebrow="GOOGLE CHAT · TESTING" title="Google Chat" text={`Live spaces and messages for ${status.email || state.profile.email}. Portal chat remains separate.`} action={<a className="secondary button-link" href="https://chat.google.com/" target="_blank" rel="noreferrer">Open Google Chat ↗</a>} />
    {error && <div className="google-chat-error" role="alert"><span>{error}</span><button onClick={() => void loadSpaces()}>Try again</button></div>}
    <section className="card google-chat-layout">
      <aside className="google-space-list" aria-label="Google Chat spaces">
        <header><div><h3>Conversations</h3><small>{spaces.length} from Google Chat</small></div><button aria-label="Refresh Google Chat" onClick={() => void loadSpaces()}>↻</button></header>
        <input aria-label="Search Google Chat spaces" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search conversations" />
        <div className="google-space-scroll">
          {filteredSpaces.map(space => <button key={space.name} className={space.name === active?.name ? "active" : ""} onClick={() => setActiveName(space.name)}>
            <i>{space.spaceType === "SPACE" ? "#" : initials(space.displayName || "Google Chat")}</i>
            <span><b>{space.displayName || (space.spaceType === "DIRECT_MESSAGE" ? "Direct message" : "Google Chat conversation")}</b><small>{space.spaceType === "SPACE" ? "Space" : space.spaceType === "GROUP_CHAT" ? "Group conversation" : "Direct conversation"}</small></span>
          </button>)}
          {!filteredSpaces.length && <p>No Google Chat conversations match this search.</p>}
        </div>
      </aside>
      {active ? <div className="google-conversation">
        <header><div><h2>{active.displayName || "Google Chat conversation"}</h2><p>Synced from Google Chat</p></div><a className="secondary button-link" href={safeChatUrl(active.spaceUri)} target="_blank" rel="noreferrer">Open in Google Chat ↗</a></header>
        <div className="google-messages" ref={messagesRef} role="log" aria-live="polite">
          {messagesLoading ? <div className="google-message-state">Loading messages…</div> : messages.length ? messages.map(message => {
            const author = message.sender?.displayName || (message.sender?.type === "BOT" ? "Google Chat app" : "Colleague");
            const mine = author === state.profile.name;
            return <article className={mine ? "mine" : ""} key={message.name}><i>{initials(author)}</i><div><b>{author}</b><p>{message.text || message.formattedText || "Unsupported Google Chat content — open it in Google Chat."}</p><time>{message.createTime ? new Date(message.createTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}</time></div></article>;
          }) : <div className="google-message-state"><b>No messages returned</b><span>This conversation may be empty or its history might be restricted.</span></div>}
        </div>
        <div className="google-composer"><textarea aria-label="Message Google Chat conversation" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder={`Message ${active.displayName || "this conversation"}`} rows={1} /><button className="primary" disabled={!draft.trim() || sending} onClick={() => void send()}>{sending ? "Sending…" : "Send"}</button></div>
      </div> : <div className="google-message-state"><b>No Google Chat spaces available</b><span>Create or join a conversation in Google Chat, then refresh this tab.</span></div>}
      <aside className="google-context" aria-label="Portal context"><header><span>PORTAL CONTEXT</span><h3>Keep work connected</h3><p>Open related Take Me records without leaving this conversation.</p></header>
        <button onClick={() => navigate("People")}><i><SvgIcon name="people" size={17} /></i><span><b>Employee profiles</b><small>{state.employees.length} colleagues</small></span><em>→</em></button>
        <button onClick={() => navigate("Projects")}><i><SvgIcon name="projects" size={17} /></i><span><b>Projects</b><small>{state.projectBoards.length} workspaces</small></span><em>→</em></button>
        <button onClick={() => navigate("Action inbox")}><i><SvgIcon name="check" size={17} /></i><span><b>Approvals</b><small>{state.approvals.filter(item => item.status === "Pending").length} waiting</small></span><em>→</em></button>
        <button onClick={() => navigate("Requests")}><i><SvgIcon name="requests" size={17} /></i><span><b>Requests</b><small>{state.requests.length} records</small></span><em>→</em></button>
      </aside>
    </section>
  </div>;
}
