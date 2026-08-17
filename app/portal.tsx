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
  ["Leave", "leave", "leave"],
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
      if (requestedCreate && ["request", "event", "conversation", "task", "leave"].includes(requestedCreate)) setCreateKind(requestedCreate);
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
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <Image src="/take-me-logo-black.png" alt="Take Me" width={38} height={40} priority />
          <div>
            <h1>Take Me</h1>
            <small>{admin ? "Administration" : "Team Portal"}</small>
          </div>
          <button className="mobile-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>×</button>
        </div>

        <nav aria-label="Main navigation">
          {admin ? (
            adminNav.map(item => (
              <button key={item[0]} className={page === item[0] ? "active" : ""} onClick={() => navigate(item[0])}>
                <i><SvgIcon name={item[1]} size={18} /></i>
                <span>{item[0]}</span>
              </button>
            ))
          ) : (
            visibleNav.map(item => (
              <button key={item[0]} className={page === item[0] ? "active" : ""} onClick={() => navigate(item[0])}>
                <i><SvgIcon name={item[1]} size={18} /></i>
                <span>{item[0]}</span>
                {item[0] === "Action inbox" && pending > 0 && <mark>{pending}</mark>}
              </button>
            ))
          )}
        </nav>

        <div className="sidefoot">
          {identity.isAdmin && (
            <button className="admin-switch" onClick={() => (admin ? openEmployee() : openAdmin())}>
              <i><SvgIcon name={admin ? "home" : "settings"} size={16} /></i>
              <span>{admin ? "Exit to Employee Portal" : "Admin settings"}</span>
            </button>
          )}
          <button className="profile-button" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}>
            <i>{state.profile.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</i>
            <div>
              <b>{state.profile.name}</b>
              <small>{state.profile.jobTitle || "Profile & preferences"}</small>
            </div>
            <span className="live-dot" title="Live sync" />
          </button>
          <a className="logout-button" href="/api/auth/logout" title="Sign out">
            <i><SvgIcon name="logout" size={16} /></i>
            <span>Sign out</span>
          </a>
        </div>
      </aside>

      {menuOpen && <div className="mobile-scrim" role="presentation" onClick={() => setMenuOpen(false)} />}

      <section className="content">
        <header className="topbar">
          <button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <SvgIcon name="menu" size={20} />
          </button>

          <button className="global-search" onClick={() => setCommandOpen(true)} aria-label="Universal search">
            <i><SvgIcon name="search" size={16} /></i>
            <b>Search or press </b>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="topbar-actions">
            <button className="top-create primary" onClick={() => setCreateKind("")} aria-label="Create something new" title="Create">
              <i><SvgIcon name="plus" size={16} /></i>
              <span>Create</span>
            </button>
            <button className="icon-button" onClick={() => setPanel(panel === "notifications" ? null : "notifications")} aria-label="Notifications" title="Notifications">
              <SvgIcon name="bell" size={18} />
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
            <button className="icon-button" onClick={() => setPanel(panel === "help" ? null : "help")} aria-label="Help and guides" title="Help">
              <SvgIcon name="help" size={18} />
            </button>
            {identity.isAdmin && !admin && (
              <button className="admin-shortcut secondary" onClick={() => openAdmin("Overview")} aria-label="Admin settings" title="Admin settings">
                <SvgIcon name="settings" size={16} />
              </button>
            )}
            <div className="sync-chip" title="Live status">
              <i className={realtime.status === "live" ? "ok" : realtime.status === "syncing" ? "syncing" : realtime.status === "offline" ? "warn" : ""} />
              <span>{saveStatus === "Saving" ? "Saving…" : realtime.status === "live" ? "Live" : realtime.status === "offline" ? "Offline" : "Auto-sync"}</span>
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="network-banner" role="status">
            You’re offline. Changes will save automatically when your connection returns.
          </div>
        )}

        {state.features.pwa && !isStandalone && !installDismissed && (
          <aside className="app-install-banner" role="region" aria-label="Install Take Me Portal">
            <i><Image src="/take-me-logo-black.png" alt="Take Me" width={36} height={36} /></i>
            <div>
              <b>Install Take Me Team Portal</b>
              <small>Add to your home screen for quick access to tasks, calendar and chat.</small>
            </div>
            <div className="install-actions">
              <button onClick={installApp}>Install</button>
              <button className="dismiss-install" aria-label="Dismiss install banner" onClick={dismissInstall}>×</button>
            </div>
          </aside>
        )}

        {admin ? (
          <AdminPortal page={page} state={state} updateState={updateState} navigate={navigate} notify={notify} realtime={realtime} />
        ) : (
          <EmployeePortal
            page={page}
            state={state}
            updateState={updateState}
            navigate={navigate}
            notify={notify}
            openCreate={kind => setCreateKind(kind ?? "")}
            openNotifications={() => setPanel("notifications")}
            realtime={realtime}
          />
        )}
      </section>

      <nav className="mobile-bottom-nav" aria-label="Employee app navigation">
        {admin ? (
          <>
            <button className={page === "Overview" ? "active" : ""} onClick={() => navigate("Overview")}>
              <i><SvgIcon name="home" size={18} /></i>
              <span>Overview</span>
            </button>
            <button className={page === "People & access" ? "active" : ""} onClick={() => navigate("People & access")}>
              <i><SvgIcon name="people" size={18} /></i>
              <span>People</span>
            </button>
            <button className="create-tab" onClick={() => setCreateKind("")} aria-label="Create something new">
              <span className="create-bubble"><SvgIcon name="plus" size={20} /></span>
              <span>Create</span>
            </button>
            <button className={page === "Feature controls" ? "active" : ""} onClick={() => navigate("Feature controls")}>
              <i><SvgIcon name="projects" size={18} /></i>
              <span>Features</span>
            </button>
            <button onClick={() => setMenuOpen(true)}>
              <i><SvgIcon name="menu" size={18} /></i>
              <span>More</span>
            </button>
          </>
        ) : (
          <>
            <button className={page === "Home" ? "active" : ""} onClick={() => navigate("Home")}>
              <i><SvgIcon name="home" size={18} /></i>
              <span>Home</span>
            </button>
            <button className={page === "Projects" ? "active" : ""} onClick={() => navigate("Projects")}>
              <i><SvgIcon name="projects" size={18} /></i>
              <span>Projects</span>
            </button>
            <button className="create-tab" onClick={() => setCreateKind("")} aria-label="Create something new">
              <span className="create-bubble"><SvgIcon name="plus" size={20} /></span>
              <span>Create</span>
            </button>
            {state.features.chat && (
              <button className={page === "Chat" ? "active" : ""} onClick={() => navigate("Chat")}>
                <i><SvgIcon name="chat" size={18} /></i>
                <span>Chat</span>
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
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo(() => {
    const pages = employeeNav.map(item => ({ title: item[0], detail: "Open portal page", icon: item[1], action: () => { navigate(item[0]); close(); } }));
    const records = [
      ...state.requests.map(item => ({ title: item.title, detail: `${item.id} · Request`, icon: "requests", action: () => { navigate("Requests"); close(); } })),
      ...state.documents.map(item => ({ title: item.name, detail: `${item.folder} · Document`, icon: "documents", action: () => { navigate("Documents"); close(); } })),
      ...state.articles.map(item => ({ title: item.title, detail: `${item.category} · Knowledge`, icon: "knowledge", action: () => { navigate("Knowledge"); close(); } })),
      ...state.conversations.map(item => ({ title: item.name, detail: `${item.type} · Chat`, icon: "chat", action: () => { navigate("Chat"); close(); } })),
      ...state.tasks.map(item => ({ title: item.title, detail: `${item.status} · Task`, icon: "tasks", action: () => { navigate("Tasks"); close(); } })),
    ];
    const commands = [
      ["Create a request", "request", "requests"],
      ["Create a calendar event", "event", "calendar"],
      ["Start a conversation", "conversation", "chat"],
      ["Add a task", "task", "tasks"],
      ["Request leave", "leave", "leave"]
    ].map(item => ({ title: item[0], detail: "Quick command", icon: item[2], action: () => { openCreate(item[1]); close(); } }));
    const adminItem = { title: "Open Admin settings", detail: "Administration", icon: "settings", action: () => { openAdmin(); close(); } };
    const sessionItem = { title: "Sign out", detail: "End this company session", icon: "logout", action: () => window.location.assign("/api/auth/logout") };
    return [...commands, sessionItem, adminItem, ...pages, ...records].filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  }, [close, navigate, openAdmin, openCreate, query, state]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (items.length || 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % (items.length || 1));
    } else if (event.key === "Enter" && items[selectedIndex]) {
      event.preventDefault();
      items[selectedIndex].action();
    }
  };

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Search portal">
        <header>
          <span><SvgIcon name="search" size={18} /></span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or type a command…"
            autoFocus
          />
          <kbd>ESC</kbd>
        </header>
        <div className="command-results">
          {items.length ? items.map((item, index) => (
            <button
              key={`${item.title}-${index}`}
              className={index === selectedIndex ? "active" : ""}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={item.action}
            >
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
];

function QuickCreate({ kind, state, updateState, setKind, close, notify }: { kind: string; state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; setKind: (kind: string) => void; close: () => void; notify: (message: string) => void }) {
  if (!kind) {
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
  const [type, setType] = useState(kind === "request" ? "Purchase order" : kind === "conversation" ? "Channel" : kind === "leave" ? "Annual leave" : "Normal");
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
    leave: ["Request time away", "LEAVE & TIME OFF"],
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
            location: meet ? "Google Meet" : details || "Head office",
            meet,
            guests: people.split(",").map(value => value.trim()).filter(Boolean),
            notes: details,
            timeZone: state.profile.timezone,
          }),
        });
        const result = await response.json() as { id?: string; htmlLink?: string; hangoutLink?: string; error?: string };
        if (response.ok && result.id) googleEvent = result;
      } catch {
        /* proceed offline/local fallback */
      }
    }

    updateState(current => {
      let next = current;
      if (kind === "request") {
        const id = makeId(type === "Purchase order" ? "PO" : "REQ");
        const item: RequestItem = {
          id,
          title: cleanTitle,
          type,
          amount: amount ? `£${amount}` : "—",
          status: draft ? "Draft" : "Awaiting approval",
          tone: draft ? "slate" : "amber",
          requester: current.profile.name,
          created: "Just now",
          details,
          priority: "Normal",
          timeline: [
            { label: "Submitted", person: current.profile.name, time: "Just now", complete: true },
            { label: "Manager review", person: "Sofia Khan", time: "Waiting", complete: false },
            { label: "Final confirmation", person: "Portal workflow", time: "Waiting", complete: false },
          ],
        };
        next = {
          ...current,
          requests: [item, ...current.requests],
          approvals: draft ? current.approvals : [{ id: makeId("APR"), requestId: id, title: cleanTitle, requester: current.profile.name, due: "In 2 days", amount: item.amount, status: "Pending", type }, ...current.approvals],
        };
      }
      if (kind === "event") {
        next = {
          ...current,
          events: [
            {
              id: makeId("EV"),
              googleId: googleEvent?.id,
              title: cleanTitle,
              date,
              start,
              end,
              location: meet ? "Google Meet" : details || "Head office",
              meet,
              guests: people.split(",").map(value => value.trim()).filter(Boolean),
              notes: details,
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
          {kind === "conversation" ? "Conversation name" : "Title"}
          <input data-initial-focus required value={title} onChange={event => setTitle(event.target.value)} placeholder="Enter a clear title" />
        </label>
        {(kind === "request" || kind === "conversation" || kind === "leave" || kind === "task") && (
          <label>
            {kind === "task" ? "Priority" : "Type"}
            <select value={type} onChange={event => setType(event.target.value)}>
              {(kind === "request"
                ? ["Purchase order", "Expense", "IT access", "Marketing support", "Facilities"]
                : kind === "conversation"
                ? ["Channel", "Group", "Direct"]
                : kind === "leave"
                ? ["Annual leave", "Sickness", "Work from home", "Unpaid leave"]
                : ["Normal", "High", "Urgent"]
              ).map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        )}
        {(kind === "event" || kind === "task" || kind === "leave") && (
          <div className="form-grid">
            <label>
              {kind === "task" ? "Due date" : "Date"}
              <input type="date" value={date} onChange={event => setDate(event.target.value)} />
            </label>
            {kind === "event" && (
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
          {kind === "conversation" ? "First message" : "Details"}
          <textarea value={details} onChange={event => setDetails(event.target.value)} placeholder="Add useful details" />
        </label>
        {kind === "event" && (
          <label className="check-row">
            <input type="checkbox" checked={meet} onChange={event => setMeet(event.target.checked)} /> Add Google Meet video call
          </label>
        )}
        {kind === "request" && (
          <label className="check-row">
            <input type="checkbox" checked={draft} onChange={event => setDraft(event.target.checked)} /> Save as draft
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>Cancel</button>
          <button type="submit" className="primary">{draft ? "Save draft" : `Create ${kind}`}</button>
        </div>
      </form>
    </Modal>
  );
}

function UtilityPanel({ type, state, updateState, close, navigate, notify, restartTour, isAdmin }: { type: "notifications" | "help"; state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; navigate: (page: string) => void; notify: (message: string) => void; restartTour: () => void; isAdmin: boolean }) {
  const [group, setGroup] = useState("All");
  const groups = ["All", ...Array.from(new Set(state.notifications.map(item => item.group)))];
  const notifications = state.notifications.filter(item => !item.snoozed && (group === "All" || item.group === group));
  const destination: Record<string, string> = { Approvals: "Action inbox", Calendar: "Calendar", Leave: "Leave", Requests: "Requests" };

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
        <button className="text-button" onClick={() => { updateState(current => ({ ...current, notifications: current.notifications.map(item => ({ ...item, read: true })) })); notify("All notifications marked read"); }}>Mark all as read</button>
      </footer>
    </div>
  );
}

function ProfileSettings({ state, updateState, close, notify, installPrompt, setInstallPrompt }: { state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; notify: (message: string) => void; installPrompt: DeferredInstall | null; setInstallPrompt: (prompt: DeferredInstall | null) => void }) {
  const [name, setName] = useState(state.profile.name);
  const [jobTitle, setJobTitle] = useState(state.profile.jobTitle);
  const [phone, setPhone] = useState(state.profile.phone);
  const [timezone, setTimezone] = useState(state.profile.timezone);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    updateState(current => ({
      ...current,
      profile: { ...current.profile, name: name.trim() || current.profile.name, jobTitle: jobTitle.trim(), phone: phone.trim(), timezone },
    }));
    notify("Profile preferences saved");
    close();
  };

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") notify("Portal installed");
      setInstallPrompt(null);
      return;
    }
    notify("Use your browser's Install app option or Share → Add to Home Screen");
  };

  return (
    <Modal title="Profile and preferences" eyebrow="PERSONAL SETTINGS" close={close} className="profile-modal">
      <form className="create-form" onSubmit={save}>
        <div className="profile-head">
          <i>{name.split(" ").map(part => part[0]).slice(0, 2).join("")}</i>
          <div>
            <h3>{name}</h3>
            <p>{state.profile.email}</p>
          </div>
        </div>

        <div className="form-grid">
          <label>Full name<input value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Job title<input value={jobTitle} onChange={event => setJobTitle(event.target.value)} placeholder="e.g. Operations Coordinator" /></label>
        </div>

        <div className="form-grid">
          <label>Contact phone<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="+44 7700 900077" /></label>
          <label>
            Time zone
            <select value={timezone} onChange={event => setTimezone(event.target.value)}>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET)</option>
              <option value="America/New_York">America/New York (EST)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            </select>
          </label>
        </div>

        <section className="pref-section">
          <h3>Display & accessibility</h3>
          <div className="pref-grid">
            <Toggle title="Dark mode" description="Sleek dark interface for lower eye strain" checked={state.preferences.theme === "dark"} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, theme: value ? "dark" : "light" } }))} />
            <Toggle title="Large text" description="Increase interface font sizing" checked={state.preferences.textSize === "large"} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, textSize: value ? "large" : "normal" } }))} />
            <Toggle title="High contrast" description="Sharpen borders and boost text contrast" checked={state.preferences.highContrast} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, highContrast: value } }))} />
            <Toggle title="Reduced motion" description="Minimize interface animations" checked={state.preferences.reducedMotion} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, reducedMotion: value } }))} />
          </div>
        </section>

        <section className="pref-section">
          <h3>Notifications</h3>
          <div className="pref-grid">
            <Toggle title="Email notifications" description="Receive email summaries of approvals" checked={state.preferences.emailNotifications} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, emailNotifications: value } }))} />
            <Toggle title="Browser alerts" description="Show notifications for urgent updates" checked={state.preferences.browserNotifications} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, browserNotifications: value } }))} />
            <Toggle title="Weekly digest" description="Weekly recap of announcements and team highlights" checked={state.preferences.weeklyDigest} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, weeklyDigest: value } }))} />
          </div>
        </section>

        <section className="pref-section">
          <h3>Mobile experience</h3>
          <p className="pref-desc">Install the portal on your phone or desktop for quick access.</p>
          <button type="button" className="secondary" onClick={install}>Install Take Me app</button>
        </section>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>Cancel</button>
          <button type="submit" className="primary">Save preferences</button>
        </div>
      </form>
    </Modal>
  );
}

const initials = (name: string) => name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
