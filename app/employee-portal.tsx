"use client";

import Image from "next/image";
import { upload as uploadPrivateBlob } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import type {
  PortalState,
  RequestItem,
  EventItem,
  Article,
  Employee,
  ChatAttachment,
  ChatMessage,
} from "./portal-data";
import { formatDate, formatDateTime, makeId } from "./portal-data";
import {
  EmptyState,
  Modal,
  PageIntro,
  StatusPill,
  SvgIcon,
  type Notify,
} from "./portal-ui";
import ProjectsPortal from "./projects-portal";
import type { RealtimeControls } from "./use-realtime";

export type UpdatePortal = (
  updater: (current: PortalState) => PortalState,
) => void;

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
    case "Home":
      return <HomePage {...props} />;
    case "Work":
      return <WorkHub {...props} />;
    case "Action inbox":
      return <ActionInbox {...props} />;
    case "Tasks":
      return <TasksPage {...props} />;
    case "Projects":
      return (
        <ProjectsPortal
          state={props.state}
          updateState={props.updateState}
          notify={props.notify}
        />
      );
    case "People":
      return <PeoplePage {...props} />;
    case "Requests":
      return <RequestsPage {...props} />;
    case "Calendar":
      return <CalendarPage {...props} />;
    case "Resources":
      return <ResourcesHub {...props} />;
    case "Knowledge":
      return <KnowledgePage {...props} />;
    case "Documents":
      return <DocumentsPage {...props} />;
    case "Chat":
      return <ChatPage {...props} />;
    case "Leave":
    case "Leave & shifts":
      return <LeavePage {...props} />;
    default:
      return <HomePage {...props} />;
  }
}

function WorkHub({ state, navigate, openCreate }: EmployeeProps) {
  const pendingApprovals = state.approvals.filter(item => item.status === "Pending");
  const openTasks = state.tasks.filter(item => item.status !== "Done");
  const activeRequests = state.requests.filter(item => !["Approved", "Rejected", "Complete", "Completed"].includes(item.status));
  const pendingLeave = state.leave.filter(item => item.status === "Pending");
  const workAreas = [
    { title: "Decisions", detail: "Approvals waiting for you", count: pendingApprovals.length, page: "Action inbox", icon: "check", action: "Review approvals" },
    { title: "My tasks", detail: "Assigned work still open", count: openTasks.length, page: "Tasks", icon: "tasks", action: "Open tasks" },
    { title: "Requests", detail: "Requests still in progress", count: activeRequests.length, page: "Requests", icon: "requests", action: "Track requests" },
    { title: "Leave", detail: "Time off and availability", count: pendingLeave.length, page: "Leave", icon: "leave", action: "Manage leave" },
  ];
  return <div className="page work-hub-page">
    <PageIntro eyebrow="MY WORK" title="Everything requiring your attention" text="Decisions, tasks, requests and leave are brought together in one focused workspace." action={<button className="primary" onClick={() => openCreate("task")}>Add task</button>} />
    <section className="attention-summary" aria-label="Work summary">
      <div><span>{pendingApprovals.length + openTasks.length + activeRequests.length}</span><p><b>Open items</b><small>Across your work</small></p></div>
      <div><span>{pendingApprovals.length}</span><p><b>Need a decision</b><small>Review these first</small></p></div>
      <div><span>{pendingLeave.length}</span><p><b>Leave requests</b><small>Awaiting an outcome</small></p></div>
    </section>
    <div className="work-hub-grid">
      {workAreas.map(area => <button key={area.page} className="work-hub-card" onClick={() => navigate(area.page)}>
        <i><SvgIcon name={area.icon} size={20} /></i><span><b>{area.title}</b><small>{area.detail}</small></span><strong>{area.count}</strong><em>{area.action} →</em>
      </button>)}
    </div>
  </div>;
}

function ResourcesHub({ state, navigate }: EmployeeProps) {
  return <div className="page resources-hub-page">
    <PageIntro eyebrow="RESOURCES" title="Find trusted company information" text="Search guidance and documents without deciding which system holds them first." />
    <div className="resource-entry-grid">
      <button onClick={() => navigate("Knowledge")}><i><SvgIcon name="knowledge" size={24} /></i><span><b>Knowledge</b><small>{state.articles.length} guides, policies and answers</small></span><em>Browse knowledge →</em></button>
      <button onClick={() => navigate("Documents")}><i><SvgIcon name="documents" size={24} /></i><span><b>Documents</b><small>{state.documents.length} shared company files</small></span><em>Browse documents →</em></button>
    </div>
  </div>;
}

function HomePage({
  state,
  updateState,
  navigate,
  notify,
  openCreate,
  openNotifications,
}: EmployeeProps) {
  const [customise, setCustomise] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const todayStripRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const pending = state.approvals.filter(
    (item) => item.status === "Pending",
  ).length;
  const dueTasks = state.tasks.filter((item) => item.status !== "Done").length;
  const dueToday = state.tasks.filter(
    (item) => item.status !== "Done" && item.due === formatDate(now),
  ).length;
  const unread = state.notifications.filter(
    (item) => !item.read && !item.snoozed,
  ).length;
  const todayKey = localDateKey(now);
  const todayEvents = state.events.filter((event) => event.date === todayKey);
  const hasCurrentWork =
    pending > 0 || dueTasks > 0 || todayEvents.length > 0 || unread > 0;
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const dateHeading = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(now)
    .toUpperCase();
  const widgetNames: Record<string, string> = {
    approvals: "Approvals",
    calendar: "Today’s calendar",
    tasks: "Tasks",
    news: "Company news",
    quickLinks: "Quick links",
  };
  const moveWidget = (id: string, direction: number) =>
    updateState((current) => {
      const widgets = [...current.widgets];
      const index = widgets.indexOf(id);
      const target = index + direction;
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
        secondary={
          <button className="secondary" onClick={() => setCustomise(true)}>
            Customise home
          </button>
        }
        action={
          <button className="primary" onClick={() => openCreate()}>
            ＋ Quick create
          </button>
        }
      />
      <div className="today-strip-wrap">
        <section
          className="today-strip"
          ref={todayStripRef}
          aria-label="Today at a glance"
        >
          <button
            onClick={() => navigate("Action inbox")}
            aria-label={`${pending} pending ${pending === 1 ? "approval" : "approvals"}. Open action inbox.`}
          >
            <i>
              <SvgIcon name="check" size={18} />
            </i>
            <span>
              <b>
                {pending} {pending === 1 ? "approval" : "approvals"}
              </b>
              <small>
                {pending ? "Waiting for your decision" : "No decisions needed"}
              </small>
            </span>
          </button>
          <button onClick={() => navigate("Tasks")}>
            <i>
              <SvgIcon name="tasks" size={18} />
            </i>
            <span>
              <b>
                {dueTasks} open {dueTasks === 1 ? "task" : "tasks"}
              </b>
              <small>
                {dueToday
                  ? `${dueToday} ${dueToday === 1 ? "is" : "are"} due today`
                  : "Nothing is due today"}
              </small>
            </span>
          </button>
          <button onClick={() => navigate("Calendar")}>
            <i>
              <SvgIcon name="calendar" size={18} />
            </i>
            <span>
              <b>
                {todayEvents.length}{" "}
                {todayEvents.length === 1 ? "meeting" : "meetings"} today
              </b>
              <small>
                {todayEvents[0]
                  ? `Next at ${todayEvents[0].start}`
                  : "No meetings scheduled"}
              </small>
            </span>
          </button>
          <button onClick={openNotifications}>
            <i>
              <SvgIcon name="bell" size={18} />
            </i>
            <span>
              <b>
                {unread} new {unread === 1 ? "update" : "updates"}
              </b>
              <small>Across the portal</small>
            </span>
          </button>
        </section>
        <div className="today-strip-footer">
          <p className="today-strip-hint">
            Swipe or use the buttons to see more
          </p>
          <div
            className="today-strip-controls"
            aria-label="At a glance carousel controls"
          >
            <button
              aria-label="Show previous summary"
              onClick={() => {
                if (todayStripRef.current)
                  todayStripRef.current.scrollLeft -=
                    todayStripRef.current.clientWidth;
              }}
            >
              ←
            </button>
            <button
              aria-label="Show next summary"
              onClick={() => {
                if (todayStripRef.current)
                  todayStripRef.current.scrollLeft +=
                    todayStripRef.current.clientWidth;
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
      {hasCurrentWork && <section className="home-focus-grid" aria-label="Your priorities today">
        <div className="focus-surface">
          <header><div><p className="eyebrow">NEEDS YOUR ATTENTION</p><h2>Start with what matters</h2></div><button className="text-button" onClick={() => navigate("Work")}>Open all work →</button></header>
          <div className="focus-list">
            {state.approvals.filter(item => item.status === "Pending").slice(0, 2).map(item => <button key={item.id} onClick={() => navigate("Action inbox")}><i className="focus-urgent"><SvgIcon name="check" size={16} /></i><span><b>{item.title}</b><small>Approval · Decision required</small></span><em>Review</em></button>)}
            {state.tasks.filter(item => item.status !== "Done").slice(0, 3).map(item => <button key={item.id} onClick={() => navigate("Tasks")}><i><SvgIcon name="tasks" size={16} /></i><span><b>{item.title}</b><small>{item.due ? `Due ${item.due}` : "Open task"}</small></span><em>Open</em></button>)}
            {!pending && !dueTasks && <p className="focus-empty">Nothing needs a decision right now.</p>}
          </div>
        </div>
        <div className="focus-surface today-agenda">
          <header><div><p className="eyebrow">TODAY</p><h2>Your agenda</h2></div><button className="text-button" onClick={() => navigate("Calendar")}>Calendar →</button></header>
          <div className="focus-list">
            {todayEvents.slice(0, 4).map(event => <button key={event.id} onClick={() => navigate("Calendar")}><time>{event.start}</time><span><b>{event.title}</b><small>{event.location || "Calendar event"}</small></span></button>)}
            {!todayEvents.length && <div className="agenda-empty"><SvgIcon name="calendar" size={20} /><span><b>Your day is clear</b><small>No meetings are scheduled.</small></span></div>}
          </div>
        </div>
      </section>}
      {!hasCurrentWork && state.dataMode === "operational" && (
        <section
          className="home-empty-state"
          aria-labelledby="home-empty-title"
        >
          <i aria-hidden="true">
            <SvgIcon name="check" size={24} />
          </i>
          <div>
            <p className="eyebrow">YOU’RE ALL CAUGHT UP</p>
            <h2 id="home-empty-title">
              Nothing needs your attention right now.
            </h2>
            <p>
              Your next meetings, assigned tasks, approvals and company updates
              will appear here automatically.
            </p>
          </div>
          <div className="home-empty-actions">
            <button className="primary" onClick={() => openCreate("task")}>
              Add a task
            </button>
            <button className="secondary" onClick={() => navigate("Projects")}>
              Open projects
            </button>
          </div>
        </section>
      )}
      <div className="section-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Everything else</h2></div></div>
      <div className="dashboard-grid home-secondary-grid">
        {state.widgets
          .filter((id) => id !== "status")
          .map((id) => (
            <HomeWidget
              key={id}
              id={id}
              state={state}
              navigate={navigate}
              notify={notify}
              openCreate={openCreate}
              todayKey={todayKey}
            />
          ))}
      </div>
      {customise && (
        <Modal
          title="Customise My Day"
          eyebrow="PERSONALISE"
          close={() => setCustomise(false)}
          className="medium-modal"
        >
          <p className="modal-lead">
            Choose the cards shown on your home page and change their order.
          </p>
          <div className="widget-manager">
            {Object.entries(widgetNames).map(([id, label]) => {
              const enabled = state.widgets.includes(id);
              return (
                <div key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() =>
                        updateState((current) => ({
                          ...current,
                          widgets: enabled
                            ? current.widgets.filter((item) => item !== id)
                            : [...current.widgets, id],
                        }))
                      }
                    />{" "}
                    <b>{label}</b>
                  </label>
                  <span>
                    <button
                      disabled={!enabled || state.widgets.indexOf(id) === 0}
                      onClick={() => moveWidget(id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      disabled={
                        !enabled ||
                        state.widgets.indexOf(id) === state.widgets.length - 1
                      }
                      onClick={() => moveWidget(id, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="modal-actions">
            <button
              className="primary"
              onClick={() => {
                setCustomise(false);
                notify("Home layout saved");
              }}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HomeWidget({
  id,
  state,
  navigate,
  notify,
  openCreate,
  todayKey,
}: {
  id: string;
  state: PortalState;
  navigate: (page: string) => void;
  notify: Notify;
  openCreate: (kind?: string) => void;
  todayKey: string;
}) {
  if (id === "approvals")
    return (
      <section className="card widget span-two">
        <CardHead
          title="Approvals requiring action"
          action="Open inbox"
          onClick={() => navigate("Action inbox")}
        />
        {state.approvals
          .filter((item) => item.status === "Pending")
          .slice(0, 3)
          .map((item) => (
            <button
              className="work-row"
              key={item.id}
              onClick={() => navigate("Action inbox")}
            >
              <i className="amber">{item.type[0]}</i>
              <span>
                <b>{item.title}</b>
                <small>
                  {item.requester} · {item.requestId}
                </small>
              </span>
              <StatusPill value={item.due} />
              <strong>{item.amount}</strong>
              <em>›</em>
            </button>
          ))}
        {!state.approvals.some((item) => item.status === "Pending") && (
          <p className="widget-empty">No approvals need your decision.</p>
        )}
      </section>
    );
  if (id === "calendar") {
    const events = state.events.filter((event) => event.date === todayKey);
    return (
      <section className="card widget">
        <CardHead
          title="Today’s calendar"
          action="Open calendar"
          onClick={() => navigate("Calendar")}
        />
        {events.length ? (
          events.map((event) => (
            <button
              className="event-row"
              key={event.id}
              onClick={() => navigate("Calendar")}
            >
              <time>{event.start}</time>
              <span>
                <b>{event.title}</b>
                <small>{event.location}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="widget-empty">No meetings are scheduled today.</p>
        )}
        <button className="text-button" onClick={() => openCreate("event")}>
          ＋ Add an event
        </button>
      </section>
    );
  }
  if (id === "tasks")
    return (
      <section className="card widget">
        <CardHead
          title="My tasks"
          action="View all"
          onClick={() => navigate("Tasks")}
        />
        {state.tasks
          .filter((item) => item.status !== "Done")
          .slice(0, 3)
          .map((task) => (
            <button
              className="task-mini"
              key={task.id}
              onClick={() => navigate("Tasks")}
            >
              <i>
                <SvgIcon name="tasks" size={12} />
              </i>
              <span>
                <b>{task.title}</b>
                <small>
                  {task.due} · {task.status}
                </small>
              </span>
            </button>
          ))}
        {!state.tasks.some((item) => item.status !== "Done") && (
          <p className="widget-empty">You have no open tasks.</p>
        )}
      </section>
    );
  if (id === "news") {
    const featured = state.articles[0];
    return (
      <section className="card widget span-two news-widget">
        <div className="news-art">
          <span>{featured?.category || "NEWS"}</span>
        </div>
        <div>
          <p className="eyebrow">COMPANY NEWS</p>
          <h2>{featured?.title || "No company news yet"}</h2>
          <p>
            {featured?.summary ||
              "Published announcements and guidance will appear here."}
          </p>
          <button className="text-button" onClick={() => navigate("Knowledge")}>
            {featured ? "Read the story →" : "Open knowledge →"}
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="card widget">
      <CardHead
        title="Quick links"
        action="Manage"
        onClick={() => notify("Quick links can be managed in Admin → Content")}
      />
      <div className="quick-grid">
        {[
          ["Request time off", "Leave"],
          ["Submit an expense", "Requests"],
          ["Book a meeting", "Calendar"],
          ["IT help desk", "Requests"],
          ["Brand assets", "Documents"],
          ["Employee handbook", "Knowledge"],
        ].map((item) => (
          <button key={item[0]} onClick={() => navigate(item[1])}>
            {item[0]}
            <b>›</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function CardHead({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick: () => void;
}) {
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
  useEffect(() => {
    const record = new URLSearchParams(window.location.search).get("record");
    if (record && state.approvals.some(item => item.id === record)) {
      const routeTimer = window.setTimeout(() => setSelected(record), 0);
      return () => window.clearTimeout(routeTimer);
    }
  }, [state.approvals]);
  const items =
    filter === "All"
      ? state.approvals
      : state.approvals.filter((item) => item.status === filter);
  const decide = (id: string, status: "Approved" | "Rejected") =>
    updateState((current) => {
      const approval = current.approvals.find((item) => item.id === id);
      if (!approval) return current;
      return {
        ...current,
        approvals: current.approvals.map((item) =>
          item.id === id ? { ...item, status } : item,
        ),
        requests: current.requests.map((item) =>
          item.id === approval.requestId
            ? {
                ...item,
                status,
                tone: status === "Approved" ? "green" : "red",
                timeline: item.timeline.map((step) => ({
                  ...step,
                  complete: true,
                  time: status,
                })),
              }
            : item,
        ),
        audit: [
          {
            id: makeId("AUD"),
            actor: current.profile.name,
            action: `${status} ${approval.requestId}`,
            area: "Approvals",
            time: formatDateTime(),
          },
          ...current.audit,
        ],
      };
    });

  return (
    <div className="page">
      <PageIntro
        eyebrow="MY WORK"
        title="Action inbox"
        text="Make decisions and complete important work without switching between pages."
      />
      <div className="segmented">
        {["Pending", "Approved", "Rejected", "All"].map((value) => (
          <button
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => setFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <section className="card data-card">
        <div className="data-head approvals-head">
          <span>Request</span>
          <span>Requester</span>
          <span>Due</span>
          <span>Amount</span>
          <span>Actions</span>
        </div>
        {items.map((item) => (
          <div className="data-row approvals-row" key={item.id}>
            <button className="row-main" onClick={() => setSelected(item.id)}>
              <b>{item.title}</b>
              <small>
                {item.requestId} · {item.type}
              </small>
            </button>
            <span data-label="Requester">{item.requester}</span>
            <span className="mobile-field" data-label="Due">
              <StatusPill value={item.due} />
            </span>
            <strong data-label="Amount">{item.amount}</strong>
            <div className="row-actions">
              {item.status === "Pending" ? (
                <>
                  <button
                    className="secondary small"
                    onClick={() => {
                      decide(item.id, "Rejected");
                      notify(`${item.requestId} rejected`);
                    }}
                  >
                    Reject
                  </button>
                  <button
                    className="primary small"
                    onClick={() => {
                      decide(item.id, "Approved");
                      notify(`${item.requestId} approved`);
                    }}
                  >
                    Approve
                  </button>
                </>
              ) : (
                <StatusPill value={item.status} />
              )}
            </div>
          </div>
        ))}
      </section>
      {!items.length && (
        <EmptyState
          title="Inbox clear"
          text="There are no items in this view."
        />
      )}
      {selected && (
        <RequestDetail
          request={state.requests.find(
            (item) =>
              item.id ===
              state.approvals.find((approval) => approval.id === selected)
                ?.requestId,
          )}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TasksPage({ state, updateState, openCreate, notify }: EmployeeProps) {
  const [filter, setFilter] = useState("Open");
  useEffect(() => {
    const record = new URLSearchParams(window.location.search).get("record");
    if (!record || !state.tasks.some(task => task.id === record)) return;
    const routeTimer = window.setTimeout(() => {
      setFilter("All");
      window.setTimeout(() => document.getElementById(`task-${record}`)?.scrollIntoView({ block: "center" }), 0);
    }, 0);
    return () => window.clearTimeout(routeTimer);
  }, [state.tasks]);
  const tasks = state.tasks.filter(
    (task) =>
      filter === "All" ||
      (filter === "Open" ? task.status !== "Done" : task.status === filter),
  );
  const cycle = (id: string) =>
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id
          ? { ...task, status: task.status === "Done" ? "To do" : "Done" }
          : task,
      ),
    }));
  const removeTask = (id: string) =>
    updateState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }));

  return (
    <div className="page">
      <PageIntro
        eyebrow="FOLLOW-UPS"
        title="Tasks"
        text="Keep personal and shared work moving, including tasks created from requests and conversations."
        action={
          <button className="primary" onClick={() => openCreate("task")}>
            ＋ Add task
          </button>
        }
      />
      <div className="segmented">
        {["Open", "To do", "In progress", "Waiting", "Done", "All"].map(
          (value) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <div className="task-board">
        {tasks.map((task) => (
          <article id={`task-${task.id}`} className="card task-card" key={task.id}>
            <button
              className={`task-check ${task.status === "Done" ? "done" : ""}`}
              aria-label={`Mark ${task.title} ${task.status === "Done" ? "open" : "done"}`}
              onClick={() => {
                cycle(task.id);
                notify(
                  task.status === "Done" ? "Task reopened" : "Task completed",
                );
              }}
            >
              {task.status === "Done" ? <SvgIcon name="check" size={14} /> : ""}
            </button>
            <div>
              <b>{task.title}</b>
              <small>
                {task.source} · Owned by {task.owner}
              </small>
            </div>
            <StatusPill value={task.priority} />
            <button
              className="secondary small task-delete"
              aria-label={`Delete ${task.title}`}
              onClick={() => {
                if (!window.confirm(`Delete “${task.title}”?`)) return;
                removeTask(task.id);
                notify("Task deleted");
              }}
            >
              Delete
            </button>
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

function RequestsPage({
  state,
  updateState,
  openCreate,
  notify,
}: EmployeeProps) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const record = new URLSearchParams(window.location.search).get("record");
    if (record && state.requests.some(item => item.id === record)) {
      const routeTimer = window.setTimeout(() => setSelected(record), 0);
      return () => window.clearTimeout(routeTimer);
    }
  }, [state.requests]);
  const values =
    filter === "All"
      ? state.requests
      : state.requests.filter((item) => item.status.includes(filter));
  const duplicate = (item: RequestItem) =>
    updateState((current) => ({
      ...current,
      requests: [
        {
          ...item,
          id: makeId(item.type === "Purchase order" ? "PO" : "REQ"),
          title: `${item.title} (copy)`,
          status: "Draft",
          tone: "slate",
          created: formatDateTime(),
          timeline: item.timeline.map((step, index) => ({
            ...step,
            complete: index === 0,
            time: index === 0 ? "Draft created" : "Waiting",
          })),
        },
        ...current.requests,
      ],
    }));

  return (
    <div className="page">
      <PageIntro
        eyebrow="REQUESTS & APPROVALS"
        title="My requests"
        text="Start from a template, save drafts and follow every step through completion."
        action={
          <button className="primary" onClick={() => openCreate("request")}>
            ＋ New request
          </button>
        }
      />
      <div className="segmented">
        {[
          "All",
          "Draft",
          "Awaiting",
          "In progress",
          "Completed",
          "Approved",
        ].map((value) => (
          <button
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => setFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <section className="card data-card">
        <div className="data-head request-head">
          <span>Request</span>
          <span>Type</span>
          <span>Status</span>
          <span>Amount</span>
          <span></span>
        </div>
        {values.map((item) => (
          <button
            className="data-row request-row"
            key={item.id}
            onClick={() => setSelected(item.id)}
          >
            <span>
              <b>{item.title}</b>
              <small>
                {item.id} · {item.created}
              </small>
            </span>
            <span data-label="Type">{item.type}</span>
            <span className="mobile-field" data-label="Status">
              <StatusPill value={item.status} />
            </span>
            <strong data-label="Amount">{item.amount}</strong>
            <i>›</i>
          </button>
        ))}
      </section>
      {selected && (
        <RequestDetail
          request={state.requests.find((item) => item.id === selected)}
          close={() => setSelected(null)}
          actions={
            <>
              <button
                className="secondary"
                onClick={() => {
                  const item = state.requests.find(
                    (value) => value.id === selected,
                  );
                  if (item) {
                    duplicate(item);
                    notify("Request duplicated as a draft");
                    setSelected(null);
                  }
                }}
              >
                Duplicate as draft
              </button>
              <button
                className="primary"
                onClick={() =>
                  notify(
                    "Request comments are not connected yet; nothing was posted",
                  )
                }
              >
                Add comment
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

function RequestDetail({
  request,
  close,
  actions,
}: {
  request?: RequestItem;
  close: () => void;
  actions?: React.ReactNode;
}) {
  if (!request) return null;
  return (
    <Modal
      title={request.title}
      eyebrow={request.id}
      close={close}
      className="medium-modal"
    >
      <div className="detail-summary">
        <div>
          <small>Type</small>
          <b>{request.type}</b>
        </div>
        <div>
          <small>Status</small>
          <StatusPill value={request.status} />
        </div>
        <div>
          <small>Amount</small>
          <b>{request.amount}</b>
        </div>
        <div>
          <small>Priority</small>
          <b>{request.priority}</b>
        </div>
      </div>
      <p className="modal-lead">{request.details}</p>
      <h3>Progress</h3>
      <ol className="timeline">
        {request.timeline.map((item) => (
          <li className={item.complete ? "complete" : ""} key={item.label}>
            <i>{item.complete ? <SvgIcon name="check" size={12} /> : ""}</i>
            <span>
              <b>{item.label}</b>
              <small>
                {item.person} · {item.time}
              </small>
            </span>
          </li>
        ))}
      </ol>
      {actions && <div className="modal-actions">{actions}</div>}
    </Modal>
  );
}

function CalendarPage({
  state,
  updateState,
  openCreate,
  notify,
}: EmployeeProps) {
  const [view, setView] = useState("Agenda");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  useEffect(() => {
    const record = new URLSearchParams(window.location.search).get("record");
    const event = state.events.find(item => item.id === record);
    if (event) {
      const routeTimer = window.setTimeout(() => setSelected(event), 0);
      return () => window.clearTimeout(routeTimer);
    }
  }, [state.events]);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 650px)").matches) setView("Agenda");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const isoDate = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, index) => {
    const value = new Date(weekStart);
    value.setDate(weekStart.getDate() + index);
    return value;
  });
  const sortedEvents = [...state.events].sort((a, b) =>
    `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`),
  );
  const periodLabel =
    view === "Month"
      ? anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : `${weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${weekDays[4].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const shiftPeriod = (direction: number) =>
    setAnchor((current) => {
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
    if (!state.adminSettings.googleConnected) {
      window.location.assign("/api/auth/google/start");
      return;
    }
    setSyncing(true);
    try {
      const response = await fetch("/api/google/calendar");
      const result = (await response.json()) as {
        items?: Array<{
          id: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          location?: string;
          description?: string;
          attendees?: Array<{ email?: string }>;
          hangoutLink?: string;
          htmlLink?: string;
        }>;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Google Calendar sync failed");
      const imported = (result.items || []).map((item) => {
        const startValue = item.start?.dateTime || item.start?.date || "";
        const endValue = item.end?.dateTime || item.end?.date || startValue;
        return {
          id: `GOOGLE-${item.id}`,
          googleId: item.id,
          title: item.summary || "Untitled event",
          date: startValue.slice(0, 10),
          start: startValue.includes("T")
            ? startValue.slice(11, 16)
            : "All day",
          end: endValue.includes("T") ? endValue.slice(11, 16) : "All day",
          location: item.location || (item.hangoutLink ? "Google Meet" : ""),
          meet: Boolean(item.hangoutLink),
          guests: (item.attendees || []).flatMap((guest) =>
            guest.email ? [guest.email] : [],
          ),
          notes: item.description || "",
          webLink: item.htmlLink || item.hangoutLink,
        } as EventItem;
      });
      updateState((current) => ({
        ...current,
        events: [
          ...current.events.filter((event) => !event.googleId),
          ...imported,
        ],
      }));
      notify(`${imported.length} Google Calendar events synced`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google Calendar sync failed";
      notify(message);
      if (message.startsWith("Connect your Google"))
        window.location.assign("/api/auth/google/start");
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
        start: {
          dateTime: `${editDate}T${editStart}:00`,
          timeZone: state.profile.timezone,
        },
        end: {
          dateTime: `${editDate}T${editEnd}:00`,
          timeZone: state.profile.timezone,
        },
      };
      const response = await fetch(
        `/api/google/calendar?eventId=${encodeURIComponent(selected.googleId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok)
        return notify("Google Calendar event could not be updated");
    }
    const next = {
      ...selected,
      title: editTitle,
      date: editDate,
      start: editStart,
      end: editEnd,
    };
    updateState((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === selected.id ? next : event,
      ),
    }));
    setSelected(next);
    setEditing(false);
    notify("Calendar event updated");
  };

  const cancelEvent = async () => {
    if (
      !selected ||
      !window.confirm(
        `Cancel ${selected.title}? Guests will be notified for Google Calendar events.`,
      )
    )
      return;
    if (selected.googleId) {
      const response = await fetch(
        `/api/google/calendar?eventId=${encodeURIComponent(selected.googleId)}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        return notify("Google Calendar event could not be cancelled");
    }
    updateState((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== selected.id),
    }));
    setSelected(null);
    notify("Calendar event cancelled");
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow="GOOGLE CALENDAR"
        title="Team calendar"
        text="Plan meetings, check availability and manage Google Meet events from the portal."
        secondary={
          <button className="secondary" onClick={syncGoogle}>
            {syncing
              ? "Syncing…"
              : state.adminSettings.googleConnected
                ? "Sync Google Calendar"
                : "Connect Google Calendar"}
          </button>
        }
        action={
          <button className="primary" onClick={() => openCreate("event")}>
            ＋ Create event
          </button>
        }
      />
      <div className="calendar-toolbar">
        <div>
          <button
            className="secondary"
            aria-label="Previous period"
            onClick={() => shiftPeriod(-1)}
          >
            ‹
          </button>
          <button className="secondary" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button
            className="secondary"
            aria-label="Next period"
            onClick={() => shiftPeriod(1)}
          >
            ›
          </button>
        </div>
        <h2>{periodLabel}</h2>
        <div className="segmented compact">
          {["Week", "Month", "Agenda"].map((value) => (
            <button
              className={view === value ? "active" : ""}
              key={value}
              onClick={() => setView(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {view === "Agenda" ? (
        <section className="card agenda-list">
          {sortedEvents.map((event) => (
            <button key={event.id} onClick={() => setSelected(event)}>
              <time>
                {event.date}
                <b>{event.start}</b>
              </time>
              <span>
                <b>{event.title}</b>
                <small>
                  {event.location} · {event.guests.length} guest group
                </small>
              </span>
              <StatusPill value={event.meet ? "Google Meet" : "In person"} />
              <i>›</i>
            </button>
          ))}
        </section>
      ) : view === "Month" ? (
        <section className="card month-board">
          {sortedEvents
            .filter((event) =>
              event.date.startsWith(
                `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`,
              ),
            )
            .map((event) => (
              <button key={event.id} onClick={() => setSelected(event)}>
                <time>
                  {new Date(`${event.date}T12:00:00`).toLocaleDateString(
                    "en-GB",
                    { weekday: "short", day: "numeric", month: "short" },
                  )}
                </time>
                <span>
                  <b>{event.title}</b>
                  <small>
                    {event.start} · {event.location}
                  </small>
                </span>
                <StatusPill value={event.meet ? "Google Meet" : "In person"} />
              </button>
            ))}
        </section>
      ) : (
        <section className="card calendar-board">
          <div className="calendar-times">
            <b />
            {["09:00", "11:00", "13:00", "15:00", "17:00"].map((time) => (
              <span key={time}>{time}</span>
            ))}
          </div>
          {weekDays.map((day) => (
            <div className="calendar-day" key={isoDate(day)}>
              <b>
                {day
                  .toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                  })
                  .toUpperCase()}
              </b>
              {state.events
                .filter((event) => event.date === isoDate(day))
                .map((event) => (
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
          <p>
            Check colleagues’ Google Calendar availability before sending an
            invitation.
          </p>
        </div>
        <button className="secondary" onClick={() => openCreate("event")}>
          Find a time
        </button>
      </section>
      {selected && !editing && (
        <Modal
          title={selected.title}
          eyebrow={
            selected.googleId
              ? "GOOGLE CALENDAR EVENT"
              : "PORTAL CALENDAR EVENT"
          }
          close={() => setSelected(null)}
        >
          <dl className="detail-list">
            <div>
              <dt>Date and time</dt>
              <dd>
                {selected.date} · {selected.start}–{selected.end}
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{selected.location}</dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd>{selected.guests.join(", ") || "No guests"}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{selected.notes ? <SafeCalendarDescription value={selected.notes} /> : "No notes"}</dd>
            </div>
          </dl>
          <div className="modal-actions">
            <button className="secondary" onClick={cancelEvent}>
              Cancel event
            </button>
            <button className="secondary" onClick={beginEdit}>
              Edit
            </button>
            {selected.webLink && (
              <a
                className="primary"
                href={selected.webLink}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google
              </a>
            )}
          </div>
        </Modal>
      )}
      {selected && editing && (
        <Modal
          title="Edit calendar event"
          eyebrow={selected.googleId ? "GOOGLE CALENDAR" : "PORTAL CALENDAR"}
          close={() => setEditing(false)}
        >
          <div className="create-form">
            <label>
              Event title
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Start
                <input
                  type="time"
                  value={editStart}
                  onChange={(event) => setEditStart(event.target.value)}
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  value={editEnd}
                  onChange={(event) => setEditEnd(event.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="primary" onClick={saveEdit}>
                Save changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SafeCalendarDescription({ value }: { value: string }) {
  const descriptionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = descriptionRef.current;
    if (!container) return;
    const documentValue = new DOMParser().parseFromString(`<div>${value}</div>`, "text/html");
    const source = documentValue.body.firstElementChild;
    if (!source) { container.textContent = value; return; }
    const allowedTags = new Set(["P", "STRONG", "B", "EM", "I", "BR", "UL", "OL", "LI", "A", "BLOCKQUOTE", "CODE", "PRE"]);
    [...source.querySelectorAll("script, style, iframe, object, embed, form, input, button, svg, math")].forEach(element => element.remove());
    [...source.querySelectorAll("*")].reverse().forEach(element => {
      if (!allowedTags.has(element.tagName)) { element.replaceWith(...element.childNodes); return; }
      const href = element.tagName === "A" ? element.getAttribute("href") : null;
      [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
      if (element.tagName === "A" && href) {
        try {
          const parsed = new URL(href, window.location.origin);
          if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            element.setAttribute("href", parsed.href);
            element.setAttribute("target", "_blank");
            element.setAttribute("rel", "noreferrer noopener");
          }
        } catch { /* Invalid links remain plain formatted text. */ }
      }
    });
    container.replaceChildren(...[...source.childNodes].map(node => document.importNode(node, true)));
  }, [value]);
  return <div ref={descriptionRef} className="calendar-description" />;
}

function KnowledgePage({ state, updateState, notify }: EmployeeProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Article | null>(null);
  const categories = [
    "All",
    ...Array.from(new Set(state.articles.map((item) => item.category))),
  ];
  const articles = state.articles.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      `${item.title} ${item.summary}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const markHelpful = (id: string) =>
    updateState((current) => ({
      ...current,
      articles: current.articles.map((item) =>
        item.id === id ? { ...item, helpful: (item.helpful || 0) + 1 } : item,
      ),
    }));

  return (
    <div className="page">
      <PageIntro
        eyebrow="KNOWLEDGE"
        title="Knowledge and policies"
        text="Find trusted answers, see review dates and acknowledge important policies."
      />
      <div className="knowledge-search">
        <SvgIcon name="search" size={18} />
        <input
          aria-label="Search knowledge"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search policies, guidance and company news"
        />
      </div>
      <div className="category-row">
        {categories.map((value) => (
          <button
            className={category === value ? "active" : ""}
            key={value}
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="article-grid">
        {articles.map((article) => (
          <button
            className="card article-card"
            key={article.id}
            onClick={() => setSelected(article)}
          >
            <span>{article.category}</span>
            <h3>{article.title}</h3>
            <p>{article.summary}</p>
            <small>
              Owner: {article.owner} · Reviewed {article.reviewed}
            </small>
            <b>Read article →</b>
          </button>
        ))}
      </div>
      {selected && (
        <Modal
          title={selected.title}
          eyebrow={selected.category}
          close={() => setSelected(null)}
          className="medium-modal"
        >
          <p className="modal-lead">{selected.summary}</p>
          <div className="article-body">
            <h3>What you need to know</h3>
            <p>
              This company guidance brings the current process, responsibilities
              and useful links together. Contact {selected.owner} if anything is
              unclear or needs updating.
            </p>
            <h3>Owner and review</h3>
            <p>
              Owned by {selected.owner}. Last reviewed {selected.reviewed}.
            </p>
          </div>
          {selected.acknowledgement && (
            <label className="acknowledge">
              <input
                type="checkbox"
                onChange={(event) =>
                  event.target.checked &&
                  notify("Policy acknowledgement recorded")
                }
              />{" "}
              I have read and understood this policy
            </label>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => {
                markHelpful(selected.id);
                notify("Thanks for your feedback");
              }}
            >
              Helpful · {selected.helpful || 0}
            </button>
            <button
              className="primary"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                notify("Page link copied");
              }}
            >
              Copy link
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PeoplePage({ state, updateState, navigate, notify }: EmployeeProps) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [orgOpen, setOrgOpen] = useState(false);
  const [person, setPerson] = useState<string | null>(null);

  const departments = Array.from(
    new Set(state.employees.map((item) => item.department).filter(Boolean)),
  ).sort();
  const filtered = state.employees.filter(
    (item) =>
      (department === "All departments" || item.department === department) &&
      `${item.name} ${item.email} ${item.jobTitle} ${item.department} ${item.location}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = state.employees.find((item) => item.id === person);
  const initials = (employee: Employee) =>
    employee.name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "TM";

  const copyEmail = (employee: Employee) => {
    navigator.clipboard?.writeText(employee.email);
    notify(`Copied ${employee.email} to clipboard`);
  };

  const startChat = (employee: Employee) => {
    updateState((current) => {
      const existing = current.conversations.find(
        (conversation) =>
          conversation.type === "Direct" &&
          conversation.members.includes(employee.email),
      );
      if (existing) return current;
      return {
        ...current,
        conversations: [
          {
            id: makeId("CHAT"),
            name: employee.name,
            type: "Direct",
            members: [current.profile.email, employee.email],
            unread: 0,
            messages: [],
          },
          ...current.conversations,
        ],
      };
    });
    navigate("Chat");
    notify(`Direct conversation ready with ${employee.name}`);
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow="PEOPLE"
        title="Employee directory"
        text="Find the right person by role, department, skills or language."
        action={
          <button className="secondary" onClick={() => setOrgOpen(true)}>
            View organisation chart
          </button>
        }
      />
      <div className="toolbar">
        <input
          aria-label="Search employees"
          placeholder="Search names, skills, roles or languages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          {["All departments", ...departments].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <span>
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
        </span>
      </div>
      <div className="people-grid">
        {filtered.map((employee) => (
          <article className="card person-card" key={employee.id}>
            <button
              className="person-main"
              onClick={() => setPerson(employee.id)}
            >
              <i>{initials(employee)}</i>
              <span>
                <h3>{employee.name}</h3>
                <p>{employee.jobTitle || "Employee"}</p>
                <small>{employee.department || employee.email}</small>
              </span>
            </button>
            <div className="presence">
              <i className="ok" />
              {employee.status}
            </div>
            <p className="skills">
              <b>Company account:</b> {employee.email}
            </p>
            <div className="person-actions">
              <button
                className="secondary"
                title="Copy email address"
                onClick={() => copyEmail(employee)}
              >
                Copy email
              </button>
              <button className="primary" onClick={() => startChat(employee)}>
                Chat
              </button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          title="No employees found"
          text={
            state.employees.length
              ? "Try a different name or department."
              : "Employees will appear here automatically after their first Google Workspace sign-in."
          }
        />
      )}
      {orgOpen && (
        <Modal
          title="Take Me organisation chart"
          eyebrow="COMPANY STRUCTURE"
          close={() => setOrgOpen(false)}
          className="wide-modal"
        >
          <div className="org-chart">
            <div className="org-root">
              <b>Leadership team</b>
              <small>Take Me Group</small>
            </div>
            <div className="org-branches">
              {departments.map((name) => {
                const members = state.employees.filter(
                  (employee) => employee.department === name,
                );
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setDepartment(name);
                      setOrgOpen(false);
                    }}
                  >
                    <b>{name}</b>
                    <span>{members[0]?.name || "No manager assigned"}</span>
                    <small>
                      {members.length}{" "}
                      {members.length === 1 ? "person" : "people"}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          title={selected.name}
          eyebrow="EMPLOYEE PROFILE"
          close={() => setPerson(null)}
        >
          <div className="profile-card">
            <i>{initials(selected)}</i>
            <div>
              <h3>{selected.jobTitle || "Employee"}</h3>
              <p>
                {selected.department || "Department not set"} ·{" "}
                {selected.status}
              </p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{selected.email}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{selected.department || "Not set"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{selected.location || "Not set"}</dd>
            </div>
            <div>
              <dt>Google locale</dt>
              <dd>{selected.locale || "Not provided"}</dd>
            </div>
          </dl>
          <div className="modal-actions">
            <button className="secondary" onClick={() => copyEmail(selected)}>
              Copy email
            </button>
            <button
              className="primary"
              onClick={() => {
                setPerson(null);
                startChat(selected);
              }}
            >
              Send message
            </button>
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
  const [driveFiles, setDriveFiles] = useState<
    Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime?: string;
      webViewLink?: string;
    }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const folders = [
    "All files",
    ...Array.from(new Set(state.documents.map((item) => item.folder))),
  ];
  const documents = state.documents.filter(
    (item) =>
      (folder === "All files" || item.folder === folder) &&
      `${item.name} ${item.owner}`
        .toLowerCase()
        .includes(docQuery.toLowerCase()),
  );

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    let pendingKey = "";
    try {
      const request = await fetch("/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          size: file.size,
        }),
      });
      const direct = (await request.json()) as {
        direct?: boolean | "blob";
        uploadUrl?: string;
        key?: string;
        contentType?: string;
        error?: string;
      };
      if (!request.ok)
        throw new Error(direct.error || "Upload could not be started");
      let result: { key?: string; error?: string };
      if (direct.direct && direct.uploadUrl && direct.key) {
        pendingKey = direct.key;
        const transfer = await fetch(direct.uploadUrl, {
          method: "PUT",
          headers: { "content-type": direct.contentType || file.type },
          body: file,
        });
        if (!transfer.ok)
          throw new Error(
            "The file could not be transferred to secure storage",
          );
        const confirmation = await fetch("/api/files", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: direct.key }),
        });
        result = (await confirmation.json()) as {
          key?: string;
          error?: string;
        };
        if (!confirmation.ok)
          throw new Error(result.error || "Upload could not be confirmed");
      } else {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/files", {
          method: "POST",
          body: form,
        });
        result = (await response.json()) as { key?: string; error?: string };
        if (!response.ok) throw new Error(result.error || "Upload failed");
      }
      if (!result.key) throw new Error(result.error || "Upload failed");
      updateState((current) => ({
        ...current,
        documents: [
          {
            id: makeId("DOC"),
            name: file.name,
            type: file.type || "File",
            owner: current.profile.name,
            updated: formatDateTime(),
            folder: folder === "All files" ? "My uploads" : folder,
            size:
              file.size > 1048576
                ? `${(file.size / 1048576).toFixed(1)} MB`
                : `${Math.ceil(file.size / 1024)} KB`,
            key: result.key,
          },
          ...current.documents,
        ],
      }));
      notify(`${file.name} uploaded`);
    } catch (error) {
      if (pendingKey)
        fetch(`/api/files?key=${encodeURIComponent(pendingKey)}`, {
          method: "DELETE",
        }).catch(() => undefined);
      notify(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const browseDrive = async () => {
    if (!state.adminSettings.googleConnected) {
      window.location.assign("/api/auth/google/start");
      return;
    }
    setDriveOpen(true);
    setDriveLoading(true);
    try {
      const response = await fetch("/api/google/drive");
      const result = (await response.json()) as {
        files?: Array<{
          id: string;
          name: string;
          mimeType: string;
          modifiedTime?: string;
          webViewLink?: string;
        }>;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Google Drive could not be loaded");
      setDriveFiles(result.files || []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Google Drive could not be loaded";
      notify(message);
      if (message.startsWith("Connect your Google"))
        window.location.assign("/api/auth/google/start");
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
        secondary={
          <button className="secondary" onClick={browseDrive}>
            {state.adminSettings.googleConnected
              ? "Browse Google Drive"
              : "Connect Google Drive"}
          </button>
        }
        action={
          <>
            <input
              ref={inputRef}
              hidden
              type="file"
              onChange={(event) => upload(event.target.files?.[0])}
            />
            <button
              className="primary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "＋ Upload file"}
            </button>
          </>
        }
      />
      <div className="folder-tabs">
        {folders.map((value) => (
          <button
            className={folder === value ? "active" : ""}
            key={value}
            onClick={() => setFolder(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="knowledge-search" style={{ marginBottom: 16 }}>
        <SvgIcon name="search" size={16} />
        <input
          aria-label="Search documents"
          value={docQuery}
          onChange={(event) => setDocQuery(event.target.value)}
          placeholder="Filter documents by name or owner…"
        />
      </div>
      <section className="card data-card">
        <div className="data-head document-head">
          <span>Name</span>
          <span>Folder</span>
          <span>Owner</span>
          <span>Updated</span>
          <span></span>
        </div>
        {documents.map((item) => {
          const content = (
            <>
              <span>
                <b>{item.name}</b>
                <small>
                  {item.type} · {item.size}
                </small>
              </span>
              <span data-label="Folder">{item.folder}</span>
              <span data-label="Owner">{item.owner}</span>
              <span data-label="Updated">{item.updated}</span>
              <i>↗</i>
            </>
          );
          return item.key ? (
            <a
              className="data-row document-row"
              key={item.id}
              href={`/api/files?key=${encodeURIComponent(item.key)}`}
            >
              {content}
            </a>
          ) : (
            <button
              className="data-row document-row"
              key={item.id}
              onClick={() =>
                notify(
                  item.drive
                    ? `${item.name} requires its Google Drive link to be configured`
                    : `${item.name} does not have a preview file attached`,
                )
              }
            >
              {content}
            </button>
          );
        })}
        {!documents.length && (
          <EmptyState
            title="No documents found"
            text="No documents match your filter or search query."
          />
        )}
      </section>
      {driveOpen && (
        <Modal
          title="Google Drive"
          eyebrow="WORKSPACE FILES"
          close={() => setDriveOpen(false)}
          className="medium-modal"
        >
          {driveLoading ? (
            <p className="modal-lead">Loading company Drive files…</p>
          ) : (
            <div className="drive-results">
              {driveFiles.map((file) => (
                <a
                  key={file.id}
                  href={file.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i>
                    <SvgIcon name="documents" size={18} />
                  </i>
                  <span>
                    <b>{file.name}</b>
                    <small>
                      {file.mimeType.replace(
                        "application/vnd.google-apps.",
                        "Google ",
                      )}{" "}
                      · {file.modifiedTime?.slice(0, 10) || "Recently updated"}
                    </small>
                  </span>
                  <em>↗</em>
                </a>
              ))}
              {!driveFiles.length && (
                <p>No matching Google Drive files were returned.</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function ChatText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s]+)/gu);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={index}>{part.slice(1, -1)}</code>;
        if (/^https?:\/\//u.test(part))
          return (
            <a key={index} href={part} target="_blank" rel="noreferrer">
              {part}
            </a>
          );
        return (
          <span key={index}>
            {part.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {line.startsWith("- ") ? `• ${line.slice(2)}` : line}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

function ChatPage({
  state,
  updateState,
  openCreate,
  notify,
  realtime,
  navigate,
}: EmployeeProps) {
  const conversations = state.conversations.filter(
    (item) => item.type === "Direct",
  );
  const [activeId, setActiveId] = useState(conversations[0]?.id || "");
  useEffect(() => {
    const record = new URLSearchParams(window.location.search).get("record");
    if (record && conversations.some(item => item.id === record)) {
      const routeTimer = window.setTimeout(() => setActiveId(record), 0);
      return () => window.clearTimeout(routeTimer);
    }
  }, [conversations]);
  const [message, setMessage] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<{
    message: ChatMessage;
    title: string;
    due: string;
    priority: string;
  } | null>(null);
  const [eventDraft, setEventDraft] = useState<{
    title: string;
    date: string;
    start: string;
    end: string;
    meet: boolean;
  } | null>(null);
  const [remoteTypingName, setRemoteTypingName] = useState("");
  const typingTimer = useRef<number | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const processedRealtimeEvents = useRef(new Set<string>());
  const active =
    conversations.find((item) => item.id === activeId) || conversations[0];
  const colleagueEmail =
    active?.members.find((email) => email !== state.profile.email) ||
    active?.members[0] ||
    "";
  const colleague = state.employees.find(
    (employee) => employee.email === colleagueEmail,
  );
  const selfEmployee = state.employees.find(
    (employee) => employee.email === state.profile.email,
  );
  const colleagueName = colleague?.name || active?.name || "Colleague";
  const activeIsUnread = Boolean(
    active?.unreadBy?.includes(state.profile.email) || active?.unread,
  );
  const online = realtime.onlineUsers.some(
    (user) => user.id === colleague?.googleId || user.name === colleagueName,
  );
  const conversationPerson = (item: (typeof conversations)[number]) => {
    const email =
      item.members.find((member) => member !== state.profile.email) ||
      item.members[0] ||
      "";
    return state.employees.find((employee) => employee.email === email);
  };
  const filteredConversations = conversations.filter((item) => {
    const person = conversationPerson(item);
    return `${person?.name || item.name} ${person?.email || ""} ${person?.jobTitle || ""} ${person?.department || ""} ${item.messages.map((value) => value.text).join(" ")}`
      .toLowerCase()
      .includes(conversationQuery.toLowerCase());
  });
  const visibleMessages =
    active?.messages.filter((item) =>
      `${item.author} ${item.text} ${(item.attachments || []).map((file) => file.name).join(" ")}`
        .toLowerCase()
        .includes(messageQuery.toLowerCase()),
    ) || [];
  const typingEvent =
    realtime.latestEvent?.type === "chat.typing" &&
    realtime.latestEvent.conversationId === active?.id &&
    Boolean(realtime.latestEvent.actor?.email) &&
    active.members.some(
      (email) => email.toLowerCase() === realtime.latestEvent?.actor?.email?.toLowerCase(),
    )
      ? realtime.latestEvent
      : null;
  const typingName = remoteTypingName;

  useEffect(() => {
    const showTimer = window.setTimeout(
      () =>
        setRemoteTypingName(
          typingEvent?.active ? typingEvent.actor?.name || "Someone" : "",
        ),
      0,
    );
    const expiryTimer = typingEvent?.active
      ? window.setTimeout(() => setRemoteTypingName(""), 3500)
      : null;
    return () => {
      window.clearTimeout(showTimer);
      if (expiryTimer) window.clearTimeout(expiryTimer);
    };
  }, [typingEvent?.eventId, typingEvent?.active, typingEvent?.actor?.name]);

  useEffect(() => {
    if (!active) return;
    const saved = window.localStorage.getItem(`chat-draft:${active.id}`) || "";
    const timer = window.setTimeout(() => {
      setMessage(saved);
      setReplyTo(null);
      setEditingId(null);
    }, 0);
    updateState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === active.id
          ? {
              ...conversation,
              unread: 0,
              unreadBy: (conversation.unreadBy || []).filter(
                (email) => email !== current.profile.email,
              ),
              messages: conversation.messages.map((item) =>
                (item.authorEmail || item.author) !== current.profile.email &&
                item.author !== current.profile.name &&
                !item.deletedAt
                  ? { ...item, status: "read" }
                  : item,
              ),
            }
          : conversation,
      ),
    }));
    return () => window.clearTimeout(timer);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: state.preferences.reducedMotion ? "auto" : "smooth",
    });
  }, [active?.messages.length, active?.id, state.preferences.reducedMotion]);
  useEffect(
    () => () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    },
    [],
  );

  useEffect(() => {
    for (const event of realtime.events) {
    if (!event?.eventId || processedRealtimeEvents.current.has(event.eventId)) continue;
    processedRealtimeEvents.current.add(event.eventId);
    if (processedRealtimeEvents.current.size > 200) {
      processedRealtimeEvents.current = new Set(
        Array.from(processedRealtimeEvents.current).slice(-100),
      );
    }
    const eventConversation = event.conversationId
      ? state.conversations.find((conversation) => conversation.id === event.conversationId)
      : undefined;
    const actorEmail = event.actor?.email?.toLowerCase();
    const authorizedChatEvent = Boolean(
      eventConversation &&
      actorEmail &&
      eventConversation.members.some((email) => email.toLowerCase() === actorEmail) &&
      eventConversation.members.some((email) => email.toLowerCase() === state.profile.email.toLowerCase()),
    );
    if (
      event.type === "chat.receipt" &&
      event.messageId &&
      event.conversationId &&
      event.status &&
      authorizedChatEvent
    ) {
      updateState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === event.conversationId
            ? {
                ...conversation,
                messages: conversation.messages.map((item) =>
                  item.id === event.messageId
                    ? { ...item, status: event.status }
                    : item,
                ),
              }
            : conversation,
        ),
      }));
      continue;
    }
    if (
      event.type !== "chat.message" ||
      !event.messageId ||
      !event.conversationId ||
      !eventConversation ||
      !authorizedChatEvent ||
      event.actor?.id === selfEmployee?.googleId ||
      (!selfEmployee?.googleId && event.actor?.name === state.profile.name)
    )
      continue;
    realtime.send({
      type: "chat.receipt",
      conversationId: event.conversationId,
      messageId: event.messageId,
      participants: eventConversation.members,
      status:
        document.visibilityState === "visible" &&
        event.conversationId === active?.id
          ? "read"
          : "delivered",
    });
    if (
      document.visibilityState !== "visible" &&
      state.preferences.browserNotifications &&
      Notification.permission === "granted"
    )
      new Notification(`Message from ${event.actor?.name || "a colleague"}`, {
        body: "Open Take Me Portal to read it.",
        icon: "/take-me-icon-192.png",
      });
    }
  }, [
    active?.id,
    realtime,
    state.conversations,
    state.preferences.browserNotifications,
    state.profile.email,
    state.profile.name,
    selfEmployee?.googleId,
    updateState,
  ]);

  const patchMessage = (
    id: string,
    updater: (item: ChatMessage) => ChatMessage,
  ) =>
    updateState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === active?.id
          ? {
              ...conversation,
              messages: conversation.messages.map((item) =>
                item.id === id ? updater(item) : item,
              ),
            }
          : conversation,
      ),
    }));
  const updateMessage = (value: string) => {
    setMessage(value);
    if (!active) return;
    window.localStorage.setItem(`chat-draft:${active.id}`, value);
    realtime.send({
      type: "chat.typing",
      conversationId: active.id,
      participants: active.members,
      active: Boolean(value.trim()),
    });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () =>
        realtime.send({
          type: "chat.typing",
          conversationId: active.id,
          participants: active.members,
          active: false,
        }),
      1800,
    );
  };
  const send = (attachments: ChatAttachment[] = []) => {
    const text = message.trim();
    if ((!text && !attachments.length) || !active) return;
    if (editingId) {
      patchMessage(editingId, (item) => ({
        ...item,
        text,
        editedAt: formatDateTime(),
      }));
      setEditingId(null);
      setMessage("");
      window.localStorage.removeItem(`chat-draft:${active.id}`);
      return;
    }
    const item: ChatMessage = {
      id: makeId("MSG"),
      author: state.profile.name,
      authorEmail: state.profile.email,
      initials: state.profile.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      text,
      time: formatDateTime(),
      mine: true,
      status: "sent",
      replyTo: replyTo || undefined,
      attachments,
      mentions:
        colleague &&
        text
          .toLowerCase()
          .includes(`@${colleague.name.split(" ")[0].toLowerCase()}`)
          ? [colleague.email]
          : [],
    };
    setMessage("");
    setReplyTo(null);
    setEditingId(null);
    setPendingAttachments([]);
    window.localStorage.removeItem(`chat-draft:${active.id}`);
    updateState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === active.id
          ? { ...conversation, messages: [...conversation.messages, item] }
          : conversation,
      ),
    }));
    realtime.send({
      type: "chat.message",
      conversationId: active.id,
      messageId: item.id,
      participants: active.members,
    });
    realtime.send({
      type: "chat.typing",
      conversationId: active.id,
      participants: active.members,
      active: false,
    });
  };
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const request = await fetch("/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          size: file.size,
        }),
      });
      const direct = (await request.json()) as {
        direct?: boolean | "blob";
        uploadUrl?: string;
        key?: string;
        error?: string;
      };
      if (!request.ok) throw new Error(direct.error || "Upload failed");
      let result: ChatAttachment & { error?: string };
      if (direct.direct === "blob" && direct.key) {
        await uploadPrivateBlob(direct.key, file, {
          access: "private",
          handleUploadUrl: "/api/files",
          multipart: file.size > 5 * 1024 * 1024,
        });
        const confirmation = await fetch("/api/files", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: direct.key }),
        });
        result = (await confirmation.json()) as ChatAttachment & {
          error?: string;
        };
        if (!confirmation.ok)
          throw new Error(result.error || "Upload confirmation failed");
      } else if (direct.direct && direct.uploadUrl && direct.key) {
        const uploadResponse = await fetch(direct.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!uploadResponse.ok)
          throw new Error("The file could not be transferred");
        const confirmation = await fetch("/api/files", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: direct.key }),
        });
        result = (await confirmation.json()) as ChatAttachment & {
          error?: string;
        };
        if (!confirmation.ok)
          throw new Error(result.error || "Upload confirmation failed");
      } else {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/files", {
          method: "POST",
          body: form,
        });
        result = (await response.json()) as ChatAttachment & { error?: string };
        if (!response.ok) throw new Error(result.error || "Upload failed");
      }
      if (!result.key) throw new Error("Upload failed");
      setPendingAttachments((current) => [
        ...current,
        {
          key: result.key,
          name: result.name,
          type: result.type,
          size: result.size,
        },
      ]);
      notify("Attachment ready to send");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removePendingAttachment = async (file: ChatAttachment) => {
    setPendingAttachments((current) =>
      current.filter((item) => item.key !== file.key),
    );
    const response = await fetch(
      `/api/files?key=${encodeURIComponent(file.key)}`,
      { method: "DELETE" },
    );
    if (!response.ok) notify("The attachment was removed from this message, but storage cleanup failed");
  };
  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void upload(
          new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }),
        );
      };
      recorder.start();
      setRecording(true);
    } catch (error) {
      const reason = error instanceof DOMException ? error.name : "";
      notify(
        reason === "NotAllowedError"
          ? "Microphone access is blocked. Allow it in your browser site settings, then try again."
          : reason === "NotFoundError"
            ? "No microphone was found. Connect one and try again."
            : "Voice recording could not start. Check your microphone and browser permissions.",
      );
    }
  };
  const react = (id: string, emoji: string) =>
    patchMessage(id, (item) => {
      const reactions = (item.reactions || []).map((value) => ({
        ...value,
        users: [...value.users],
      }));
      const found = reactions.find((value) => value.emoji === emoji);
      if (found)
        found.users = found.users.includes(state.profile.email)
          ? found.users.filter((user) => user !== state.profile.email)
          : [...found.users, state.profile.email];
      else reactions.push({ emoji, users: [state.profile.email] });
      return {
        ...item,
        reactions: reactions.filter((value) => value.users.length),
      };
    });
  const createTask = () => {
    if (!taskDraft) return;
    updateState((current) => ({
      ...current,
      tasks: [
        {
          id: makeId("TASK"),
          title: taskDraft.title.trim(),
          owner: current.profile.name,
          due: taskDraft.due,
          status: "To do",
          source: `Chat with ${colleagueName}`,
          priority: taskDraft.priority,
        },
        ...current.tasks,
      ],
    }));
    notify("Follow-up task created");
    setTaskDraft(null);
  };
  const createEvent = () => {
    if (!eventDraft) return;
    updateState((current) => ({
      ...current,
      events: [
        {
          id: makeId("EV"),
          title: eventDraft.title.trim(),
          date: eventDraft.date,
          start: eventDraft.start,
          end: eventDraft.end,
          location: eventDraft.meet ? "Google Meet" : "",
          meet: eventDraft.meet,
          guests: active?.members || [],
          notes: `Created from chat with ${colleagueName}`,
        },
        ...current.events,
      ],
    }));
    notify("Calendar event created");
    setEventDraft(null);
  };
  const insertFormat = (before: string, after = before) => {
    const value = `${message}${message ? " " : ""}${before}text${after}`;
    updateMessage(value);
  };

  if (!active)
    return (
      <div className="page">
        <PageIntro
          eyebrow="CHAT"
          title="Direct messages"
          text="Private conversations with employees who have signed in to the portal."
          action={
            <button
              className="primary"
              onClick={() => openCreate("conversation")}
            >
              ＋ New message
            </button>
          }
        />
        <EmptyState
          title="No messages yet"
          text="Choose an employee from the directory to start a private conversation."
          action="Message an employee"
          onAction={() => openCreate("conversation")}
        />
      </div>
    );

  return (
    <div className="page chat-page active-chat-page">
      <PageIntro
        eyebrow="CHAT"
        title="Direct messages"
        text="Searchable, realtime conversations with your colleagues."
        action={
          <div className="chat-page-actions">
            <button
              className="secondary"
              onClick={() => {
                updateState((current) => ({
                  ...current,
                  conversations: current.conversations.map((conversation) =>
                    conversation.id === active.id
                      ? {
                          ...conversation,
                          unread: activeIsUnread ? 0 : Math.max(1, conversation.unread),
                          unreadBy: activeIsUnread
                            ? (conversation.unreadBy || []).filter(
                                (email) => email !== current.profile.email,
                              )
                            : Array.from(
                                new Set([
                                  ...(conversation.unreadBy || []),
                                  current.profile.email,
                                ]),
                              ),
                        }
                      : conversation,
                  ),
                }));
                notify(
                  activeIsUnread
                    ? "Conversation marked read"
                    : "Conversation marked unread",
                );
              }}
            >
              {activeIsUnread ? "Mark read" : "Mark unread"}
            </button>
            <button
              className="primary"
              onClick={() => openCreate("conversation")}
            >
              ＋ New message
            </button>
          </div>
        }
      />
      <section
        className={`card chat-layout enhanced-chat ${mobileConversationOpen ? "mobile-conversation-open" : "mobile-conversation-list"}`}
      >
        <aside className="chat-contacts" aria-label="Direct conversations">
          <div className="chat-contacts-heading">
            <div>
              <h3>Messages</h3>
              <small>
                {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
              </small>
            </div>
            <button
              className="chat-icon-button"
              aria-label="Start a new message"
              title="New message"
              onClick={() => openCreate("conversation")}
            >
              ＋
            </button>
          </div>
          <input
            aria-label="Search conversations"
            value={conversationQuery}
            onChange={(event) => setConversationQuery(event.target.value)}
            placeholder="Search people or messages"
          />
          {filteredConversations.map((item) => {
            const person = conversationPerson(item);
            const displayName = person?.name || item.name;
            return (
            <button
              className={item.id === active.id ? "active" : ""}
              key={item.id}
              onClick={() => {
                setActiveId(item.id);
                setMobileConversationOpen(true);
              }}
            >
              <i>
                {displayName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </i>
              <span>
                {displayName}
                <small>{item.messages.at(-1)?.text || "No messages yet"}</small>
              </span>
              {(item.unreadBy?.includes(state.profile.email) || item.unread > 0) && (
                <mark>{Math.max(1, item.unread)}</mark>
              )}
            </button>
          );})}
          {!filteredConversations.length && (
            <p className="chat-list-empty">No employees or messages match your search.</p>
          )}
        </aside>
        <div
          className="conversation"
          role="region"
          aria-label={`Conversation with ${colleagueName}`}
          tabIndex={-1}
        >
          <header>
            <button
              className="chat-mobile-back"
              aria-label="Back to conversations"
              onClick={() => setMobileConversationOpen(false)}
            >
              ←
            </button>
            <button
              className="chat-person"
              onClick={() => setProfileOpen(true)}
            >
              <i className={`chat-profile-avatar ${online ? "online" : ""}`}>
                {colleagueName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </i>
              <span>
                <h2>{colleagueName}</h2>
                <p>{online ? "Online" : "Last active earlier"}</p>
              </span>
            </button>
            <div className="chat-header-actions">
              <input
                aria-label="Search this conversation"
                value={messageQuery}
                onChange={(event) => setMessageQuery(event.target.value)}
                placeholder="Search messages"
              />
              <button
                className="chat-icon-button"
                aria-label="Open conversation details"
                title="Conversation details"
                onClick={() => setDetails(true)}
              >
                ⓘ
              </button>
            </div>
          </header>
          <div
            className="messages"
            ref={messagesRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label={`Messages with ${colleagueName}`}
          >
            {visibleMessages.length ? (
              visibleMessages.map((item) => {
                const reply = active.messages.find(
                  (value) => value.id === item.replyTo,
                );
                const links = item.text.match(/https?:\/\/[^\s]+/gu) || [];
                return (
                  <article
                    className={`message ${item.author === state.profile.name ? "mine" : ""} ${item.pinned ? "pinned" : ""}`}
                    key={item.id}
                    aria-label={`${item.author}, ${item.time}${item.editedAt ? ", edited" : ""}${item.deletedAt ? ", message deleted" : item.attachments?.length ? `, ${item.attachments.length} attachment${item.attachments.length === 1 ? "" : "s"}` : ""}`}
                  >
                    <i className="message-avatar">{item.initials}</i>
                    <div>
                      {reply && (
                        <button
                          className="message-reply-preview"
                          onClick={() =>
                            document
                              .getElementById(reply.id)
                              ?.scrollIntoView({ behavior: "smooth" })
                          }
                        >
                          ↪ {reply.author}: {reply.text.slice(0, 80)}
                        </button>
                      )}
                      <p id={item.id}>
                        <b>
                          {item.author}
                          <small>
                            {item.time}
                            {item.editedAt ? " · edited" : ""}
                          </small>
                        </b>
                        {item.deletedAt ? (
                          <em>Message deleted</em>
                        ) : (
                          <ChatText text={item.text} />
                        )}
                      </p>
                      {(item.attachments || []).map((file) =>
                        file.type.startsWith("image/") ? (
                          <a
                            className="chat-image"
                            key={file.key}
                            href={`/api/files?key=${encodeURIComponent(file.key)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Image
                              unoptimized
                              width={320}
                              height={200}
                              src={`/api/files?key=${encodeURIComponent(file.key)}`}
                              alt={file.name}
                            />
                            <span>{file.name}</span>
                          </a>
                        ) : file.type.startsWith("audio/") ? (
                          <audio
                            key={file.key}
                            controls
                            src={`/api/files?key=${encodeURIComponent(file.key)}`}
                          >
                            <track
                              kind="captions"
                              srcLang="en"
                              label="Voice message"
                            />
                          </audio>
                        ) : (
                          <a
                            className="chat-file"
                            key={file.key}
                            href={`/api/files?key=${encodeURIComponent(file.key)}`}
                          >
                            <SvgIcon name="documents" size={15} />
                            <span>
                              {file.name}
                              <small>{Math.ceil(file.size / 1024)} KB</small>
                            </span>
                          </a>
                        ),
                      )}
                      {links.map((link) => (
                        <a
                          className="link-preview"
                          key={link}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <b>{new URL(link).hostname}</b>
                          <span>{link}</span>
                        </a>
                      ))}
                      {!item.deletedAt && (
                        <div className="message-actions">
                          <button onClick={() => setReplyTo(item.id)}>
                            Reply
                          </button>
                          <button
                            aria-label="React with thumbs up"
                            onClick={() => react(item.id, "👍")}
                          >
                            👍
                          </button>
                          <details className="message-more">
                            <summary aria-label="More message actions">
                              More
                            </summary>
                            <div className="message-more-menu">
                          {item.author === state.profile.name && (
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setMessage(item.text);
                              }}
                            >
                              Edit
                            </button>
                          )}
                          {item.author === state.profile.name && (
                            <button
                              onClick={() =>
                                window.confirm("Delete this message?") &&
                                patchMessage(item.id, (value) => ({
                                  ...value,
                                  text: "",
                                  deletedAt: formatDateTime(),
                                  attachments: [],
                                }))
                              }
                            >
                              Delete
                            </button>
                          )}
                          <button
                            onClick={() =>
                              patchMessage(item.id, (value) => ({
                                ...value,
                                pinned: !value.pinned,
                              }))
                            }
                          >
                            {item.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            onClick={() =>
                              patchMessage(item.id, (value) => ({
                                ...value,
                                savedBy: (value.savedBy || []).includes(
                                  state.profile.email,
                                )
                                  ? value.savedBy?.filter(
                                      (email) => email !== state.profile.email,
                                    )
                                  : [
                                      ...(value.savedBy || []),
                                      state.profile.email,
                                    ],
                              }))
                            }
                          >
                            {item.savedBy?.includes(state.profile.email)
                              ? "Unsave"
                              : "Save"}
                          </button>
                          <button
                            onClick={() =>
                              setTaskDraft({
                                message: item,
                                title:
                                  item.text.slice(0, 120) ||
                                  `Follow up with ${colleagueName}`,
                                due: localDateKey(new Date()),
                                priority: "Normal",
                              })
                            }
                          >
                            Task
                          </button>
                          {["❤️", "🎉"].map((emoji) => (
                            <button
                              key={emoji}
                              aria-label={`React with ${emoji}`}
                              onClick={() => react(item.id, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                            </div>
                          </details>
                        </div>
                      )}
                      {(item.reactions || []).length > 0 && (
                        <div className="reaction-list">
                          {item.reactions?.map((reaction) => (
                            <button
                              key={reaction.emoji}
                              title={reaction.users.join(", ")}
                              onClick={() => react(item.id, reaction.emoji)}
                            >
                              {reaction.emoji} {reaction.users.length}
                            </button>
                          ))}
                        </div>
                      )}
                      <small className="delivery-state">
                        {item.author === state.profile.name
                          ? item.status || "sent"
                          : ""}
                      </small>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="conversation-empty">
                <b>
                  {messageQuery
                    ? "No matching messages"
                    : "Start the conversation"}
                </b>
                <p>
                  {messageQuery
                    ? "Try another search."
                    : `Send the first message to ${colleagueName}.`}
                </p>
              </div>
            )}
          </div>
          <div className="composer-area">
            {typingName && (
              <p className="typing-indicator" role="status">
                <i />
                <span>{typingName} is typing…</span>
              </p>
            )}
            {replyTo && (
              <div className="composer-context">
                Replying to{" "}
                {active.messages.find((item) => item.id === replyTo)?.author}
                <button onClick={() => setReplyTo(null)}>×</button>
              </div>
            )}
            {editingId && (
              <div className="composer-context">
                Editing message
                <button
                  onClick={() => {
                    setEditingId(null);
                    setMessage("");
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {pendingAttachments.length > 0 && (
              <div className="pending-attachments" aria-label="Attachments ready to send">
                {pendingAttachments.map((file) => (
                  <span key={file.key}>
                    {file.name}
                    {file.type.startsWith("audio/") && (
                      <audio
                        controls
                        src={`/api/files?key=${encodeURIComponent(file.key)}`}
                      >
                        <track kind="captions" srcLang="en" label="Voice message preview" />
                      </audio>
                    )}
                    <button
                      aria-label={`Remove ${file.name}`}
                      onClick={() => void removePendingAttachment(file)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="format-toolbar" aria-label="Message formatting">
              <button onClick={() => insertFormat("**")}>Bold</button>
              <button onClick={() => insertFormat("`")}>Code</button>
              <button onClick={() => insertFormat("- ", "")}>List</button>
              <button onClick={() => insertFormat("https://", "")}>Link</button>
              <button
                onClick={() =>
                  updateMessage(
                    `${message}${message ? " " : ""}@${colleagueName.split(" ")[0]} `,
                  )
                }
              >
                Mention
              </button>
            </div>
            <div className="composer">
              <span className="sr-only" aria-live="polite">
                {uploading ? "Uploading attachment" : ""}
              </span>
              <textarea
                aria-label={`Message ${colleagueName}`}
                value={message}
                onChange={(event) => updateMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send(pendingAttachments);
                  }
                  if (
                    event.altKey &&
                    (event.key === "ArrowUp" || event.key === "ArrowDown")
                  ) {
                    event.preventDefault();
                    const index = conversations.findIndex(
                      (item) => item.id === active.id,
                    );
                    setActiveId(
                      conversations[
                        (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          conversations.length) %
                          conversations.length
                      ]?.id || active.id,
                    );
                  }
                }}
                placeholder={`Message ${colleagueName}`}
                aria-keyshortcuts="Enter"
                rows={1}
              />
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onChange={(event) =>
                  event.target.files?.[0] && void upload(event.target.files[0])
                }
              />
              <button
                className="secondary"
                disabled={uploading}
                aria-label="Attach a file"
                onClick={() => {
                  if (fileRef.current) fileRef.current.value = "";
                  fileRef.current?.click();
                }}
              >
                📎
              </button>
              <button
                className={`secondary ${recording ? "recording" : ""}`}
                aria-label={
                  recording ? "Stop voice recording" : "Record a voice message"
                }
                onClick={() => void toggleRecording()}
              >
                {recording ? "■" : "🎙"}
              </button>
              <button
                className="primary chat-send-button"
                aria-label={editingId ? "Save edited message" : "Send message"}
                disabled={
                  uploading ||
                  (!editingId && !message.trim() && !pendingAttachments.length)
                }
                onClick={() => send(pendingAttachments)}
              >
                {editingId ? "Save" : "➤"}
              </button>
            </div>
            <small className="composer-hint">
              Enter to send · Shift + Enter for a new line · Alt + ↑/↓ to
              switch chats · Draft saved automatically
            </small>
          </div>
        </div>
      </section>
      {details && (
        <Modal
          title={colleagueName}
          eyebrow="CONVERSATION DETAILS"
          close={() => setDetails(false)}
          className="wide-modal"
        >
          <div className="chat-detail-actions">
            <button
              className="secondary"
              onClick={() =>
                setEventDraft({
                  title: `Catch up with ${colleagueName}`,
                  date: localDateKey(new Date()),
                  start: "09:00",
                  end: "09:30",
                  meet: true,
                })
              }
            >
              Create Calendar event
            </button>
            <button className="secondary" onClick={() => navigate("People")}>
              Employee directory
            </button>
            <button
              className="secondary"
              onClick={async () => {
                if (Notification.permission === "default")
                  await Notification.requestPermission();
                notify(
                  Notification.permission === "granted"
                    ? "Browser notifications enabled"
                    : Notification.permission === "denied"
                      ? "Notifications are blocked. Allow them in your browser site settings, then try again."
                      : "Notification permission was dismissed. Try again when you are ready.",
                );
              }}
            >
              Enable notifications
            </button>
          </div>
          <h3>Pinned messages</h3>
          <div className="chat-gallery">
            {active.messages
              .filter((item) => item.pinned)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    document.getElementById(item.id)?.scrollIntoView()
                  }
                >
                  {item.text || item.attachments?.[0]?.name}
                </button>
              ))}
            {!active.messages.some((item) => item.pinned) && (
              <p>No pinned messages.</p>
            )}
          </div>
          <h3>Saved messages</h3>
          <div className="chat-gallery">
            {active.messages
              .filter((item) => item.savedBy?.includes(state.profile.email))
              .map((item) => (
                <button key={item.id}>
                  {item.text || item.attachments?.[0]?.name}
                </button>
              ))}
            {!active.messages.some((item) =>
              item.savedBy?.includes(state.profile.email),
            ) && <p>No saved messages.</p>}
          </div>
          <h3>Files and links</h3>
          <div className="chat-gallery">
            {active.messages
              .flatMap((item) => item.attachments || [])
              .map((file) => (
                <a
                  key={file.key}
                  href={`/api/files?key=${encodeURIComponent(file.key)}`}
                >
                  {file.name}
                </a>
              ))}
          </div>
        </Modal>
      )}
      {taskDraft && (
        <Modal
          title="Create follow-up task"
          eyebrow="REVIEW BEFORE CREATING"
          close={() => setTaskDraft(null)}
        >
          <div className="create-form">
            <label>
              Task title
              <input
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Due date
                <input
                  type="date"
                  value={taskDraft.due}
                  onChange={(event) =>
                    setTaskDraft((current) =>
                      current ? { ...current, due: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label>
                Priority
                <select
                  value={taskDraft.priority}
                  onChange={(event) =>
                    setTaskDraft((current) =>
                      current ? { ...current, priority: event.target.value } : current,
                    )
                  }
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </label>
            </div>
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setTaskDraft(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={!taskDraft.title.trim() || !taskDraft.due}
              onClick={createTask}
            >
              Create task
            </button>
          </div>
        </Modal>
      )}
      {eventDraft && (
        <Modal
          title="Create calendar event"
          eyebrow="REVIEW BEFORE CREATING"
          close={() => setEventDraft(null)}
        >
          <div className="create-form">
            <label>
              Event title
              <input
                value={eventDraft.title}
                onChange={(event) =>
                  setEventDraft((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
              />
            </label>
            <div className="form-grid">
              <label>Date<input type="date" value={eventDraft.date} onChange={(event) => setEventDraft((current) => current ? { ...current, date: event.target.value } : current)} /></label>
              <label>Start<input type="time" value={eventDraft.start} onChange={(event) => setEventDraft((current) => current ? { ...current, start: event.target.value } : current)} /></label>
              <label>End<input type="time" value={eventDraft.end} onChange={(event) => setEventDraft((current) => current ? { ...current, end: event.target.value } : current)} /></label>
              <label className="check-line"><input type="checkbox" checked={eventDraft.meet} onChange={(event) => setEventDraft((current) => current ? { ...current, meet: event.target.checked } : current)} /> Add Google Meet</label>
            </div>
          </div>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => setEventDraft(null)}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={
                !eventDraft.title.trim() ||
                !eventDraft.date ||
                !eventDraft.start ||
                !eventDraft.end ||
                eventDraft.end <= eventDraft.start
              }
              onClick={createEvent}
            >
              Create event
            </button>
          </div>
        </Modal>
      )}
      {profileOpen && (
        <Modal
          title={colleagueName}
          eyebrow="EMPLOYEE PROFILE"
          close={() => setProfileOpen(false)}
        >
          <dl className="detail-list">
            <div>
              <dt>Role</dt>
              <dd>{colleague?.jobTitle || "Employee"}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{colleague?.department || "Not provided"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{colleagueEmail}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{online ? "Online" : "Offline"}</dd>
            </div>
          </dl>
          <div className="modal-actions">
            <button
              className="primary"
              onClick={() => {
                setProfileOpen(false);
                navigate("People");
              }}
            >
              Open directory profile
            </button>
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

  const filteredLeave = state.leave.filter(
    (item) =>
      (leaveFilter === "All" ||
        item.type === leaveFilter ||
        item.status === leaveFilter) &&
      `${item.employee} ${item.dates}`
        .toLowerCase()
        .includes(leaveQuery.toLowerCase()),
  );
  const delegate = state.employees.find(employee => employee.email === state.profile.delegateEmail);

  return (
    <div className="page">
      <PageIntro
        eyebrow="TIME OFF"
        title="Leave & time off"
        text="Manage time away, leave balances and team holiday coverage."
        action={
          <button className="primary" onClick={() => openCreate("leave")}>
            ＋ Request leave
          </button>
        }
      />
      {state.profile.awayUntil && (
        <section className="card delegation-banner">
          <div><b>Away until {state.profile.awayUntil}</b><p>{delegate ? `${delegate.name} is covering your selected responsibilities.` : "No delegate has been selected."}</p></div>
          <StatusPill value={delegate ? "Delegated" : "Needs attention"} />
        </section>
      )}
      <div className="segmented">
        {["Leave balance & requests", "Team absence calendar"].map((value) => (
          <button
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "Leave balance & requests" && (
        <>
          <section className="card leave-meter-card">
            <div className="leave-meter-head">
              <b>Annual leave allowance</b>
              <span>Not configured</span>
            </div>
            <p className="widget-empty">
              Your People team can add a live allowance and balance through the
              leave service.
            </p>
          </section>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <input
              aria-label="Search leave requests"
              placeholder="Filter requests by name or dates…"
              value={leaveQuery}
              onChange={(event) => setLeaveQuery(event.target.value)}
            />
            <select
              aria-label="Filter type"
              value={leaveFilter}
              onChange={(event) => setLeaveFilter(event.target.value)}
            >
              {[
                "All",
                "Annual leave",
                "Work from home",
                "Sickness",
                "Approved",
                "Pending",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
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
            {filteredLeave.map((item) => (
              <div className="data-row leave-row" key={item.id}>
                <span>
                  <b>{item.employee}</b>
                  <small>{item.id}</small>
                </span>
                <span data-label="Type">{item.type}</span>
                <span data-label="Dates">{item.dates}</span>
                <strong data-label="Days">{item.days}</strong>
                <span className="mobile-field" data-label="Status">
                  <StatusPill value={item.status} />
                </span>
              </div>
            ))}
            {!filteredLeave.length && (
              <EmptyState
                title="No leave requests"
                text="No leave records match your filter criteria."
              />
            )}
          </section>
        </>
      )}
      {tab === "Team absence calendar" && (
        <section className="card absence-calendar">
          <EmptyState
            title="No team absences"
            text="Approved team leave will appear here automatically."
          />
        </section>
      )}
    </div>
  );
}
