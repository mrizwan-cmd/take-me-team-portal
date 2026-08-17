"use client";

import { useEffect, useRef, useState } from "react";
import type { PortalState, RequestItem, EventItem, Article } from "./portal-data";
import { makeId } from "./portal-data";
import { EmptyState, Modal, PageIntro, StatusPill, SvgIcon, type Notify } from "./portal-ui";
import ProjectsPortal from "./projects-portal";
import type { RealtimeControls } from "./use-realtime";

export type UpdatePortal = (updater: (current: PortalState) => PortalState) => void;

type EmployeeProps = {
  page: string;
  state: PortalState;
  updateState: UpdatePortal;
  navigate: (page: string) => void;
  notify: Notify;
  openCreate: (kind?: string) => void;
  openNotifications: () => void;
  realtime: RealtimeControls;
};

export default function EmployeePortal(props: EmployeeProps) {
  switch (props.page) {
    case "Home": return <HomePage {...props} />;
    case "Action inbox": return <ActionInbox {...props} />;
    case "Tasks": return <TasksPage {...props} />;
    case "Projects": return <ProjectsPortal state={props.state} updateState={props.updateState} notify={props.notify} />;
    case "People": return <PeoplePage {...props} />;
    case "Requests": return <RequestsPage {...props} />;
    case "Calendar": return <CalendarPage {...props} />;
    case "Knowledge": return <KnowledgePage {...props} />;
    case "Documents": return <DocumentsPage {...props} />;
    case "Chat": return <ChatPage {...props} />;
    case "Leave":
    case "Leave & shifts": return <LeavePage {...props} />;
    default: return <HomePage {...props} />;
  }
}

function HomePage({ state, updateState, navigate, notify, openCreate, openNotifications }: EmployeeProps) {
  const [customise, setCustomise] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const pending = state.approvals.filter(item => item.status === "Pending").length;
  const dueTasks = state.tasks.filter(item => item.status !== "Done").length;
  const dueToday = state.tasks.filter(item => item.status !== "Done" && item.due.toLowerCase().includes("today")).length;
  const unread = state.notifications.filter(item => !item.read && !item.snoozed).length;
  const todayKey = localDateKey(now);
  const todayEvents = state.events.filter(event => event.date === todayKey);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateHeading = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now).toUpperCase();
  const widgetNames: Record<string, string> = { approvals: "Approvals", calendar: "Today’s calendar", tasks: "Tasks", news: "Company news", quickLinks: "Quick links" };
  const moveWidget = (id: string, direction: number) => updateState(current => {
    const widgets = [...current.widgets]; const index = widgets.indexOf(id); const target = index + direction;
    if (index < 0 || target < 0 || target >= widgets.length) return current;
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    return { ...current, widgets };
  });

  return (
    <div className="page">
      <PageIntro
        eyebrow={dateHeading}
        title={`${greeting}, ${state.profile.name.split(" ")[0]}.`}
        text="Your meetings, approvals and project updates are ready."
        secondary={<button className="secondary" onClick={() => setCustomise(true)}>Customise home</button>}
        action={<button className="primary" onClick={() => openCreate()}>＋ Quick create</button>}
      />
      <section className="today-strip">
        <button onClick={() => navigate("Action inbox")}>
          <i><SvgIcon name="check" size={18} /></i>
          <span><b>{pending} {pending === 1 ? "approval" : "approvals"}</b><small>Waiting for your decision</small></span>
        </button>
        <button onClick={() => navigate("Tasks")}>
          <i><SvgIcon name="tasks" size={18} /></i>
          <span><b>{dueTasks} open {dueTasks === 1 ? "task" : "tasks"}</b><small>{dueToday ? `${dueToday} ${dueToday === 1 ? "is" : "are"} due today` : "Nothing is due today"}</small></span>
        </button>
        <button onClick={() => navigate("Calendar")}>
          <i><SvgIcon name="calendar" size={18} /></i>
          <span><b>{todayEvents.length} {todayEvents.length === 1 ? "meeting" : "meetings"} today</b><small>{todayEvents[0] ? `Next at ${todayEvents[0].start}` : "No meetings scheduled"}</small></span>
        </button>
        <button onClick={openNotifications}>
          <i><SvgIcon name="bell" size={18} /></i>
          <span><b>{unread} new {unread === 1 ? "update" : "updates"}</b><small>Across the portal</small></span>
        </button>
      </section>
      <div className="dashboard-grid">
        {state.widgets.filter(id => id !== "status").map(id => <HomeWidget key={id} id={id} state={state} navigate={navigate} notify={notify} openCreate={openCreate} todayKey={todayKey} />)}
      </div>
      {customise && (
        <Modal title="Customise My Day" eyebrow="PERSONALISE" close={() => setCustomise(false)} className="medium-modal">
          <p className="modal-lead">Choose the cards shown on your home page and change their order.</p>
          <div className="widget-manager">
            {Object.entries(widgetNames).map(([id, label]) => {
              const enabled = state.widgets.includes(id);
              return (
                <div key={id}>
                  <label>
                    <input type="checkbox" checked={enabled} onChange={() => updateState(current => ({ ...current, widgets: enabled ? current.widgets.filter(item => item !== id) : [...current.widgets, id] }))} /> <b>{label}</b>
                  </label>
                  <span>
                    <button disabled={!enabled || state.widgets.indexOf(id) === 0} onClick={() => moveWidget(id, -1)}>↑</button>
                    <button disabled={!enabled || state.widgets.indexOf(id) === state.widgets.length - 1} onClick={() => moveWidget(id, 1)}>↓</button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="modal-actions">
            <button className="primary" onClick={() => { setCustomise(false); notify("Home layout saved"); }}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HomeWidget({ id, state, navigate, notify, openCreate, todayKey }: { id: string; state: PortalState; navigate: (page: string) => void; notify: Notify; openCreate: (kind?: string) => void; todayKey: string }) {
  if (id === "approvals") return (
    <section className="card widget span-two">
      <CardHead title="Approvals requiring action" action="Open inbox" onClick={() => navigate("Action inbox")} />
      {state.approvals.filter(item => item.status === "Pending").slice(0, 3).map(item => (
        <button className="work-row" key={item.id} onClick={() => navigate("Action inbox")}>
          <i className="amber">{item.type[0]}</i>
          <span><b>{item.title}</b><small>{item.requester} · {item.requestId}</small></span>
          <StatusPill value={item.due} />
          <strong>{item.amount}</strong>
          <em>›</em>
        </button>
      ))}
    </section>
  );
  if (id === "calendar") {
    const events = state.events.filter(event => event.date === todayKey);
    return (
      <section className="card widget">
        <CardHead title="Today’s calendar" action="Open calendar" onClick={() => navigate("Calendar")} />
        {events.length ? events.map(event => (
          <button className="event-row" key={event.id} onClick={() => navigate("Calendar")}>
            <time>{event.start}</time>
            <span><b>{event.title}</b><small>{event.location}</small></span>
          </button>
        )) : <p className="widget-empty">No meetings are scheduled today.</p>}
        <button className="text-button" onClick={() => openCreate("event")}>＋ Add an event</button>
      </section>
    );
  }
  if (id === "tasks") return (
    <section className="card widget">
      <CardHead title="My tasks" action="View all" onClick={() => navigate("Tasks")} />
      {state.tasks.filter(item => item.status !== "Done").slice(0, 3).map(task => (
        <button className="task-mini" key={task.id} onClick={() => navigate("Tasks")}>
          <i><SvgIcon name="tasks" size={12} /></i>
          <span><b>{task.title}</b><small>{task.due} · {task.status}</small></span>
        </button>
      ))}
    </section>
  );
  if (id === "news") return (
    <section className="card widget span-two news-widget">
      <div className="news-art"><span>PEOPLE</span></div>
      <div>
        <p className="eyebrow">FEATURED · TODAY</p>
        <h2>Welcome to our new London workspace</h2>
        <p>Take a look inside the new collaborative home and meet the team who made it happen.</p>
        <button className="text-button" onClick={() => navigate("Knowledge")}>Read the story →</button>
      </div>
    </section>
  );
  return (
    <section className="card widget">
      <CardHead title="Quick links" action="Manage" onClick={() => notify("Quick links can be managed in Admin → Content")} />
      <div className="quick-grid">
        {[
          ["Request time off", "Leave"],
          ["Submit an expense", "Requests"],
          ["Book a meeting", "Calendar"],
          ["IT help desk", "Requests"],
          ["Brand assets", "Documents"],
          ["Employee handbook", "Knowledge"]
        ].map(item => (
          <button key={item[0]} onClick={() => navigate(item[1])}>
            {item[0]}<b>›</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function CardHead({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return (
    <div className="card-head">
      <h3>{title}</h3>
      <button onClick={onClick}>{action} →</button>
    </div>
  );
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ActionInbox({ state, updateState, notify }: EmployeeProps) {
  const [filter, setFilter] = useState("Pending");
  const [selected, setSelected] = useState<string | null>(null);
  const items = filter === "All" ? state.approvals : state.approvals.filter(item => item.status === filter);
  const decide = (id: string, status: "Approved" | "Rejected") => updateState(current => {
    const approval = current.approvals.find(item => item.id === id);
    if (!approval) return current;
    return {
      ...current,
      approvals: current.approvals.map(item => item.id === id ? { ...item, status } : item),
      requests: current.requests.map(item => item.id === approval.requestId ? { ...item, status, tone: status === "Approved" ? "green" : "red", timeline: item.timeline.map(step => ({ ...step, complete: true, time: status })) } : item),
      audit: [{ id: makeId("AUD"), actor: current.profile.name, action: `${status} ${approval.requestId}`, area: "Approvals", time: "Just now" }, ...current.audit],
    };
  });

  return (
    <div className="page">
      <PageIntro eyebrow="MY WORK" title="Action inbox" text="Make decisions and complete important work without switching between pages." />
      <div className="segmented">{["Pending", "Approved", "Rejected", "All"].map(value => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <section className="card data-card">
        <div className="data-head approvals-head">
          <span>Request</span>
          <span>Requester</span>
          <span>Due</span>
          <span>Amount</span>
          <span>Actions</span>
        </div>
        {items.map(item => (
          <div className="data-row approvals-row" key={item.id}>
            <button className="row-main" onClick={() => setSelected(item.id)}>
              <b>{item.title}</b>
              <small>{item.requestId} · {item.type}</small>
            </button>
            <span data-label="Requester">{item.requester}</span>
            <span className="mobile-field" data-label="Due"><StatusPill value={item.due} /></span>
            <strong data-label="Amount">{item.amount}</strong>
            <div className="row-actions">
              {item.status === "Pending" ? (
                <>
                  <button className="secondary small" onClick={() => { decide(item.id, "Rejected"); notify(`${item.requestId} rejected`); }}>Reject</button>
                  <button className="primary small" onClick={() => { decide(item.id, "Approved"); notify(`${item.requestId} approved`); }}>Approve</button>
                </>
              ) : (
                <StatusPill value={item.status} />
              )}
            </div>
          </div>
        ))}
      </section>
      {!items.length && <EmptyState title="Inbox clear" text="There are no items in this view." />}
      {selected && <RequestDetail request={state.requests.find(item => item.id === state.approvals.find(approval => approval.id === selected)?.requestId)} close={() => setSelected(null)} />}
    </div>
  );
}

function TasksPage({ state, updateState, openCreate, notify }: EmployeeProps) {
  const [filter, setFilter] = useState("Open");
  const tasks = state.tasks.filter(task => filter === "All" || (filter === "Open" ? task.status !== "Done" : task.status === filter));
  const cycle = (id: string) => updateState(current => ({ ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, status: task.status === "Done" ? "To do" : "Done" } : task) }));

  return (
    <div className="page">
      <PageIntro eyebrow="FOLLOW-UPS" title="Tasks" text="Keep personal and shared work moving, including tasks created from requests and conversations." action={<button className="primary" onClick={() => openCreate("task")}>＋ Add task</button>} />
      <div className="segmented">{["Open", "To do", "In progress", "Waiting", "Done", "All"].map(value => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <div className="task-board">
        {tasks.map(task => (
          <article className="card task-card" key={task.id}>
            <button className={`task-check ${task.status === "Done" ? "done" : ""}`} aria-label={`Mark ${task.title} ${task.status === "Done" ? "open" : "done"}`} onClick={() => { cycle(task.id); notify(task.status === "Done" ? "Task reopened" : "Task completed"); }}>
              {task.status === "Done" ? <SvgIcon name="check" size={14} /> : ""}
            </button>
            <div>
              <b>{task.title}</b>
              <small>{task.source} · Owned by {task.owner}</small>
            </div>
            <StatusPill value={task.priority} />
            <footer>
              <span>Due {task.due}</span>
              <StatusPill value={task.status} />
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function RequestsPage({ state, updateState, openCreate, notify }: EmployeeProps) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  const values = filter === "All" ? state.requests : state.requests.filter(item => item.status.includes(filter));
  const duplicate = (item: RequestItem) => updateState(current => ({
    ...current,
    requests: [
      {
        ...item,
        id: makeId(item.type === "Purchase order" ? "PO" : "REQ"),
        title: `${item.title} (copy)`,
        status: "Draft",
        tone: "slate",
        created: "Just now",
        timeline: item.timeline.map((step, index) => ({ ...step, complete: index === 0, time: index === 0 ? "Draft created" : "Waiting" })),
      },
      ...current.requests,
    ],
  }));

  return (
    <div className="page">
      <PageIntro eyebrow="REQUESTS & APPROVALS" title="My requests" text="Start from a template, save drafts and follow every step through completion." action={<button className="primary" onClick={() => openCreate("request")}>＋ New request</button>} />
      <div className="segmented">{["All", "Draft", "Awaiting", "In progress", "Completed", "Approved"].map(value => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <section className="card data-card">
        <div className="data-head request-head">
          <span>Request</span>
          <span>Type</span>
          <span>Status</span>
          <span>Amount</span>
          <span></span>
        </div>
        {values.map(item => (
          <button className="data-row request-row" key={item.id} onClick={() => setSelected(item.id)}>
            <span><b>{item.title}</b><small>{item.id} · {item.created}</small></span>
            <span data-label="Type">{item.type}</span>
            <span className="mobile-field" data-label="Status"><StatusPill value={item.status} /></span>
            <strong data-label="Amount">{item.amount}</strong>
            <i>›</i>
          </button>
        ))}
      </section>
      {selected && (
        <RequestDetail
          request={state.requests.find(item => item.id === selected)}
          close={() => setSelected(null)}
          actions={(
            <>
              <button className="secondary" onClick={() => { const item = state.requests.find(value => value.id === selected); if (item) { duplicate(item); notify("Request duplicated as a draft"); setSelected(null); } }}>Duplicate as draft</button>
              <button className="primary" onClick={() => notify("Request comments are not connected yet; nothing was posted")}>Add comment</button>
            </>
          )}
        />
      )}
    </div>
  );
}

function RequestDetail({ request, close, actions }: { request?: RequestItem; close: () => void; actions?: React.ReactNode }) {
  if (!request) return null;
  return (
    <Modal title={request.title} eyebrow={request.id} close={close} className="medium-modal">
      <div className="detail-summary">
        <div><small>Type</small><b>{request.type}</b></div>
        <div><small>Status</small><StatusPill value={request.status} /></div>
        <div><small>Amount</small><b>{request.amount}</b></div>
        <div><small>Priority</small><b>{request.priority}</b></div>
      </div>
      <p className="modal-lead">{request.details}</p>
      <h3>Progress</h3>
      <ol className="timeline">
        {request.timeline.map(item => (
          <li className={item.complete ? "complete" : ""} key={item.label}>
            <i>{item.complete ? <SvgIcon name="check" size={12} /> : ""}</i>
            <span><b>{item.label}</b><small>{item.person} · {item.time}</small></span>
          </li>
        ))}
      </ol>
      {actions && <div className="modal-actions">{actions}</div>}
    </Modal>
  );
}

function CalendarPage({ state, updateState, openCreate, notify }: EmployeeProps) {
  const [view, setView] = useState("Week");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date("2026-08-13T12:00:00"));
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 650px)").matches) setView("Agenda");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, index) => {
    const value = new Date(weekStart);
    value.setDate(weekStart.getDate() + index);
    return value;
  });
  const sortedEvents = [...state.events].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const periodLabel = view === "Month"
    ? anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : `${weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${weekDays[4].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const shiftPeriod = (direction: number) => setAnchor(current => {
    const next = new Date(current);
    next.setDate(current.getDate() + direction * (view === "Month" ? 28 : 7));
    return next;
  });

  const getRowFromTime = (timeStr: string) => {
    const hour = parseInt(timeStr.slice(0, 2), 10);
    if (isNaN(hour) || hour < 10) return 2;
    if (hour < 12) return 3;
    if (hour < 14) return 4;
    if (hour < 16) return 5;
    return 6;
  };

  const syncGoogle = async () => {
    if (!state.adminSettings.googleConnected) { window.location.assign("/api/auth/google/start"); return; }
    setSyncing(true);
    try {
      const response = await fetch("/api/google/calendar");
      const result = await response.json() as { items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string; description?: string; attendees?: Array<{ email?: string }>; hangoutLink?: string; htmlLink?: string }>; error?: string };
      if (!response.ok) throw new Error(result.error || "Google Calendar sync failed");
      const imported = (result.items || []).map(item => {
        const startValue = item.start?.dateTime || item.start?.date || "";
        const endValue = item.end?.dateTime || item.end?.date || startValue;
        return {
          id: `GOOGLE-${item.id}`,
          googleId: item.id,
          title: item.summary || "Untitled event",
          date: startValue.slice(0, 10),
          start: startValue.includes("T") ? startValue.slice(11, 16) : "All day",
          end: endValue.includes("T") ? endValue.slice(11, 16) : "All day",
          location: item.location || (item.hangoutLink ? "Google Meet" : ""),
          meet: Boolean(item.hangoutLink),
          guests: (item.attendees || []).flatMap(guest => guest.email ? [guest.email] : []),
          notes: item.description || "",
          webLink: item.htmlLink || item.hangoutLink,
        } as EventItem;
      });
      updateState(current => ({ ...current, events: [...current.events.filter(event => !event.googleId), ...imported] }));
      notify(`${imported.length} Google Calendar events synced`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Calendar sync failed";
      notify(message);
      if (message.startsWith("Connect your Google")) window.location.assign("/api/auth/google/start");
    } finally {
      setSyncing(false);
    }
  };

  const beginEdit = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditDate(selected.date);
    setEditStart(selected.start);
    setEditEnd(selected.end);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (selected.googleId) {
      const payload = {
        summary: editTitle,
        start: { dateTime: `${editDate}T${editStart}:00`, timeZone: state.profile.timezone },
        end: { dateTime: `${editDate}T${editEnd}:00`, timeZone: state.profile.timezone },
      };
      const response = await fetch(`/api/google/calendar?eventId=${encodeURIComponent(selected.googleId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return notify("Google Calendar event could not be updated");
    }
    const next = { ...selected, title: editTitle, date: editDate, start: editStart, end: editEnd };
    updateState(current => ({ ...current, events: current.events.map(event => event.id === selected.id ? next : event) }));
    setSelected(next);
    setEditing(false);
    notify("Calendar event updated");
  };

  const cancelEvent = async () => {
    if (!selected || !window.confirm(`Cancel ${selected.title}? Guests will be notified for Google Calendar events.`)) return;
    if (selected.googleId) {
      const response = await fetch(`/api/google/calendar?eventId=${encodeURIComponent(selected.googleId)}`, { method: "DELETE" });
      if (!response.ok) return notify("Google Calendar event could not be cancelled");
    }
    updateState(current => ({ ...current, events: current.events.filter(event => event.id !== selected.id) }));
    setSelected(null);
    notify("Calendar event cancelled");
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow="GOOGLE CALENDAR"
        title="Team calendar"
        text="Plan meetings, check availability and manage Google Meet events from the portal."
        secondary={<button className="secondary" onClick={syncGoogle}>{syncing ? "Syncing…" : state.adminSettings.googleConnected ? "Sync Google Calendar" : "Connect Google Calendar"}</button>}
        action={<button className="primary" onClick={() => openCreate("event")}>＋ Create event</button>}
      />
      <div className="calendar-toolbar">
        <div>
          <button className="secondary" aria-label="Previous period" onClick={() => shiftPeriod(-1)}>‹</button>
          <button className="secondary" onClick={() => setAnchor(new Date("2026-08-13T12:00:00"))}>Today</button>
          <button className="secondary" aria-label="Next period" onClick={() => shiftPeriod(1)}>›</button>
        </div>
        <h2>{periodLabel}</h2>
        <div className="segmented compact">
          {["Week", "Month", "Agenda"].map(value => <button className={view === value ? "active" : ""} key={value} onClick={() => setView(value)}>{value}</button>)}
        </div>
      </div>
      {view === "Agenda" ? (
        <section className="card agenda-list">
          {sortedEvents.map(event => (
            <button key={event.id} onClick={() => setSelected(event)}>
              <time>{event.date}<b>{event.start}</b></time>
              <span><b>{event.title}</b><small>{event.location} · {event.guests.length} guest group</small></span>
              <StatusPill value={event.meet ? "Google Meet" : "In person"} />
              <i>›</i>
            </button>
          ))}
        </section>
      ) : view === "Month" ? (
        <section className="card month-board">
          {sortedEvents.filter(event => event.date.startsWith(`${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`)).map(event => (
            <button key={event.id} onClick={() => setSelected(event)}>
              <time>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</time>
              <span><b>{event.title}</b><small>{event.start} · {event.location}</small></span>
              <StatusPill value={event.meet ? "Google Meet" : "In person"} />
            </button>
          ))}
        </section>
      ) : (
        <section className="card calendar-board">
          <div className="calendar-times">
            <b />
            {["09:00", "11:00", "13:00", "15:00", "17:00"].map(time => <span key={time}>{time}</span>)}
          </div>
          {weekDays.map(day => (
            <div className="calendar-day" key={isoDate(day)}>
              <b>{day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }).toUpperCase()}</b>
              {state.events.filter(event => event.date === isoDate(day)).map(event => (
                <button
                  style={{ gridRow: getRowFromTime(event.start) }}
                  onClick={() => setSelected(event)}
                  className="calendar-event"
                  key={event.id}
                >
                  <b>{event.start}</b>
                  <small>{event.title}</small>
                </button>
              ))}
            </div>
          ))}
        </section>
      )}
      <section className="card availability">
        <div>
          <h3>Schedule with confidence</h3>
          <p>Check colleagues’ Google Calendar availability before sending an invitation.</p>
        </div>
        <button className="secondary" onClick={() => openCreate("event")}>Find a time</button>
      </section>
      {selected && !editing && (
        <Modal title={selected.title} eyebrow={selected.googleId ? "GOOGLE CALENDAR EVENT" : "PORTAL CALENDAR EVENT"} close={() => setSelected(null)}>
          <dl className="detail-list">
            <div><dt>Date and time</dt><dd>{selected.date} · {selected.start}–{selected.end}</dd></div>
            <div><dt>Location</dt><dd>{selected.location}</dd></div>
            <div><dt>Guests</dt><dd>{selected.guests.join(", ") || "No guests"}</dd></div>
            <div><dt>Notes</dt><dd>{selected.notes || "No notes"}</dd></div>
          </dl>
          <div className="modal-actions">
            <button className="secondary" onClick={cancelEvent}>Cancel event</button>
            <button className="secondary" onClick={beginEdit}>Edit</button>
            {selected.webLink && <a className="primary" href={selected.webLink} target="_blank" rel="noreferrer">Open in Google</a>}
          </div>
        </Modal>
      )}
      {selected && editing && (
        <Modal title="Edit calendar event" eyebrow={selected.googleId ? "GOOGLE CALENDAR" : "PORTAL CALENDAR"} close={() => setEditing(false)}>
          <div className="create-form">
            <label>Event title<input value={editTitle} onChange={event => setEditTitle(event.target.value)} /></label>
            <label>Date<input type="date" value={editDate} onChange={event => setEditDate(event.target.value)} /></label>
            <div className="form-grid">
              <label>Start<input type="time" value={editStart} onChange={event => setEditStart(event.target.value)} /></label>
              <label>End<input type="time" value={editEnd} onChange={event => setEditEnd(event.target.value)} /></label>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="primary" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KnowledgePage({ state, updateState, notify }: EmployeeProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Article | null>(null);
  const categories = ["All", ...Array.from(new Set(state.articles.map(item => item.category)))];
  const articles = state.articles.filter(item => (category === "All" || item.category === category) && `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));
  const markHelpful = (id: string) => updateState(current => ({ ...current, articles: current.articles.map(item => item.id === id ? { ...item, helpful: (item.helpful || 0) + 1 } : item) }));

  return (
    <div className="page">
      <PageIntro eyebrow="KNOWLEDGE" title="Knowledge and policies" text="Find trusted answers, see review dates and acknowledge important policies." />
      <div className="knowledge-search">
        <SvgIcon name="search" size={18} />
        <input aria-label="Search knowledge" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search policies, guidance and company news" />
      </div>
      <div className="category-row">
        {categories.map(value => <button className={category === value ? "active" : ""} key={value} onClick={() => setCategory(value)}>{value}</button>)}
      </div>
      <div className="article-grid">
        {articles.map(article => (
          <button className="card article-card" key={article.id} onClick={() => setSelected(article)}>
            <span>{article.category}</span>
            <h3>{article.title}</h3>
            <p>{article.summary}</p>
            <small>Owner: {article.owner} · Reviewed {article.reviewed}</small>
            <b>Read article →</b>
          </button>
        ))}
      </div>
      {selected && (
        <Modal title={selected.title} eyebrow={selected.category} close={() => setSelected(null)} className="medium-modal">
          <p className="modal-lead">{selected.summary}</p>
          <div className="article-body">
            <h3>What you need to know</h3>
            <p>This company guidance brings the current process, responsibilities and useful links together. Contact {selected.owner} if anything is unclear or needs updating.</p>
            <h3>Owner and review</h3>
            <p>Owned by {selected.owner}. Last reviewed {selected.reviewed}.</p>
          </div>
          {selected.acknowledgement && (
            <label className="acknowledge">
              <input type="checkbox" onChange={event => event.target.checked && notify("Policy acknowledgement recorded")} /> I have read and understood this policy
            </label>
          )}
          <div className="modal-actions">
            <button className="secondary" onClick={() => { markHelpful(selected.id); notify("Thanks for your feedback"); }}>Helpful · {selected.helpful || 0}</button>
            <button className="primary" onClick={() => { navigator.clipboard?.writeText(window.location.href); notify("Page link copied"); }}>Copy link</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PeoplePage({ updateState, navigate, notify }: EmployeeProps) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [orgOpen, setOrgOpen] = useState(false);
  const [person, setPerson] = useState<string | null>(null);

  const people = [
    ["MR", "Muneeb Rizwan", "Operations", "Super administrator", "Operations planning, workflows", "English, Urdu", "Available"],
    ["SK", "Sofia Khan", "Customer Support", "Head of Support", "Customer care, coaching", "English, Urdu", "In a meeting"],
    ["DC", "Daniel Cole", "Marketing", "Marketing Manager", "Campaigns, brand", "English", "Available"],
    ["PS", "Priya Shah", "Finance", "Finance Manager", "Procurement, reporting", "English, Hindi", "Away"],
    ["SW", "Sam Wilson", "Operations", "Fleet Coordinator", "Fleet, driver documents", "English", "Available"],
    ["AB", "Amelia Brown", "People", "HR Business Partner", "Onboarding, policies", "English, French", "Available"],
  ];

  const filtered = people.filter(item => (department === "All departments" || item[2] === department) && item.slice(1).join(" ").toLowerCase().includes(query.toLowerCase()));
  const selected = people.find(item => item[1] === person);
  const employeeEmail = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@takeme.taxi`;

  const copyEmail = (name: string) => {
    const email = employeeEmail(name);
    navigator.clipboard?.writeText(email);
    notify(`Copied ${email} to clipboard`);
  };

  const startChat = (item: string[]) => {
    updateState(current => {
      const existing = current.conversations.find(conversation => conversation.type === "Direct" && conversation.name === item[1]);
      if (existing) return current;
      return { ...current, conversations: [{ id: makeId("CHAT"), name: item[1], type: "Direct", members: [employeeEmail(item[1])], unread: 0, messages: [] }, ...current.conversations] };
    });
    navigate("Chat");
    notify(`Direct conversation ready with ${item[1]}`);
  };

  return (
    <div className="page">
      <PageIntro eyebrow="PEOPLE" title="Employee directory" text="Find the right person by role, department, skills or language." action={<button className="secondary" onClick={() => setOrgOpen(true)}>View organisation chart</button>} />
      <div className="toolbar">
        <input aria-label="Search employees" placeholder="Search names, skills, roles or languages" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Department" value={department} onChange={event => setDepartment(event.target.value)}>
          {["All departments", "Operations", "Customer Support", "Marketing", "Finance", "People"].map(value => <option key={value}>{value}</option>)}
        </select>
        <span>{filtered.length} people</span>
      </div>
      <div className="people-grid">
        {filtered.map(item => (
          <article className="card person-card" key={item[1]}>
            <button className="person-main" onClick={() => setPerson(item[1])}>
              <i>{item[0]}</i>
              <span><h3>{item[1]}</h3><p>{item[3]}</p><small>{item[2]}</small></span>
            </button>
            <div className="presence"><i className={item[6] === "Available" ? "ok" : item[6] === "Away" ? "warn" : "busy"} />{item[6]}</div>
            <p className="skills"><b>Can help with:</b> {item[4]}</p>
            <div className="person-actions">
              <button className="secondary" title="Copy email address" onClick={() => copyEmail(item[1])}>Copy email</button>
              <button className="primary" onClick={() => startChat(item)}>Chat</button>
            </div>
          </article>
        ))}
      </div>
      {orgOpen && (
        <Modal title="Take Me organisation chart" eyebrow="COMPANY STRUCTURE" close={() => setOrgOpen(false)} className="wide-modal">
          <div className="org-chart">
            <div className="org-root"><b>Leadership team</b><small>Take Me Group</small></div>
            <div className="org-branches">
              {[
                ["Operations", "Muneeb Rizwan", "74 people"],
                ["Customer Support", "Sofia Khan", "63 people"],
                ["Marketing", "Daniel Cole", "18 people"],
                ["Finance", "Priya Shah", "22 people"],
                ["People", "Amelia Brown", "12 people"]
              ].map(row => (
                <button key={row[0]} onClick={() => { setDepartment(row[0]); setOrgOpen(false); }}>
                  <b>{row[0]}</b>
                  <span>{row[1]}</span>
                  <small>{row[2]}</small>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {selected && (
        <Modal title={selected[1]} eyebrow="EMPLOYEE PROFILE" close={() => setPerson(null)}>
          <div className="profile-card">
            <i>{selected[0]}</i>
            <div><h3>{selected[3]}</h3><p>{selected[2]} · {selected[6]}</p></div>
          </div>
          <dl className="detail-list">
            <div><dt>Email</dt><dd>{employeeEmail(selected[1])}</dd></div>
            <div><dt>Department</dt><dd>{selected[2]}</dd></div>
            <div><dt>Skills</dt><dd>{selected[4]}</dd></div>
            <div><dt>Languages</dt><dd>{selected[5]}</dd></div>
          </dl>
          <div className="modal-actions">
            <button className="secondary" onClick={() => copyEmail(selected[1])}>Copy email</button>
            <button className="primary" onClick={() => { setPerson(null); startChat(selected); }}>Send message</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DocumentsPage({ state, updateState, notify }: EmployeeProps) {
  const [folder, setFolder] = useState("All files");
  const [docQuery, setDocQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const folders = ["All files", ...Array.from(new Set(state.documents.map(item => item.folder)))];
  const documents = state.documents.filter(item => (folder === "All files" || item.folder === folder) && `${item.name} ${item.owner}`.toLowerCase().includes(docQuery.toLowerCase()));

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    let pendingKey = "";
    try {
      const request = await fetch("/api/files", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size }) });
      const direct = await request.json() as { direct?: boolean; uploadUrl?: string; key?: string; contentType?: string; error?: string };
      if (!request.ok) throw new Error(direct.error || "Upload could not be started");
      let result: { key?: string; error?: string };
      if (direct.direct && direct.uploadUrl && direct.key) {
        pendingKey = direct.key;
        const transfer = await fetch(direct.uploadUrl, { method: "PUT", headers: { "content-type": direct.contentType || file.type }, body: file });
        if (!transfer.ok) throw new Error("The file could not be transferred to secure storage");
        const confirmation = await fetch("/api/files", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: direct.key }) });
        result = await confirmation.json() as { key?: string; error?: string };
        if (!confirmation.ok) throw new Error(result.error || "Upload could not be confirmed");
      } else {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/files", { method: "POST", body: form });
        result = await response.json() as { key?: string; error?: string };
        if (!response.ok) throw new Error(result.error || "Upload failed");
      }
      if (!result.key) throw new Error(result.error || "Upload failed");
      updateState(current => ({
        ...current,
        documents: [
          {
            id: makeId("DOC"),
            name: file.name,
            type: file.type || "File",
            owner: current.profile.name,
            updated: "Just now",
            folder: folder === "All files" ? "My uploads" : folder,
            size: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`,
            key: result.key,
          },
          ...current.documents,
        ],
      }));
      notify(`${file.name} uploaded`);
    } catch (error) {
      if (pendingKey) fetch(`/api/files?key=${encodeURIComponent(pendingKey)}`, { method: "DELETE" }).catch(() => undefined);
      notify(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const browseDrive = async () => {
    if (!state.adminSettings.googleConnected) { window.location.assign("/api/auth/google/start"); return; }
    setDriveOpen(true);
    setDriveLoading(true);
    try {
      const response = await fetch("/api/google/drive");
      const result = await response.json() as { files?: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }>; error?: string };
      if (!response.ok) throw new Error(result.error || "Google Drive could not be loaded");
      setDriveFiles(result.files || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Drive could not be loaded";
      notify(message);
      if (message.startsWith("Connect your Google")) window.location.assign("/api/auth/google/start");
    } finally {
      setDriveLoading(false);
    }
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow="FILES"
        title="Documents"
        text="Company Drive files, portal uploads, templates and guides in one library."
        secondary={<button className="secondary" onClick={browseDrive}>{state.adminSettings.googleConnected ? "Browse Google Drive" : "Connect Google Drive"}</button>}
        action={(
          <>
            <input ref={inputRef} hidden type="file" onChange={event => upload(event.target.files?.[0])} />
            <button className="primary" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? "Uploading…" : "＋ Upload file"}</button>
          </>
        )}
      />
      <div className="folder-tabs">
        {folders.map(value => <button className={folder === value ? "active" : ""} key={value} onClick={() => setFolder(value)}>{value}</button>)}
      </div>
      <div className="knowledge-search" style={{ marginBottom: 16 }}>
        <SvgIcon name="search" size={16} />
        <input aria-label="Search documents" value={docQuery} onChange={event => setDocQuery(event.target.value)} placeholder="Filter documents by name or owner…" />
      </div>
      <section className="card data-card">
        <div className="data-head document-head">
          <span>Name</span>
          <span>Folder</span>
          <span>Owner</span>
          <span>Updated</span>
          <span></span>
        </div>
        {documents.map(item => {
          const content = (
            <>
              <span><b>{item.name}</b><small>{item.type} · {item.size}</small></span>
              <span data-label="Folder">{item.folder}</span>
              <span data-label="Owner">{item.owner}</span>
              <span data-label="Updated">{item.updated}</span>
              <i>↗</i>
            </>
          );
          return item.key ? (
            <a className="data-row document-row" key={item.id} href={`/api/files?key=${encodeURIComponent(item.key)}`}>{content}</a>
          ) : (
            <button className="data-row document-row" key={item.id} onClick={() => notify(item.drive ? `${item.name} requires its Google Drive link to be configured` : `${item.name} does not have a preview file attached`)}>{content}</button>
          );
        })}
        {!documents.length && <EmptyState title="No documents found" text="No documents match your filter or search query." />}
      </section>
      {driveOpen && (
        <Modal title="Google Drive" eyebrow="WORKSPACE FILES" close={() => setDriveOpen(false)} className="medium-modal">
          {driveLoading ? (
            <p className="modal-lead">Loading company Drive files…</p>
          ) : (
            <div className="drive-results">
              {driveFiles.map(file => (
                <a key={file.id} href={file.webViewLink} target="_blank" rel="noreferrer">
                  <i><SvgIcon name="documents" size={18} /></i>
                  <span><b>{file.name}</b><small>{file.mimeType.replace("application/vnd.google-apps.", "Google ")} · {file.modifiedTime?.slice(0, 10) || "Recently updated"}</small></span>
                  <em>↗</em>
                </a>
              ))}
              {!driveFiles.length && <p>No matching Google Drive files were returned.</p>}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function ChatPage({ state, updateState, openCreate, notify, realtime }: EmployeeProps) {
  const [activeId, setActiveId] = useState(state.conversations[0]?.id || "");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sendRealtime = realtime.send;
  const active = state.conversations.find(item => item.id === activeId) || state.conversations[0];
  const typingEvent = realtime.latestEvent?.type === "chat.typing" && realtime.latestEvent.conversationId === active?.id ? realtime.latestEvent : null;
  const typingName = typingEvent?.active ? typingEvent.actor?.name || "Someone" : "";

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: state.preferences.reducedMotion ? "auto" : "smooth" });
  }, [active?.messages.length, active?.id, state.preferences.reducedMotion]);

  useEffect(() => () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (active?.id) sendRealtime({ type: "chat.typing", conversationId: active.id, active: false });
  }, [active?.id, sendRealtime]);

  const updateMessage = (value: string) => {
    setMessage(value);
    if (!active?.id) return;
    sendRealtime({ type: "chat.typing", conversationId: active.id, active: Boolean(value.trim()) });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      sendRealtime({ type: "chat.typing", conversationId: active.id, active: false });
    }, 1800);
  };

  const send = () => {
    const text = message.trim();
    if (!text || !active) return;
    const item = { id: makeId("MSG"), author: state.profile.name, initials: state.profile.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase(), text, time: "Now", mine: true };
    updateState(current => ({
      ...current,
      conversations: current.conversations.map(conversation => conversation.id === active.id ? { ...conversation, messages: [...conversation.messages, item] } : conversation),
    }));
    sendRealtime({ type: "chat.typing", conversationId: active.id, active: false });
    setMessage("");
  };

  const addReaction = (msgId: string, emoji: string) => {
    notify(`Reacted with ${emoji}`);
  };

  if (!active) return (
    <div className="page">
      <PageIntro eyebrow="CHAT" title="Team chat" text="Channels, group conversations and direct messages with colleagues." action={<button className="primary" onClick={() => openCreate("conversation")}>＋ New conversation</button>} />
      <EmptyState title="No conversations" text="Start a channel, group conversation or direct chat." action="Start a conversation" onAction={() => openCreate("conversation")} />
    </div>
  );

  return (
    <div className="page chat-page">
      <PageIntro eyebrow="CHAT" title="Team chat" text="Channels, group conversations and direct messages with colleagues." action={<button className="primary" onClick={() => openCreate("conversation")}>＋ New conversation</button>} />
      <section className="chat-layout">
        <aside className="channel-list">
          {state.conversations.map(item => (
            <button
              className={`channel-item ${item.id === active.id ? "active" : ""}`}
              key={item.id}
              onClick={() => {
                setActiveId(item.id);
                updateState(current => ({ ...current, conversations: current.conversations.map(conversation => conversation.id === item.id ? { ...conversation, unread: 0 } : conversation) }));
              }}
            >
              <i>{item.type === "Direct" ? "@" : "#"}</i>
              <span>{item.name}</span>
              {item.unread > 0 && <mark>{item.unread}</mark>}
            </button>
          ))}
        </aside>
        <div className="conversation">
          <header>
            <div>
              <h2>{active.type === "Direct" ? "@" : "#"} {active.name}</h2>
              <p>{active.members.join(", ")}</p>
            </div>
            <button className="secondary" onClick={() => setDetails(true)}>Details</button>
          </header>
          <div className="messages" ref={messagesRef}>
            {active.messages.length ? active.messages.map(item => (
              <div className={`message ${item.author === state.profile.name ? "mine" : ""}`} key={item.id}>
                <i>{item.initials}</i>
                <div>
                  <p><b>{item.author}<small>{item.time}</small></b>{item.text}</p>
                  <div className="message-reactions">
                    <button type="button" title="Thumbs up" onClick={() => addReaction(item.id, "👍")}>👍</button>
                    <button type="button" title="Heart" onClick={() => addReaction(item.id, "❤️")}>❤️</button>
                    <button type="button" title="Celebrate" onClick={() => addReaction(item.id, "🎉")}>🎉</button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="conversation-empty">
                <b>Start the conversation</b>
                <p>Send the first message to {active.name}.</p>
              </div>
            )}
          </div>
          <div className="composer-area">
            {typingName && <p className="typing-indicator" role="status"><i /><span>{typingName} is typing…</span></p>}
            <div className="composer">
              <input aria-label={`Message ${active.name}`} value={message} onChange={event => updateMessage(event.target.value)} onKeyDown={event => event.key === "Enter" && send()} placeholder={`Message ${active.name}`} />
              <button className="secondary" aria-label="Create a follow-up task" title="Create a follow-up task" onClick={() => openCreate("task")}>
                <SvgIcon name="tasks" size={14} />
              </button>
              <button className="primary" onClick={send}>Send</button>
            </div>
          </div>
        </div>
      </section>
      {details && (
        <Modal title={active.name} eyebrow={`${active.type.toUpperCase()} DETAILS`} close={() => setDetails(false)}>
          <dl className="detail-list">
            <div><dt>Members</dt><dd>{active.members.join(", ")}</dd></div>
            <div><dt>Messages</dt><dd>{active.messages.length}</dd></div>
            <div><dt>Notifications</dt><dd>All activity</dd></div>
          </dl>
          <div className="modal-actions">
            <button className="secondary" onClick={() => notify("Conversation notifications updated")}>Mute 1 hour</button>
            <button className="primary" onClick={() => notify("Member management is connected")}>Add people</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LeavePage({ state, openCreate }: EmployeeProps) {
  const [tab, setTab] = useState("Leave balance & requests");
  const [leaveFilter, setLeaveFilter] = useState("All");
  const [leaveQuery, setLeaveQuery] = useState("");

  const filteredLeave = state.leave.filter(item => (leaveFilter === "All" || item.type === leaveFilter || item.status === leaveFilter) && `${item.employee} ${item.dates}`.toLowerCase().includes(leaveQuery.toLowerCase()));

  return (
    <div className="page">
      <PageIntro eyebrow="TIME OFF" title="Leave & time off" text="Manage time away, leave balances and team holiday coverage." action={<button className="primary" onClick={() => openCreate("leave")}>＋ Request leave</button>} />
      <div className="segmented">{["Leave balance & requests", "Team absence calendar"].map(value => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{value}</button>)}</div>
      {tab === "Leave balance & requests" && (
        <>
          <div className="balance-grid">
            {[["21", "Days remaining"], ["5", "Booked"], ["2", "Work from home"], ["0", "Sickness days"]].map(item => (
              <section className="card" key={item[1]}>
                <b>{item[0]}</b>
                <span>{item[1]}</span>
              </section>
            ))}
          </div>

          <section className="card leave-meter-card">
            <div className="leave-meter-head">
              <b>Annual leave allowance</b>
              <span>21 / 28 days available (75%)</span>
            </div>
            <div className="leave-meter-bar" role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>
              <div className="leave-meter-fill" style={{ width: "75%" }} />
            </div>
          </section>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <input aria-label="Search leave requests" placeholder="Filter requests by name or dates…" value={leaveQuery} onChange={event => setLeaveQuery(event.target.value)} />
            <select aria-label="Filter type" value={leaveFilter} onChange={event => setLeaveFilter(event.target.value)}>
              {["All", "Annual leave", "Work from home", "Sickness", "Approved", "Pending"].map(value => <option key={value}>{value}</option>)}
            </select>
            <span>{filteredLeave.length} records</span>
          </div>

          <section className="card data-card">
            <div className="data-head leave-head">
              <span>Employee</span>
              <span>Type</span>
              <span>Dates</span>
              <span>Days</span>
              <span>Status</span>
            </div>
            {filteredLeave.map(item => (
              <div className="data-row leave-row" key={item.id}>
                <span><b>{item.employee}</b><small>{item.id}</small></span>
                <span data-label="Type">{item.type}</span>
                <span data-label="Dates">{item.dates}</span>
                <strong data-label="Days">{item.days}</strong>
                <span className="mobile-field" data-label="Status"><StatusPill value={item.status} /></span>
              </div>
            ))}
            {!filteredLeave.length && <EmptyState title="No leave requests" text="No leave records match your filter criteria." />}
          </section>
        </>
      )}
      {tab === "Team absence calendar" && (
        <section className="card absence-calendar">
          <div className="absence-days">{["Mon 10", "Tue 11", "Wed 12", "Thu 13", "Fri 14"].map(day => <b key={day}>{day}</b>)}</div>
          <div className="absence-person"><span>Muneeb Rizwan</span><i style={{ gridColumn: "4 / 6" }}>Annual leave</i></div>
          <div className="absence-person"><span>Sam Wilson</span><i style={{ gridColumn: "5" }}>WFH</i></div>
          <div className="absence-person"><span>Sofia Khan</span><i style={{ gridColumn: "2 / 4" }}>Training</i></div>
        </section>
      )}
    </div>
  );
}
