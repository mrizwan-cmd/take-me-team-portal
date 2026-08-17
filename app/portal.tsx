"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminPortal from "./admin-portal";
import EmployeePortal from "./employee-portal";
import LoginScreen from "./login-screen";
import { HelpCentre, OnboardingGuide } from "./onboarding";
import { makeId, type FeatureKey, type PortalState, type RequestItem } from "./portal-data";
import { Modal, SvgIcon, Toggle } from "./portal-ui";
import { usePortalState } from "./use-portal-state";

const employeeNav: [string, string, FeatureKey?][] = [
  ["Home", "home"], ["Action inbox", "check", "actionInbox"], ["Tasks", "tasks"], ["Projects", "projects"], ["People", "people"], ["Requests", "requests"],
  ["Calendar", "calendar"], ["Knowledge", "knowledge"], ["Documents", "documents"], ["Chat", "chat"],
  ["Leave & shifts", "leave"], ["Operations", "operations"],
];
const adminNav: [string, string][] = [
  ["Overview", "home"], ["People & access", "people"], ["Departments", "settings"], ["Forms & workflows", "requests"], ["Purchase orders", "requests"],
  ["Feature controls", "projects"], ["Project management", "projects"], ["Content", "knowledge"], ["Notifications", "bell"], ["Integrations", "link"], ["Security", "lock"], ["Audit log", "documents"],
];

type DeferredInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function Portal() {
  const { state, updateState, saveStatus, identity, loadError, realtime } = usePortalState();
  const [admin, setAdmin] = useState(false);
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [createKind, setCreateKind] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [panel, setPanel] = useState<"notifications" | "help" | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<DeferredInstall | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [loginPreview, setLoginPreview] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const sendRealtime = realtime.send;

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToast(""); toastTimer.current = null; }, 2600);
  };
  const pushRoute = (next: string, nextAdmin: boolean) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("create");
    url.searchParams.delete("source");
    if (next !== "Projects") url.searchParams.delete("board");
    if (nextAdmin) { url.searchParams.set("admin", "1"); url.searchParams.set("page", next); }
    else { url.searchParams.delete("admin"); url.searchParams.set("page", next); }
    window.history.pushState({ page: next, admin: nextAdmin }, "", `${url.pathname}${url.search}`);
  };
  const navigate = (next: string) => { setPage(next); setMenuOpen(false); setCommandOpen(false); setCommandQuery(""); pushRoute(next, admin); };
  const openAdmin = (next = "Overview") => { if (!identity?.isAdmin) return notify("Administrator access is required"); setAdmin(true); setPage(next); setMenuOpen(false); setCommandOpen(false); pushRoute(next, true); };
  const openEmployee = () => { setAdmin(false); setPage("Home"); setMenuOpen(false); pushRoute("Home", false); };

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedPage = params.get("page");
      setLoginPreview(params.get("preview") === "login");
      const initialPage = requestedPage && employeeNav.some(item => item[0] === requestedPage) ? requestedPage : "Home";
      const requestedCreate = params.get("create");
      setPage(initialPage);
      if (requestedCreate && ["request", "event", "conversation", "task", "leave", "shift", "incident", "handover"].includes(requestedCreate)) setCreateKind(requestedCreate);
      window.history.replaceState({ page: initialPage, admin: false }, "", window.location.href);
    }, 0);
    const onPopState = (event: PopStateEvent) => {
      const nextPage = typeof event.state?.page === "string" ? event.state.page : "Home";
      setAdmin(Boolean(event.state?.admin));
      setPage(nextPage);
      setMenuOpen(false);
      setCommandOpen(false);
      setCreateKind(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => { window.clearTimeout(initialTimer); window.removeEventListener("popstate", onPopState); };
  }, []);

  useEffect(() => {
    if (!identity) return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("page");
    const routeTimer = window.setTimeout(() => {
      if (params.get("admin") === "1" && identity.isAdmin) {
        setAdmin(true);
        setPage(requested && adminNav.some(item => item[0] === requested) ? requested : "Overview");
      } else {
        setAdmin(false);
        setPage(requested && employeeNav.some(item => item[0] === requested) ? requested : "Home");
      }
      setRouteReady(true);
    }, 0);
    return () => window.clearTimeout(routeTimer);
  }, [identity]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setCreateKind(null); setPanel(null); }
    };
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as DeferredInstall); };
    const onInstalled = () => { setIsStandalone(true); setInstallPrompt(null); };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const environmentTimer = window.setTimeout(() => {
      setIsOnline(navigator.onLine);
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
      setInstallDismissed(window.localStorage.getItem("take-me-install-dismissed") === "1");
    }, 0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (state.features.pwa && process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.clearTimeout(environmentTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [state.features.pwa]);

  useEffect(() => {
    if (!identity || !state.adminSettings.realtimePresence) return;
    sendRealtime({ type: "presence.viewing", area: admin ? `Admin: ${page}` : page });
  }, [admin, identity, page, realtime.status, sendRealtime, state.adminSettings.realtimePresence]);

  useEffect(() => {
    if (!identity || admin || !routeReady || createKind !== null || commandOpen || panel || profileOpen || state.preferences.onboardingComplete || onboardingDismissed) return;
    const timer = window.setTimeout(() => setOnboardingOpen(true), 350);
    return () => window.clearTimeout(timer);
  }, [admin, commandOpen, createKind, identity, onboardingDismissed, panel, profileOpen, routeReady, state.preferences.onboardingComplete]);

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") { setIsStandalone(true); notify("Take Me Portal installed"); }
      setInstallPrompt(null);
      return;
    }
    notify(isIos ? "Tap Share, then Add to Home Screen" : "Open the browser menu and choose Install app");
  };
  const dismissInstall = () => {
    window.localStorage.setItem("take-me-install-dismissed", "1");
    setInstallDismissed(true);
  };

  if (loginPreview || loadError === "Company sign-in is required") return <LoginScreen offline={!isOnline} />;
  if (loadError) return <main className="access-screen"><section><Image src="/take-me-logo-black.png" alt="Take Me" width={74} height={78} priority /><p>TAKE ME TEAM PORTAL</p><h1>{isOnline ? loadError : "You’re offline"}</h1><p>{isOnline ? "Your portal data has not been shown. Sign in with your company account or retry when the service is available." : "Reconnect to securely load company information and save changes."}</p><button className="primary" onClick={() => window.location.reload()}>Try again</button></section></main>;
  if (!identity || !routeReady) return <main className="access-screen portal-loading" aria-busy="true"><section role="status" aria-live="polite"><Image src="/take-me-logo-black.png" alt="Take Me" width={74} height={78} priority /><p>TAKE ME TEAM PORTAL</p><i aria-hidden="true" /><h1>Opening your secure workspace</h1><p>Checking your company session and loading the latest portal data…</p></section></main>;

  const visibleNav = employeeNav.filter(item => (!item[2] || state.features[item[2]]) && (item[0] !== "Action inbox" || Boolean(identity?.canApprove)));
  const unread = state.notifications.filter(item => !item.read && !item.snoozed).length;
  const pending = state.approvals.filter(item => item.status === "Pending").length;
  const shellClass = ["shell", state.preferences.theme === "dark" ? "dark-mode" : "", state.preferences.textSize === "large" ? "large-text" : "", state.preferences.highContrast ? "high-contrast" : "", state.preferences.reducedMotion ? "reduced-motion" : ""].filter(Boolean).join(" ");

  return (
    <main className={shellClass}>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label={admin ? "Administration navigation" : "Employee navigation"}>
        <div className="brand">
          <Image src="/take-me-logo-black.png" alt="Take Me" width={54} height={58} priority />
          <div>Team Portal<small>TAKE ME GROUP</small></div>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <button className="workspace" onClick={() => notify("Take Me Group workspace selected")}>
          <i>TM</i>
          <span>Take Me Group<small>Company workspace</small></span>
          <b>⌄</b>
        </button>
        <nav>
          {(admin ? adminNav : visibleNav).map(item => (
            <button key={item[0]} className={page === item[0] ? "active" : ""} onClick={() => navigate(item[0])}>
              <em><SvgIcon name={item[1]} size={16} /></em>
              <span>{item[0]}</span>
              {item[0] === "Action inbox" && pending > 0 && <mark>{pending}</mark>}
              {item[0] === "Chat" && state.conversations.reduce((sum, chat) => sum + chat.unread, 0) > 0 && <mark>{state.conversations.reduce((sum, chat) => sum + chat.unread, 0)}</mark>}
            </button>
          ))}
        </nav>
        <div className="sidefoot">
          {(admin || identity?.isAdmin) && (
            <button className="admin-entry" onClick={admin ? openEmployee : () => openAdmin()}>
              <em><SvgIcon name={admin ? "home" : "settings"} size={16} /></em>
              <span>{admin ? "Employee portal" : "Admin settings"}</span>
            </button>
          )}
          <button onClick={() => { setPanel("help"); setMenuOpen(false); }}>
            <em><SvgIcon name="help" size={16} /></em>
            <span>Help centre</span>
          </button>
          <button className="user" onClick={() => { setProfileOpen(true); setMenuOpen(false); }}>
            <i>{initials(state.profile.name)}</i>
            <span><b>{state.profile.name}</b><small>{admin ? "Super administrator" : state.profile.jobTitle}</small></span>
            <em>•••</em>
          </button>
        </div>
        <a className="sidebar-signout" href="/api/auth/logout">
          <em><SvgIcon name="logout" size={16} /></em>
          <span>Sign out</span>
        </a>
      </aside>

      <section className="content">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
            <SvgIcon name="menu" size={18} />
          </button>
          <Image className="mobile-logo" src="/take-me-logo-black.png" alt="" width={34} height={38} />
          <button className="global-search" onClick={() => setCommandOpen(true)}>
            <span><SvgIcon name="search" size={16} /></span>
            <b>Search people, documents, forms and commands</b>
            <kbd>CTRL K</kbd>
          </button>
          <span className={`realtime-status ${realtime.status}`} title={realtime.status === "live" ? `${Math.max(1, realtime.onlineUsers.length)} connected employee session${realtime.onlineUsers.length === 1 ? "" : "s"}` : realtime.status === "syncing" ? "Changes refresh automatically in the background" : realtime.status === "offline" ? "Live updates will resume after reconnection" : realtime.status === "disabled" ? "Realtime updates are disabled by an administrator" : "Connecting to live updates"}>
            <i />{realtime.status === "live" ? "Live" : realtime.status === "syncing" ? "Auto-sync" : realtime.status === "offline" ? "Offline" : realtime.status === "disabled" ? "Sync off" : "Connecting"}
          </span>
          <span className={`save-status ${saveStatus === "Saved" ? "saved" : saveStatus.startsWith("Conflict") || saveStatus === "Save failed" ? "conflict" : ""}`} title={saveStatus.startsWith("Conflict") ? "Another session changed portal data. Your changes are being merged safely." : saveStatus === "Save failed" ? "Changes could not be saved. Check the connection before continuing." : undefined}>
            {saveStatus === "Saved" ? "● Saved" : saveStatus}
          </span>
          {!admin && state.features.quickCreate && (
            <button className="top-create" onClick={() => setCreateKind("")} title="Quick create">
              <SvgIcon name="plus" size={15} />
              <span>Create</span>
            </button>
          )}
          {!admin && identity?.isAdmin && (
            <button className="admin-shortcut" onClick={() => openAdmin()} title="Open Admin settings">
              <SvgIcon name="settings" size={15} />
              <span>Admin</span>
            </button>
          )}
          <button className="icon-button" aria-label="Help" onClick={() => setPanel("help")}>
            <SvgIcon name="help" size={16} />
          </button>
          <button className="icon-button" aria-label={`${unread} unread notifications`} onClick={() => setPanel("notifications")}>
            <SvgIcon name="bell" size={16} />
            {unread > 0 && <sup>{unread}</sup>}
          </button>
        </header>

        {!isOnline && <div className="network-banner" role="status">You’re offline. Reconnect before saving company changes.</div>}
        {!admin && page === "Home" && state.features.pwa && !isStandalone && !installDismissed && (
          <aside className="app-install-banner" aria-label="Install Take Me Portal">
            <i><Image src="/take-me-icon-192.png" alt="" width={36} height={36} /></i>
            <span>
              <b>Add Take Me to your phone</b>
              <small>{isIos ? "Open it like an app from your iPhone Home Screen." : "Faster access with a full-screen app experience."}</small>
            </span>
            <span className="install-actions">
              <button onClick={installApp}>Install</button>
              <button className="dismiss-install" aria-label="Dismiss install suggestion" onClick={dismissInstall}>×</button>
            </span>
          </aside>
        )}

        {admin ? (
          <AdminPortal page={page} state={state} updateState={updateState} navigate={navigate} notify={notify} realtime={realtime} />
        ) : (
          <EmployeePortal page={page} state={state} updateState={updateState} navigate={navigate} notify={notify} openCreate={(kind = "") => setCreateKind(kind)} openNotifications={() => setPanel("notifications")} realtime={realtime} />
        )}
      </section>

      <nav className="mobile-bottom-nav" aria-label={admin ? "Admin app navigation" : "Employee app navigation"}>
        {admin ? (
          <>
            <button className={page === "Overview" ? "active" : ""} aria-current={page === "Overview" ? "page" : undefined} onClick={() => navigate("Overview")}>
              <i><SvgIcon name="home" size={18} /></i>
              <span>Overview</span>
            </button>
            <button className={page === "People & access" ? "active" : ""} aria-current={page === "People & access" ? "page" : undefined} onClick={() => navigate("People & access")}>
              <i><SvgIcon name="people" size={18} /></i>
              <span>People</span>
            </button>
            <button className={page === "Forms & workflows" ? "active" : ""} aria-current={page === "Forms & workflows" ? "page" : undefined} onClick={() => navigate("Forms & workflows")}>
              <i><SvgIcon name="requests" size={18} /></i>
              <span>Workflows</span>
            </button>
            <button className={page === "Integrations" ? "active" : ""} aria-current={page === "Integrations" ? "page" : undefined} onClick={() => navigate("Integrations")}>
              <i><SvgIcon name="link" size={18} /></i>
              <span>Apps</span>
            </button>
            <button onClick={() => setMenuOpen(true)}>
              <i><SvgIcon name="menu" size={18} /></i>
              <span>More</span>
            </button>
          </>
        ) : (
          <>
            <button className={page === "Home" ? "active" : ""} aria-current={page === "Home" ? "page" : undefined} onClick={() => navigate("Home")}>
              <i><SvgIcon name="home" size={18} /></i>
              <span>Home</span>
            </button>
            {state.features.projects ? (
              <button className={page === "Projects" ? "active" : ""} aria-current={page === "Projects" ? "page" : undefined} onClick={() => navigate("Projects")}>
                <i><SvgIcon name="projects" size={18} /></i>
                <span>Projects</span>
              </button>
            ) : identity?.canApprove && state.features.actionInbox ? (
              <button className={page === "Action inbox" ? "active" : ""} aria-current={page === "Action inbox" ? "page" : undefined} onClick={() => navigate("Action inbox")}>
                <i><SvgIcon name="check" size={18} /></i>
                <span>Inbox</span>
                {pending > 0 && <mark>{pending}</mark>}
              </button>
            ) : (
              <button className={page === "Tasks" ? "active" : ""} aria-current={page === "Tasks" ? "page" : undefined} onClick={() => navigate("Tasks")}>
                <i><SvgIcon name="tasks" size={18} /></i>
                <span>Tasks</span>
              </button>
            )}
            <button className="create-tab" onClick={() => setCreateKind("")}>
              <i><SvgIcon name="plus" size={20} /></i>
              <span>Create</span>
            </button>
            {state.features.chat ? (
              <button className={page === "Chat" ? "active" : ""} aria-current={page === "Chat" ? "page" : undefined} onClick={() => navigate("Chat")}>
                <i><SvgIcon name="chat" size={18} /></i>
                <span>Chat</span>
                {state.conversations.reduce((sum, chat) => sum + chat.unread, 0) > 0 && <mark>{state.conversations.reduce((sum, chat) => sum + chat.unread, 0)}</mark>}
              </button>
            ) : (
              <button className={page === "Calendar" ? "active" : ""} aria-current={page === "Calendar" ? "page" : undefined} onClick={() => navigate("Calendar")}>
                <i><SvgIcon name="calendar" size={18} /></i>
                <span>Calendar</span>
              </button>
            )}
            <button onClick={() => setMenuOpen(true)}>
              <i><SvgIcon name="menu" size={18} /></i>
              <span>More</span>
            </button>
          </>
        )}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
      {commandOpen && (
        <CommandPalette state={state} query={commandQuery} setQuery={setCommandQuery} close={() => setCommandOpen(false)} navigate={navigate} openCreate={kind => { setCommandOpen(false); setCreateKind(kind); }} openAdmin={openAdmin} />
      )}
      {createKind !== null && (
        <QuickCreate kind={createKind} state={state} updateState={updateState} setKind={setCreateKind} close={() => setCreateKind(null)} notify={notify} />
      )}
      {panel && (
        <>
          <div className="backdrop" role="presentation" onClick={() => setPanel(null)} />
          <UtilityPanel type={panel} state={state} updateState={updateState} close={() => setPanel(null)} navigate={navigate} notify={notify} isAdmin={admin} restartTour={() => { updateState(current => ({ ...current, preferences: { ...current.preferences, onboardingComplete: false, onboardingStep: 0 } })); setOnboardingDismissed(false); setPanel(null); setOnboardingOpen(true); }} />
        </>
      )}
      {profileOpen && (
        <ProfileSettings state={state} updateState={updateState} close={() => setProfileOpen(false)} notify={notify} installPrompt={installPrompt} setInstallPrompt={setInstallPrompt} />
      )}
      {onboardingOpen && (
        <OnboardingGuide state={state} updateState={updateState} close={() => { setOnboardingOpen(false); setOnboardingDismissed(true); }} navigate={navigate} notify={notify} />
      )}
    </main>
  );
}

function CommandPalette({ state, query, setQuery, close, navigate, openCreate, openAdmin }: { state: PortalState; query: string; setQuery: (value: string) => void; close: () => void; navigate: (page: string) => void; openCreate: (kind: string) => void; openAdmin: (page?: string) => void }) {
  const items = useMemo(() => {
    const pages = employeeNav.map(item => ({ title: item[0], detail: "Open portal page", icon: item[1], action: () => navigate(item[0]) }));
    const records = [
      ...state.requests.map(item => ({ title: item.title, detail: `${item.id} · Request`, icon: "requests", action: () => navigate("Requests") })),
      ...state.documents.map(item => ({ title: item.name, detail: `${item.folder} · Document`, icon: "documents", action: () => navigate("Documents") })),
      ...state.articles.map(item => ({ title: item.title, detail: `${item.category} · Knowledge`, icon: "knowledge", action: () => navigate("Knowledge") })),
      ...state.conversations.map(item => ({ title: item.name, detail: `${item.type} · Chat`, icon: "chat", action: () => navigate("Chat") })),
    ];
    const commands = [["Create a request", "request", "requests"], ["Create a calendar event", "event", "calendar"], ["Start a conversation", "conversation", "chat"], ["Add a task", "task", "tasks"], ["Report an incident", "incident", "operations"]].map(item => ({ title: item[0], detail: "Quick command", icon: item[2], action: () => openCreate(item[1]) }));
    const adminItem = { title: "Open Admin settings", detail: "Administration", icon: "settings", action: () => openAdmin() };
    const sessionItem = { title: "Sign out", detail: "End this company session", icon: "logout", action: () => window.location.assign("/api/auth/logout") };
    return [...commands, sessionItem, adminItem, ...pages, ...records].filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  }, [navigate, openAdmin, openCreate, query, state]);

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Search portal">
        <header>
          <span><SvgIcon name="search" size={18} /></span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search or type a command…" autoFocus />
          <kbd>ESC</kbd>
        </header>
        <div className="command-results">
          {items.length ? items.map((item, index) => (
            <button key={`${item.title}-${index}`} onClick={item.action}>
              <i><SvgIcon name={item.icon} size={16} /></i>
              <span><b>{item.title}</b><small>{item.detail}</small></span>
              <em>↵</em>
            </button>
          )) : (
            <p>No results. Try a person, document, request or command.</p>
          )}
        </div>
        <footer>
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Ctrl K Anywhere</span>
        </footer>
      </section>
    </div>
  );
}

const createOptions = [
  ["request", "requests", "Request", "PO, expense, IT, marketing or facilities"],
  ["event", "calendar", "Calendar event", "Google Calendar and Meet"],
  ["conversation", "chat", "Conversation", "Channel, group or direct message"],
  ["task", "tasks", "Task", "Personal or shared follow-up"],
  ["leave", "leave", "Leave request", "Holiday, sickness or work from home"],
  ["shift", "clock", "Shift availability", "Offer availability or request a change"],
  ["incident", "operations", "Incident report", "Safety, complaint or vehicle issue"],
  ["handover", "document", "Handover note", "Pass an update to the next shift"],
];

function QuickCreate({ kind, state, updateState, setKind, close, notify }: { kind: string; state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; setKind: (kind: string) => void; close: () => void; notify: (message: string) => void }) {
  if (!kind || kind === "operations") {
    return (
      <Modal title="Quick create" eyebrow="START SOMETHING" close={close} className="quick-create-modal">
        <p className="modal-lead">Choose what you want to create.</p>
        <div className="create-grid">
          {createOptions.map(item => (
            <button key={item[0]} onClick={() => setKind(item[0])}>
              <i><SvgIcon name={item[1]} size={18} /></i>
              <span><b>{item[2]}</b><small>{item[3]}</small></span>
              <em>›</em>
            </button>
          ))}
        </div>
      </Modal>
    );
  }
  return <CreateForm kind={kind} state={state} updateState={updateState} close={close} notify={notify} back={() => setKind("")} />;
}

function CreateForm({ kind, state, updateState, close, notify, back }: { kind: string; state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; notify: (message: string) => void; back: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(kind === "request" ? "Purchase order" : kind === "conversation" ? "Channel" : kind === "leave" ? "Annual leave" : kind === "incident" ? "Vehicle" : "Normal");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState("2026-08-14");
  const [endDate, setEndDate] = useState("2026-08-15");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [people, setPeople] = useState("");
  const [amount, setAmount] = useState("");
  const [meet, setMeet] = useState(true);
  const [draft, setDraft] = useState(false);

  const labels: Record<string, [string, string]> = {
    request: ["New request", "REQUESTS & WORKFLOWS"],
    event: ["Create an event", "GOOGLE CALENDAR"],
    conversation: ["New conversation", "CHAT & CHANNELS"],
    task: ["Add a task", "TASKS"],
    leave: ["Request time away", "LEAVE & AVAILABILITY"],
    shift: ["Add shift availability", "ROTA"],
    incident: ["Report an incident", "SAFETY & OPERATIONS"],
    handover: ["Add a handover note", "OPERATIONS HANDOVER"],
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    let googleEvent: { id?: string; htmlLink?: string; hangoutLink?: string } | null = null;
    if (kind === "event") {
      try {
        const response = await fetch("/api/google/calendar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: cleanTitle,
            date,
            start,
            end,
            location: meet ? "Google Meet" : details,
            notes: details,
            guests: people.split(",").map(value => value.trim()).filter(Boolean),
            meet,
            timeZone: state.profile.timezone,
          }),
        });
        const result = await response.json() as { id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string } | string };
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : result.error?.message || "Google Calendar creation failed");
        googleEvent = result;
      } catch (error) {
        notify(`${error instanceof Error ? error.message : "Google Calendar unavailable"}; saved in the portal only`);
      }
    }

    updateState(current => {
      let next = current;
      if (kind === "request") {
        const request: RequestItem = {
          id: makeId(type === "Purchase order" ? "PO" : "REQ"),
          title: cleanTitle,
          type,
          amount: amount ? `£${amount}` : "—",
          status: draft ? "Draft" : "Awaiting approval",
          tone: draft ? "slate" : "amber",
          requester: current.profile.name,
          created: "Just now",
          details: details || "No additional details.",
          priority: "Normal",
          timeline: [
            { label: draft ? "Draft saved" : "Submitted", person: current.profile.name, time: "Just now", complete: true },
            { label: "Manager review", person: "Assigned automatically", time: "Waiting", complete: false },
            { label: "Final confirmation", person: "Portal workflow", time: "Waiting", complete: false },
          ],
        };
        next = { ...current, requests: [request, ...current.requests] };
      }
      if (kind === "event") {
        next = {
          ...current,
          events: [
            {
              id: makeId("EV"),
              title: cleanTitle,
              date,
              start,
              end,
              location: meet ? "Google Meet" : details || "To be confirmed",
              meet,
              guests: people.split(",").map(value => value.trim()).filter(Boolean),
              notes: details,
              googleId: googleEvent?.id,
              webLink: googleEvent?.htmlLink || googleEvent?.hangoutLink,
            },
            ...current.events,
          ],
        };
      }
      if (kind === "conversation") {
        next = {
          ...current,
          conversations: [
            {
              id: makeId("CHAT"),
              name: cleanTitle,
              type: type as "Channel" | "Group" | "Direct",
              members: people.split(",").map(value => value.trim()).filter(Boolean),
              unread: 0,
              messages: details ? [{ id: makeId("MSG"), author: current.profile.name, initials: initials(current.profile.name), text: details, time: "Now", mine: true }] : [],
            },
            ...current.conversations,
          ],
        };
      }
      if (kind === "task") next = { ...current, tasks: [{ id: makeId("TASK"), title: cleanTitle, owner: people || current.profile.name, due: date, status: "To do", source: details || "Quick create", priority: type }, ...current.tasks] };
      if (kind === "leave") next = { ...current, leave: [{ id: makeId("LEAVE"), employee: current.profile.name, type, dates: `${date} to ${endDate}`, days: Math.max(1, Number(amount) || 1), status: draft ? "Draft" : "Pending" }, ...current.leave] };
      if (kind === "shift") next = { ...current, shifts: [{ id: makeId("SHIFT"), date, time: `${start}–${end}`, team: cleanTitle, location: details || "Flexible", status: "Available" }, ...current.shifts] };
      if (kind === "incident") next = { ...current, incidents: [{ id: makeId("INC"), title: cleanTitle, category: type, reported: "Just now", owner: current.profile.name, status: "Reported", confidential: meet }, ...current.incidents] };
      if (kind === "handover") next = { ...current, handovers: [{ id: makeId("HAND"), shift: cleanTitle, author: current.profile.name, note: details, priority: type, read: false }, ...current.handovers] };
      return { ...next, audit: [{ id: makeId("AUD"), actor: current.profile.name, action: `Created ${kind}: ${cleanTitle}`, area: kind, time: "Just now" }, ...next.audit] };
    });
    notify(draft ? "Draft saved" : `${labels[kind]?.[0] || "Item"} created`);
    close();
  };

  return (
    <Modal title={labels[kind]?.[0] || "Create item"} eyebrow={labels[kind]?.[1]} close={close} className="medium-modal">
      <button className="back-button" onClick={back}>← All create options</button>
      <form className="create-form" onSubmit={submit}>
        <label>
          {kind === "conversation" ? "Conversation name" : kind === "handover" ? "Shift or handover title" : "Title"}
          <input data-initial-focus required value={title} onChange={event => setTitle(event.target.value)} placeholder="Enter a clear title" />
        </label>
        {(kind === "request" || kind === "conversation" || kind === "leave" || kind === "incident" || kind === "task" || kind === "handover") && (
          <label>
            {kind === "task" || kind === "handover" ? "Priority" : "Type"}
            <select value={type} onChange={event => setType(event.target.value)}>
              {(kind === "request"
                ? ["Purchase order", "Expense", "IT access", "Marketing support", "Facilities"]
                : kind === "conversation"
                ? ["Channel", "Group", "Direct"]
                : kind === "leave"
                ? ["Annual leave", "Sickness", "Work from home", "Unpaid leave"]
                : kind === "incident"
                ? ["Vehicle", "Accident", "Complaint", "Safeguarding", "System"]
                : ["Normal", "High", "Urgent"]
              ).map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        )}
        {(kind === "event" || kind === "task" || kind === "leave" || kind === "shift") && (
          <div className="form-grid">
            <label>
              {kind === "task" ? "Due date" : "Date"}
              <input type="date" value={date} onChange={event => setDate(event.target.value)} />
            </label>
            {(kind === "event" || kind === "shift") && (
              <>
                <label>Start<input type="time" value={start} onChange={event => setStart(event.target.value)} /></label>
                <label>End<input type="time" value={end} onChange={event => setEnd(event.target.value)} /></label>
              </>
            )}
            {kind === "leave" && (
              <label>End date<input type="date" min={date} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
            )}
          </div>
        )}
        {(kind === "request" || kind === "leave") && (
          <label>
            {kind === "leave" ? "Number of days" : "Amount, if applicable"}
            <input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder={kind === "leave" ? "1" : "0.00"} />
          </label>
        )}
        {(kind === "event" || kind === "conversation" || kind === "task") && (
          <label>
            {kind === "task" ? "Assign to" : kind === "conversation" ? "Add people" : "Guests"}
            <input value={people} onChange={event => setPeople(event.target.value)} placeholder="Names or @takeme.taxi addresses, separated by commas" />
          </label>
        )}
        <label>
          {kind === "conversation" ? "First message" : kind === "handover" ? "Handover note" : "Details"}
          <textarea value={details} onChange={event => setDetails(event.target.value)} placeholder="Add useful details" />
        </label>
        {kind === "event" && <label className="check-row"><input type="checkbox" checked={meet} onChange={event => setMeet(event.target.checked)} /> Add a Google Meet link</label>}
        {kind === "incident" && <label className="check-row"><input type="checkbox" checked={meet} onChange={event => setMeet(event.target.checked)} /> Keep this report confidential</label>}
        <div className="modal-actions">
          {(kind === "request" || kind === "leave") && <button type="submit" className="secondary" onClick={() => setDraft(true)}>Save draft</button>}
          <button type="button" className="secondary" onClick={close}>Cancel</button>
          <button className="primary" type="submit" onClick={() => setDraft(false)}>
            {kind === "event" ? "Create event" : kind === "conversation" ? "Create conversation" : kind === "incident" ? "Submit report" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UtilityPanel({ type, state, updateState, close, navigate, notify, restartTour, isAdmin }: { type: "notifications" | "help"; state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; navigate: (page: string) => void; notify: (message: string) => void; restartTour: () => void; isAdmin: boolean }) {
  const [group, setGroup] = useState("All");
  const groups = ["All", ...Array.from(new Set(state.notifications.map(item => item.group)))];
  const notifications = state.notifications.filter(item => !item.snoozed && (group === "All" || item.group === group));
  const destination: Record<string, string> = { Approvals: "Action inbox", Calendar: "Calendar", Operations: "Operations", Requests: "Requests" };

  if (type === "help") return <HelpCentre close={close} restartTour={restartTour} navigate={navigate} isAdmin={isAdmin} />;

  return (
    <div className="utility-panel notification-panel" role="dialog" aria-label="Notifications">
      <header>
        <div>
          <h2>Notifications</h2>
          <small>{state.notifications.filter(item => !item.read).length} unread</small>
        </div>
        <button aria-label="Close notifications" onClick={close}>×</button>
      </header>
      <div className="notification-groups">
        {groups.map(value => (
          <button className={group === value ? "active" : ""} key={value} onClick={() => setGroup(value)}>{value}</button>
        ))}
      </div>
      <div className="notification-list">
        {notifications.map(item => (
          <article className={item.read ? "read" : ""} key={item.id}>
            <button className="notification-main" onClick={() => { updateState(current => ({ ...current, notifications: current.notifications.map(value => value.id === item.id ? { ...value, read: true } : value) })); navigate(destination[item.group] || "Home"); close(); }}>
              <i><SvgIcon name="bell" size={12} /></i>
              <span><b>{item.title}</b><small>{item.detail} · {item.time}</small></span>
            </button>
            <button className="snooze" aria-label={`Snooze ${item.title}`} title="Snooze" onClick={() => { updateState(current => ({ ...current, notifications: current.notifications.map(value => value.id === item.id ? { ...value, snoozed: true } : value) })); notify("Notification snoozed"); }}>
              <SvgIcon name="clock" size={14} />
            </button>
          </article>
        ))}
      </div>
      <footer>
        <button onClick={() => updateState(current => ({ ...current, notifications: current.notifications.map(item => ({ ...item, read: true })) }))}>Mark all as read</button>
        <button onClick={() => { close(); setTimeout(() => navigate("Home"), 0); notify("Notification preferences are in Profile settings"); }}>Preferences</button>
      </footer>
    </div>
  );
}

function ProfileSettings({ state, updateState, close, notify, installPrompt, setInstallPrompt }: { state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; notify: (message: string) => void; installPrompt: DeferredInstall | null; setInstallPrompt: (value: DeferredInstall | null) => void }) {
  const [draft, setDraft] = useState(state.profile);
  const [prefs, setPrefs] = useState(state.preferences);
  const [googleStatus, setGoogleStatus] = useState<{ configured: boolean; connected: boolean; email: string } | null>(null);

  const refreshGoogleStatus = async () => {
    const response = await fetch("/api/google/status");
    const result = await response.json() as { configured?: boolean; connected?: boolean; email?: string };
    if (response.ok) setGoogleStatus({ configured: Boolean(result.configured), connected: Boolean(result.connected), email: result.email || "" });
  };

  useEffect(() => {
    let active = true;
    fetch("/api/google/status").then(response => response.json()).then((result: { configured?: boolean; connected?: boolean; email?: string }) => {
      if (active) setGoogleStatus({ configured: Boolean(result.configured), connected: Boolean(result.connected), email: result.email || "" });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const disconnectGoogle = async () => {
    if (!window.confirm("Disconnect Google Calendar and Drive from your portal account?")) return;
    const response = await fetch("/api/google/status", { method: "DELETE" });
    if (!response.ok) return notify("Google account could not be disconnected");
    await refreshGoogleStatus();
    notify("Google account disconnected");
  };

  const install = async () => {
    if (!installPrompt) return notify("Use your browser’s Install app option to add the portal");
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") notify("Portal installed");
    setInstallPrompt(null);
  };

  return (
    <Modal title="Profile and preferences" eyebrow="MY ACCOUNT" close={close} className="profile-modal">
      <form onSubmit={event => { event.preventDefault(); updateState(current => ({ ...current, profile: draft, preferences: prefs })); notify("Profile and preferences saved"); close(); }}>
        <div className="profile-heading">
          <i>{initials(draft.name)}</i>
          <span><b>{draft.name || "Muneeb Rizwan"}</b><small>Take Me Group</small></span>
          <button type="button" className="secondary" onClick={() => notify("Profile photo uploads are not enabled yet")}>Change photo</button>
        </div>
        <div className="form-grid">
          <label>Full name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Job title<input value={draft.jobTitle} onChange={event => setDraft({ ...draft, jobTitle: event.target.value })} /></label>
          <label>Department<input value={draft.department} onChange={event => setDraft({ ...draft, department: event.target.value })} /></label>
          <label>Company sign-in email<input type="email" value={draft.email} readOnly title="Managed by your company sign-in" /></label>
          <label>Phone number<input value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} placeholder="Add a work number" /></label>
          <label>Time zone<select value={draft.timezone} onChange={event => setDraft({ ...draft, timezone: event.target.value })}><option value="Europe/London">London (GMT/BST)</option><option value="Asia/Karachi">Karachi (PKT)</option></select></label>
        </div>
        <section className="preference-box">
          <h3>Appearance and accessibility</h3>
          <Toggle title="Dark mode" description="Use a darker colour theme." checked={prefs.theme === "dark"} onChange={value => setPrefs({ ...prefs, theme: value ? "dark" : "light" })} />
          <Toggle title="Larger text" description="Increase important text throughout the portal." checked={prefs.textSize === "large"} onChange={value => setPrefs({ ...prefs, textSize: value ? "large" : "normal" })} />
          <Toggle title="High contrast" description="Strengthen borders and interactive colours." checked={prefs.highContrast} onChange={value => setPrefs({ ...prefs, highContrast: value })} />
          <Toggle title="Reduce motion" description="Minimise interface animation." checked={prefs.reducedMotion} onChange={value => setPrefs({ ...prefs, reducedMotion: value })} />
        </section>
        <section className="preference-box">
          <h3>Notifications</h3>
          <Toggle title="Email notifications" description="Receive request and company updates by email." checked={prefs.emailNotifications} onChange={value => setPrefs({ ...prefs, emailNotifications: value })} />
          <Toggle title="Desktop notifications" description="Show important updates while the portal is open." checked={prefs.browserNotifications} onChange={value => setPrefs({ ...prefs, browserNotifications: value })} />
          <Toggle title="Weekly digest" description="Receive a summary every Monday morning." checked={prefs.weeklyDigest} onChange={value => setPrefs({ ...prefs, weeklyDigest: value })} />
          <Toggle title="Quiet hours" description="Pause non-urgent alerts outside working hours." checked={prefs.quietHours} onChange={value => setPrefs({ ...prefs, quietHours: value })} />
        </section>
        <div className="install-row">
          <div>
            <b>Google Calendar and Drive</b>
            <small>{googleStatus?.connected ? `Connected as ${googleStatus.email}` : googleStatus?.configured ? "Connect your company Google account." : "Waiting for an administrator to configure OAuth."}</small>
          </div>
          {googleStatus?.connected ? (
            <button type="button" className="secondary" onClick={disconnectGoogle}>Disconnect</button>
          ) : (
            <button type="button" className="secondary" disabled={!googleStatus?.configured} onClick={() => window.location.assign("/api/auth/google/start")}>Connect Google</button>
          )}
        </div>
        <div className="install-row">
          <div>
            <b>Install Take Me Portal</b>
            <small>Add it to your phone or computer for faster access.</small>
          </div>
          <button type="button" className="secondary" onClick={install}>Install portal</button>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>Cancel</button>
          <button className="primary" type="submit">Save changes</button>
        </div>
      </form>
    </Modal>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "TM";
}
