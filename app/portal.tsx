"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminPortal from "./admin-portal";
import EmployeePortal from "./employee-portal";
import LoginScreen from "./login-screen";
import { HelpCentre, OnboardingGuide } from "./onboarding";
import { addDays, formatDateTime, localDateInput, makeId, type CreateAttachment, type FeatureKey, type PortalState, type RequestItem } from "./portal-data";
import { Modal, SvgIcon, Toggle } from "./portal-ui";
import { usePortalState } from "./use-portal-state";

const employeeRoutes: [string, string, FeatureKey?][] = [
  ["Home", "home"], ["Work", "check"], ["Action inbox", "check", "actionInbox"], ["Tasks", "tasks"], ["Projects", "projects"], ["People", "people"], ["Requests", "requests"],
  ["Calendar", "calendar"], ["Resources", "knowledge"], ["Knowledge", "knowledge"], ["Documents", "documents"], ["Chat", "chat"], ["Leave", "leave", "leave"],
];
const employeeNav: [string, string, FeatureKey?][] = [
  ["Home", "home"], ["Work", "check"], ["Projects", "projects"], ["Calendar", "calendar"], ["People", "people"], ["Resources", "knowledge"], ["Chat", "chat"],
];
const adminRoutes: [string, string][] = [
  ["Overview", "home"], ["Organisation", "people"], ["People & access", "people"], ["Departments", "settings"], ["Workflows", "requests"], ["Forms & workflows", "requests"], ["Purchase orders", "requests"],
  ["Feature controls", "projects"], ["Project management", "projects"], ["Content & communication", "knowledge"], ["Content", "knowledge"], ["Notifications", "bell"], ["Integrations", "link"], ["Security & audit", "lock"], ["Security", "lock"], ["Audit log", "documents"],
];
const adminNav: [string, string][] = [
  ["Overview", "home"], ["Organisation", "people"], ["Workflows", "requests"], ["Content & communication", "knowledge"], ["Integrations", "link"], ["Security & audit", "lock"],
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
      const initialPage = requestedPage && employeeRoutes.some(item => item[0] === requestedPage) ? requestedPage : "Home";
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
        setPage(requested && adminRoutes.some(item => item[0] === requested) ? requested : "Overview");
      } else {
        setAdmin(false);
        setPage(requested && employeeRoutes.some(item => item[0] === requested) ? requested : "Home");
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
                {item[0] === "Work" && pending > 0 && <mark>{pending}</mark>}
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
              <small>{state.profile.awayUntil ? `Away until ${state.profile.awayUntil}${state.profile.delegateEmail ? ` · ${state.profile.delegateEmail.split("@")[0]} covering` : ""}` : state.profile.jobTitle || "Profile & preferences"}</small>
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
            <button className={["Organisation", "People & access", "Departments"].includes(page) ? "active" : ""} onClick={() => navigate("Organisation")}>
              <i><SvgIcon name="people" size={18} /></i>
              <span>People</span>
            </button>
            <button className="create-tab" onClick={() => setCreateKind("")} aria-label="Create something new">
              <span className="create-bubble"><SvgIcon name="plus" size={20} /></span>
              <span>Create</span>
            </button>
            <button className={["Workflows", "Forms & workflows", "Purchase orders", "Feature controls", "Project management"].includes(page) ? "active" : ""} onClick={() => navigate("Workflows")}>
              <i><SvgIcon name="projects" size={18} /></i>
              <span>Workflows</span>
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
            <button className={["Work", "Action inbox", "Tasks", "Requests", "Leave"].includes(page) ? "active" : ""} onClick={() => navigate("Work")}>
              <i><SvgIcon name="check" size={18} /></i>
              <span>Work</span>
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
    const openRecord = (page: string, record: string) => () => {
      navigate(page);
      const url = new URL(window.location.href);
      url.searchParams.set("record", record);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      close();
    };
    const pages = employeeRoutes.map(item => ({ title: item[0], detail: "Open portal page", icon: item[1], action: () => { navigate(item[0]); close(); } }));
    const records = [
      ...state.requests.map(item => ({ title: item.title, detail: `${item.id} · Request`, icon: "requests", action: openRecord("Requests", item.id) })),
      ...state.documents.map(item => ({ title: item.name, detail: `${item.folder} · Document`, icon: "documents", action: () => { navigate("Documents"); close(); } })),
      ...state.articles.map(item => ({ title: item.title, detail: `${item.category} · Knowledge`, icon: "knowledge", action: () => { navigate("Knowledge"); close(); } })),
      ...state.employees.map(item => ({ title: item.name, detail: `${item.jobTitle || "Employee"} · ${item.email}`, icon: "people", action: () => { navigate("People"); close(); } })),
      ...state.conversations.map(item => ({ title: item.name, detail: "Direct message", icon: "chat", action: openRecord("Chat", item.id) })),
      ...state.tasks.map(item => ({ title: item.title, detail: `${item.status} · Task`, icon: "tasks", action: openRecord("Tasks", item.id) })),
      ...state.projectBoards.flatMap(board => board.cards.filter(card => !card.archived).map(card => ({ title: card.title, detail: `${board.title} · Project card`, icon: "projects", action: openRecord("Projects", card.id) }))),
    ];
    const commands = [
      ["Create a request", "request", "requests"],
      ["Create a calendar event", "event", "calendar"],
      ["Message an employee", "conversation", "chat"],
      ["Add a task", "task", "tasks"],
      ["Request leave", "leave", "leave"]
    ].map(item => ({ title: item[0], detail: "Quick command", icon: item[2], action: () => { openCreate(item[1]); close(); } }));
    const adminItem = { title: "Open Admin settings", detail: "Administration", icon: "settings", action: () => { openAdmin(); close(); } };
    const sessionItem = { title: "Sign out", detail: "End this company session", icon: "logout", action: () => window.location.assign("/api/auth/logout") };
    return [...commands, sessionItem, adminItem, ...pages, ...records].filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  }, [close, navigate, openAdmin, openCreate, query, state]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

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
            onChange={event => updateQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or type a command…"
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
  ["conversation", "chat", "Direct message", "Message an employee who has signed in"],
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
  const [type, setType] = useState(kind === "request" ? "Purchase order" : kind === "leave" ? "Annual leave" : "Normal");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(() => localDateInput(new Date()));
  const [endDate, setEndDate] = useState(() => localDateInput(addDays(new Date(), 1)));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [people, setPeople] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [meet, setMeet] = useState(true);
  const [draft, setDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitAnother, setSubmitAnother] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(`quick-create-draft:${kind}`) || "null") as Record<string, string | boolean> | null;
        if (saved) {
          setTitle(String(saved.title || "")); setType(String(saved.type || type)); setDetails(String(saved.details || ""));
          setDate(String(saved.date || date)); setEndDate(String(saved.endDate || endDate)); setStart(String(saved.start || start));
          setEnd(String(saved.end || end)); setPeople(String(saved.people || "")); setAmount(String(saved.amount || "")); setMeet(saved.meet !== false);
          notify("Recovered your unfinished form");
        }
      } catch { /* ignore an invalid local draft */ }
      setDraftLoaded(true);
    }, 0);
    return () => window.clearTimeout(restore);
  // Load once for the selected form kind.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = window.setTimeout(() => window.localStorage.setItem(`quick-create-draft:${kind}`, JSON.stringify({ title, type, details, date, endDate, start, end, people, amount, meet })), 250);
    return () => window.clearTimeout(timer);
  }, [amount, date, details, draftLoaded, end, endDate, kind, meet, people, start, title, type]);

  const messageableEmployees = useMemo(
    () => state.employees.filter(employee =>
      employee.email !== state.profile.email
      && employee.status === "Active"
      && Boolean(employee.lastLoginAt),
    ).sort((first, second) => state.preferences.recentEmployeeEmails.indexOf(second.email) - state.preferences.recentEmployeeEmails.indexOf(first.email)),
    [state.employees, state.preferences.recentEmployeeEmails, state.profile.email],
  );
  const matchingEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLocaleLowerCase();
    if (!query) return messageableEmployees;
    return messageableEmployees.filter(employee =>
      [employee.name, employee.email, employee.jobTitle, employee.department]
        .some(value => value.toLocaleLowerCase().includes(query)),
    );
  }, [employeeQuery, messageableEmployees]);

  const labels: Record<string, [string, string]> = {
    request: ["New request", "REQUESTS & WORKFLOWS"],
    event: ["Create an event", "GOOGLE CALENDAR"],
    conversation: ["New direct message", "TEAM CHAT"],
    task: ["Add a task", "TASKS"],
    leave: ["Request time away", "LEAVE & TIME OFF"],
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedEmployee = kind === "conversation" ? state.employees.find(employee => employee.email === people) : undefined;
    const cleanTitle = kind === "conversation" ? selectedEmployee?.name || "" : title.trim();
    const nextErrors: Record<string, string> = {};
    if (!cleanTitle) nextErrors.title = kind === "conversation" ? "Choose an employee to continue." : "Enter a clear title.";
    if ((kind === "event" || kind === "task" || kind === "leave") && !date) nextErrors.date = "Choose a date.";
    if (kind === "event" && end <= start) nextErrors.time = "End time must be after the start time.";
    if (kind === "leave" && endDate < date) nextErrors.date = "The end date cannot be before the start date.";
    if (kind === "request" && type === "Purchase order" && (!amount || Number(amount) <= 0)) nextErrors.amount = "Enter the purchase amount.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    let attachments: CreateAttachment[] = [];
    if (files.length) {
      setUploading(true);
      try {
        attachments = await Promise.all(files.map(async file => {
          const body = new FormData(); body.set("file", file);
          const response = await fetch("/api/files", { method: "POST", body });
          const result = await response.json() as CreateAttachment & { error?: string };
          if (!response.ok) throw new Error(result.error || `Could not upload ${file.name}`);
          return { key: result.key, name: result.name, type: result.type, size: result.size };
        }));
      } catch (error) {
        setErrors({ attachments: error instanceof Error ? error.message : "Attachments could not be uploaded." });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

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
          created: formatDateTime(),
          details,
          priority: "Normal",
          timeline: [
            { label: "Submitted", person: current.profile.name, time: formatDateTime(), complete: true },
            { label: "Manager review", person: "Manager not assigned", time: "Waiting", complete: false },
            { label: "Final confirmation", person: "Portal workflow", time: "Waiting", complete: false },
          ],
          attachments,
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
              attachments,
            },
            ...current.events,
          ],
        };
      }
      if (kind === "conversation") {
        const existing = current.conversations.find(conversation => conversation.type === "Direct" && conversation.members.includes(people));
        if (existing) {
          if (details.trim()) {
            next = { ...current, conversations: current.conversations.map(conversation => conversation.id === existing.id ? { ...conversation, messages: [...conversation.messages, { id: makeId("MSG"), author: current.profile.name, initials: initials(current.profile.name), text: details.trim(), time: "Now", mine: true }] } : conversation) };
          }
          return next;
        }
        next = {
          ...current,
          conversations: [
            {
              id: makeId("CHAT"),
              name: cleanTitle,
              type: "Direct",
              members: [current.profile.email, people],
              unread: 0,
              messages: details ? [{ id: makeId("MSG"), author: current.profile.name, initials: initials(current.profile.name), text: details, time: "Now", mine: true }] : [],
            },
            ...current.conversations,
          ],
        };
      }
      if (kind === "task") next = { ...current, tasks: [{ id: makeId("TASK"), title: cleanTitle, owner: people || current.profile.name, due: date, status: "To do", source: details || "Quick create", priority: type, attachments }, ...current.tasks] };
      if (kind === "leave") next = { ...current, leave: [{ id: makeId("LEAVE"), employee: current.profile.name, type, dates: `${date} to ${endDate}`, days: Math.max(1, Number(amount) || 1), status: draft ? "Draft" : "Pending", delegateEmail: current.profile.delegateEmail }, ...current.leave] };
      const recentEmail = kind === "conversation" ? people : people.split(",")[0]?.trim();
      return { ...next, preferences: recentEmail?.includes("@") ? { ...next.preferences, recentEmployeeEmails: [recentEmail, ...next.preferences.recentEmployeeEmails.filter(email => email !== recentEmail)].slice(0, 5) } : next.preferences, audit: [{ id: makeId("AUD"), actor: current.profile.name, action: `Created ${kind}: ${cleanTitle}`, area: kind, time: formatDateTime() }, ...next.audit] };
    });
    window.localStorage.removeItem(`quick-create-draft:${kind}`);
    notify(draft ? "Draft saved" : `${labels[kind]?.[0] || "Item"} created`);
    if (submitAnother) {
      setTitle(""); setDetails(""); setAmount(""); setPeople(""); setEmployeeQuery(""); setFiles([]); setErrors({});
      setDate(localDateInput(kind === "task" ? addDays(new Date(), 1) : new Date()));
      notify("Ready for another item");
    } else close();
  };

  return (
    <Modal title={labels[kind]?.[0] || "Create item"} eyebrow={labels[kind]?.[1]} close={close} className="medium-modal">
      <button className="back-button" onClick={back}>← All create options</button>
      <form className="create-form" onSubmit={submit}>
        {kind === "conversation" ? (
          <div className="employee-message-picker">
            <label>
              Who would you like to message?
              <input
                data-initial-focus
                type="search"
                value={employeeQuery}
                onChange={event => {
                  setEmployeeQuery(event.target.value);
                  setPeople("");
                }}
                placeholder="Type a name, email, role or department"
                autoComplete="off"
              />
            </label>
            {!!matchingEmployees.length && (
              <div className="employee-search-results" aria-label="Employee results">
                {matchingEmployees.map(employee => (
                  <button
                    key={employee.id}
                    type="button"
                    className={people === employee.email ? "selected" : ""}
                    aria-pressed={people === employee.email}
                    onClick={() => {
                      setPeople(employee.email);
                      setEmployeeQuery(employee.name);
                    }}
                  >
                    <i aria-hidden="true">{initials(employee.name)}</i>
                    <span>
                      <b>{employee.name}</b>
                      <small>{employee.jobTitle || employee.department || employee.email}</small>
                    </span>
                    <em>{people === employee.email ? "Selected" : "Message"}</em>
                  </button>
                ))}
              </div>
            )}
            <small className="employee-search-status" role="status" aria-live="polite">
              {matchingEmployees.length
                ? `${matchingEmployees.length} ${matchingEmployees.length === 1 ? "employee" : "employees"} found.`
                : employeeQuery.trim()
                  ? "No employees match your search."
                  : "No other employees have signed in yet."}
            </small>
            <small>Tap a colleague to select them. Only active employees who have signed in are shown.</small>
            {errors.title && <small className="field-error" role="alert">{errors.title}</small>}
          </div>
        ) : (
          <label>
            Title
            <input data-initial-focus required value={title} onChange={event => setTitle(event.target.value)} placeholder="Enter a clear title" />
            {errors.title && <small className="field-error" role="alert">{errors.title}</small>}
          </label>
        )}
        {(kind === "request" || kind === "leave" || kind === "task") && (
          <label>
            {kind === "task" ? "Priority" : "Type"}
            <select value={type} onChange={event => setType(event.target.value)}>
              {(kind === "request"
                ? ["Purchase order", "Expense", "IT access", "Marketing support", "Facilities"]
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
              <div className="date-suggestions">
                <button type="button" onClick={() => setDate(localDateInput(new Date()))}>Today</button>
                <button type="button" onClick={() => setDate(localDateInput(addDays(new Date(), 1)))}>Tomorrow</button>
                <button type="button" onClick={() => setDate(localDateInput(addDays(new Date(), 7)))}>Next week</button>
              </div>
              {errors.date && <small className="field-error" role="alert">{errors.date}</small>}
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
        {errors.time && <small className="field-error" role="alert">{errors.time}</small>}
        {(kind === "leave" || (kind === "request" && ["Purchase order", "Expense"].includes(type))) && (
          <label>
            {kind === "leave" ? "Number of days" : "Amount, if applicable"}
            <input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder={kind === "leave" ? "1" : "0.00"} />
            {errors.amount && <small className="field-error" role="alert">{errors.amount}</small>}
          </label>
        )}
        {kind === "conversation" ? <label>First message<textarea value={details} onChange={event => setDetails(event.target.value)} placeholder="Write a helpful first message" /></label> : (
          <details className="advanced-details">
            <summary>Add people, details or attachments</summary>
            <div>
              {(kind === "event" || kind === "task") && <label>{kind === "task" ? "Assign to" : "Guests"}<input value={people} onChange={event => setPeople(event.target.value)} placeholder="Names or @takeme.taxi addresses, separated by commas" />{!!state.preferences.recentEmployeeEmails.length && <small>Recent: {state.preferences.recentEmployeeEmails.slice(0, 3).map(email => <button type="button" className="inline-choice" key={email} onClick={() => setPeople(email)}>{email.split("@")[0]}</button>)}</small>}</label>}
              <label>Details<textarea value={details} onChange={event => setDetails(event.target.value)} placeholder="Add useful context" /></label>
              {kind === "event" && <label className="check-row"><input type="checkbox" checked={meet} onChange={event => setMeet(event.target.checked)} /> Add Google Meet video call</label>}
              <div className="attachment-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFiles(current => [...current, ...Array.from(event.dataTransfer.files)].slice(0, 6)); }}>
                <b>Attachments</b><span>Drag files here or choose up to six files.</span>
                <input type="file" multiple onChange={event => setFiles(current => [...current, ...Array.from(event.target.files || [])].slice(0, 6))} />
                {!!files.length && <ul>{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ul>}
                {errors.attachments && <small className="field-error" role="alert">{errors.attachments}</small>}
              </div>
            </div>
          </details>
        )}
        {kind === "request" && (
          <label className="check-row">
            <input type="checkbox" checked={draft} onChange={event => setDraft(event.target.checked)} /> Save as draft
          </label>
        )}
        <label className="check-row">
          <input type="checkbox" checked={submitAnother} onChange={event => setSubmitAnother(event.target.checked)} /> Create another after saving
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>Cancel</button>
          <button type="submit" className="primary" disabled={uploading || (kind === "conversation" && !people)} title={kind === "conversation" && !people ? "Select an active employee first" : uploading ? "Wait for attachments to finish uploading" : ""}>{uploading ? "Uploading…" : draft ? "Save draft" : kind === "conversation" ? "Start chat" : `Create ${kind}`}</button>
        </div>
        {(uploading || (kind === "conversation" && !people)) && <p className="disabled-explanation" role="status">{uploading ? "Attachments are still uploading. This action will become available when they finish." : "Select an active employee before starting the conversation."}</p>}
      </form>
    </Modal>
  );
}

function UtilityPanel({ type, state, updateState, close, navigate, notify, restartTour, isAdmin }: { type: "notifications" | "help"; state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; navigate: (page: string) => void; notify: (message: string) => void; restartTour: () => void; isAdmin: boolean }) {
  const [group, setGroup] = useState("All");
  const [showSettings, setShowSettings] = useState(false);
  const [undoReadIds, setUndoReadIds] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (type !== "notifications") return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(panel?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])") || [])];
      if (!focusable.length) { event.preventDefault(); panel?.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    panel?.addEventListener("keydown", handleKey);
    const focusTimer = window.setTimeout(() => panel?.querySelector<HTMLElement>("button")?.focus(), 30);
    return () => { window.clearTimeout(focusTimer); panel?.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [close, type]);
  const groups = ["All", ...Array.from(new Set(state.notifications.map(item => item.group)))];
  const destination: Record<string, string> = { Approvals: "Action inbox", Calendar: "Calendar", Leave: "Leave", Requests: "Requests" };

  if (type === "help") return <HelpCentre close={close} restartTour={restartTour} navigate={navigate} isAdmin={isAdmin} />;

  const visible = state.notifications.filter(item =>
    item.actorEmail?.toLowerCase() !== state.profile.email.toLowerCase()
    && !state.preferences.mutedNotificationGroups.includes(item.group)
    && (!state.preferences.actionRequiredOnly || item.actionRequired)
    && (group === "All" || item.group === group),
  );
  const todayKey = localDateInput(new Date());
  const sections = [
    ["Today", visible.filter(item => !item.snoozed && (!item.createdAt || item.createdAt.slice(0, 10) === todayKey))],
    ["Earlier", visible.filter(item => !item.snoozed && Boolean(item.createdAt) && item.createdAt?.slice(0, 10) !== todayKey)],
    ["Snoozed", visible.filter(item => item.snoozed)],
  ] as const;
  const openNotification = (item: typeof state.notifications[number]) => {
    updateState(current => ({ ...current, notifications: current.notifications.map(value => value.id === item.id ? { ...value, read: true, snoozed: false } : value) }));
    const page = item.targetPage || destination[item.group] || "Home";
    navigate(page);
    if (item.targetId) {
      const url = new URL(window.location.href);
      url.searchParams.set("record", item.targetId);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    }
    close();
  };
  const markAllRead = () => {
    const ids = visible.filter(item => !item.read).map(item => item.id);
    if (!ids.length) return;
    setUndoReadIds(ids);
    updateState(current => ({ ...current, notifications: current.notifications.map(item => ids.includes(item.id) ? { ...item, read: true } : item) }));
    notify("All visible notifications marked read — Undo is available");
  };

  return (
    <div ref={panelRef} tabIndex={-1} className="utility-panel notification-panel" role="dialog" aria-modal="true" aria-label="Notifications">
      <header>
        <div>
          <h2>Notifications</h2>
          <small>{visible.filter(item => !item.read).length} unread</small>
        </div>
        <button aria-label="Notification preferences" title="Notification preferences" onClick={() => setShowSettings(value => !value)}><SvgIcon name="settings" size={15} /></button>
        <button aria-label="Close notifications" onClick={close}>×</button>
      </header>
      <div className="notification-groups">
        {groups.map(value => (
          <button className={group === value ? "active" : ""} key={value} onClick={() => setGroup(value)}>{value}</button>
        ))}
      </div>
      {showSettings && (
        <section className="notification-settings-inline">
          <Toggle title="Action required only" description="Hide informational updates from this panel." checked={state.preferences.actionRequiredOnly} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, actionRequiredOnly: value } }))} />
          <p>Mute categories</p>
          <div className="notification-groups">
            {groups.filter(value => value !== "All").map(value => {
              const muted = state.preferences.mutedNotificationGroups.includes(value);
              return <button className={muted ? "muted" : "active"} key={value} onClick={() => updateState(current => ({ ...current, preferences: { ...current.preferences, mutedNotificationGroups: muted ? current.preferences.mutedNotificationGroups.filter(item => item !== value) : [...current.preferences.mutedNotificationGroups, value] } }))}>{muted ? `Unmute ${value}` : `Mute ${value}`}</button>;
            })}
          </div>
        </section>
      )}
      <div className="notification-list">
        {sections.map(([section, items]) => items.length ? (
          <section className="notification-section" key={section}>
            <h3>{section}<span>{items.length}</span></h3>
            {items.map(item => (
              <article className={`${item.read ? "read" : ""} priority-${(item.priority || "Normal").toLowerCase()}`} key={item.id}>
                <button className="notification-main" onClick={() => openNotification(item)}>
                  <i><SvgIcon name={item.actionRequired ? "check" : "bell"} size={12} /></i>
                  <span><b>{item.title}</b><small>{item.detail} · {item.time}</small><em>{item.priority || "Normal"}{item.actionRequired ? " · Action required" : ""}</em></span>
                </button>
                <button className="snooze" aria-label={`${item.snoozed ? "Restore" : "Snooze"} ${item.title}`} title={item.snoozed ? "Restore" : "Snooze"} onClick={() => { updateState(current => ({ ...current, notifications: current.notifications.map(value => value.id === item.id ? { ...value, snoozed: !value.snoozed } : value) })); notify(item.snoozed ? "Notification restored" : "Notification snoozed"); }}>
                  <SvgIcon name="clock" size={14} />
                </button>
              </article>
            ))}
          </section>
        ) : null)}
        {!visible.length && <p className="widget-empty">No notifications match your preferences.</p>}
      </div>
      <footer>
        {undoReadIds.length ? <button className="text-button" onClick={() => { updateState(current => ({ ...current, notifications: current.notifications.map(item => undoReadIds.includes(item.id) ? { ...item, read: false } : item) })); setUndoReadIds([]); notify("Unread notifications restored"); }}>Undo mark all read</button> : <button className="text-button" onClick={markAllRead}>Mark all as read</button>}
      </footer>
    </div>
  );
}

function ProfileSettings({ state, updateState, close, notify, installPrompt, setInstallPrompt }: { state: PortalState; updateState: (updater: (current: PortalState) => PortalState) => void; close: () => void; notify: (message: string) => void; installPrompt: DeferredInstall | null; setInstallPrompt: (prompt: DeferredInstall | null) => void }) {
  const [name, setName] = useState(state.profile.name);
  const [jobTitle, setJobTitle] = useState(state.profile.jobTitle);
  const [phone, setPhone] = useState(state.profile.phone);
  const [timezone, setTimezone] = useState(state.profile.timezone);
  const [awayUntil, setAwayUntil] = useState(state.profile.awayUntil);
  const [delegateEmail, setDelegateEmail] = useState(state.profile.delegateEmail);
  const [delegateApprovals, setDelegateApprovals] = useState(state.profile.delegateApprovals);
  const [delegateProjects, setDelegateProjects] = useState(state.profile.delegateProjects);
  const [delegateRequests, setDelegateRequests] = useState(state.profile.delegateRequests);
  const [delegateUrgentNotifications, setDelegateUrgentNotifications] = useState(state.profile.delegateUrgentNotifications);
  const [preferences, setPreferences] = useState(state.preferences);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    updateState(current => ({
      ...current,
      profile: { ...current.profile, name: name.trim() || current.profile.name, jobTitle: jobTitle.trim(), phone: phone.trim(), timezone, awayUntil, delegateEmail: awayUntil ? delegateEmail : "", delegateApprovals, delegateProjects, delegateRequests, delegateUrgentNotifications },
      preferences,
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
            <Toggle title="Dark mode" description="Sleek dark interface for lower eye strain" checked={preferences.theme === "dark"} onChange={value => setPreferences(current => ({ ...current, theme: value ? "dark" : "light" }))} />
            <Toggle title="Large text" description="Increase interface font sizing" checked={preferences.textSize === "large"} onChange={value => setPreferences(current => ({ ...current, textSize: value ? "large" : "normal" }))} />
            <Toggle title="High contrast" description="Sharpen borders and boost text contrast" checked={preferences.highContrast} onChange={value => setPreferences(current => ({ ...current, highContrast: value }))} />
            <Toggle title="Reduced motion" description="Minimize interface animations" checked={preferences.reducedMotion} onChange={value => setPreferences(current => ({ ...current, reducedMotion: value }))} />
          </div>
        </section>

        <section className="pref-section">
          <h3>Notifications</h3>
          <div className="pref-grid">
            <Toggle title="Email notifications" description="Receive email summaries of approvals" checked={preferences.emailNotifications} onChange={value => setPreferences(current => ({ ...current, emailNotifications: value }))} />
            <Toggle title="Browser alerts" description="Show notifications for urgent updates" checked={preferences.browserNotifications} onChange={value => setPreferences(current => ({ ...current, browserNotifications: value }))} />
            <Toggle title="Action required only" description="Show only notifications that need your response" checked={preferences.actionRequiredOnly} onChange={value => setPreferences(current => ({ ...current, actionRequiredOnly: value }))} />
          </div>
          <label>Digest frequency<select value={preferences.digestFrequency} onChange={event => setPreferences(current => ({ ...current, digestFrequency: event.target.value as "none" | "daily" | "weekly", weeklyDigest: event.target.value === "weekly" }))}><option value="none">No digest</option><option value="daily">Daily digest</option><option value="weekly">Weekly digest</option></select></label>
        </section>

        <section className="pref-section delegation-settings">
          <h3>Absence and delegation</h3>
          <p className="pref-desc">Set an away date and nominate one active colleague to cover selected work.</p>
          <div className="form-grid">
            <label>Away until<input type="date" min={localDateInput(new Date())} value={awayUntil} onChange={event => setAwayUntil(event.target.value)} /></label>
            <label>Delegate<select value={delegateEmail} disabled={!awayUntil} onChange={event => setDelegateEmail(event.target.value)}><option value="">Choose a colleague</option>{state.employees.filter(employee => employee.status === "Active" && employee.email !== state.profile.email).map(employee => <option value={employee.email} key={employee.email}>{employee.name}</option>)}</select><small>{awayUntil ? "Your delegate is shown beside your profile while you are away." : "Choose an away date to enable delegation."}</small></label>
          </div>
          <div className="pref-grid">
            <Toggle title="Approvals" description="Route pending decisions to your delegate" checked={delegateApprovals} onChange={setDelegateApprovals} />
            <Toggle title="Project ownership" description="Show your delegate on assigned projects" checked={delegateProjects} onChange={setDelegateProjects} />
            <Toggle title="Request responses" description="Let your delegate respond to request follow-ups" checked={delegateRequests} onChange={setDelegateRequests} />
            <Toggle title="Urgent notifications" description="Copy urgent action-required alerts to your delegate" checked={delegateUrgentNotifications} onChange={setDelegateUrgentNotifications} />
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
