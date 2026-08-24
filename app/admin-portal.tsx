"use client";

import { useEffect, useMemo, useState } from "react";
import { featureLabels, formatDateTime, makeId, type AdminSettings, type FeatureKey, type PortalState } from "./portal-data";
import { Field, GoogleGLogo, Modal, PageIntro, SettingCard, StatusPill, SvgIcon, Toggle, type Notify } from "./portal-ui";
import type { UpdatePortal } from "./employee-portal";
import type { RealtimeControls } from "./use-realtime";

type AdminProps = { page: string; state: PortalState; updateState: UpdatePortal; navigate: (page: string) => void; notify: Notify; realtime: RealtimeControls };

export default function AdminPortal(props: AdminProps) {
  if (props.page === "Overview") return <AdminOverview {...props} />;
  if (props.page === "Organisation") return <AdminHub {...props} title="Organisation" text="Manage people, access and the structure of Take Me." items={[["People & access", "Employee accounts, roles and permissions", "people"], ["Departments", "Teams, reporting lines and ownership", "settings"]]} />;
  if (props.page === "Workflows") return <AdminHub {...props} title="Workflows" text="Configure how work moves through the company." items={[["Forms & workflows", "Request forms and approval rules", "requests"], ["Purchase orders", "Purchasing controls and approvals", "requests"], ["Feature controls", "Choose the modules employees can use", "projects"], ["Project management", "Templates, boards and project defaults", "projects"]]} />;
  if (props.page === "Content & communication") return <AdminHub {...props} title="Content & communication" text="Keep company information and updates clear and current." items={[["Content", "Knowledge, news and document settings", "knowledge"], ["Notifications", "Company notification defaults", "bell"]]} />;
  if (props.page === "Security & audit") return <AdminHub {...props} title="Security & audit" text="Review protection, access policy and recorded activity." items={[["Security", "Session and company access policy", "lock"], ["Audit log", "Review significant administrative activity", "documents"]]} />;
  if (props.page === "People & access") return <PeopleAccess {...props} />;
  if (props.page === "Departments") return <Departments {...props} />;
  if (props.page === "Forms & workflows") return <Workflows {...props} />;
  if (props.page === "Purchase orders") return <PurchaseOrders {...props} />;
  if (props.page === "Feature controls") return <FeatureControls {...props} />;
  if (props.page === "Project management") return <ProjectManagement {...props} />;
  if (props.page === "Content") return <ContentSettings {...props} />;
  if (props.page === "Notifications") return <NotificationSettings {...props} />;
  if (props.page === "Integrations") return <Integrations {...props} />;
  if (props.page === "Security") return <SecuritySettings {...props} />;
  return <AuditLog {...props} />;
}

function AdminHub({ title, text, items, navigate }: AdminProps & { title: string; text: string; items: string[][] }) {
  return <div className="page admin-page admin-hub-page">
    <PageIntro eyebrow="ADMINISTRATION" title={title} text={text} />
    <div className="admin-hub-grid">
      {items.map(([name, description, icon]) => <button key={name} onClick={() => navigate(name)}>
        <i><SvgIcon name={icon} size={22} /></i><span><b>{name}</b><small>{description}</small></span><em>Open →</em>
      </button>)}
    </div>
  </div>;
}

const setting = (updateState: UpdatePortal, key: keyof AdminSettings, value: string | boolean) => updateState(current => ({ ...current, adminSettings: { ...current.adminSettings, [key]: value } }));
const audit = (current: PortalState, action: string, area: string) => ({ ...current, audit: [{ id: makeId("AUD"), actor: current.profile.name, action, area, time: formatDateTime() }, ...current.audit] });

function AdminOverview({ state, navigate, notify }: AdminProps) {
  const [health, setHealth] = useState<{ database: string; fileStorage: string; googleWorkspace: string; realtime: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const runHealthCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/health");
      const result = await response.json() as { checks?: { database: string; fileStorage: string; googleWorkspace: string; realtime: string }; error?: string };
      if (!result.checks) throw new Error(result.error || "Health check failed");
      setHealth(result.checks);
      notify(response.ok ? "Portal health check passed" : "Portal health check found an issue");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Health check failed");
    } finally {
      setChecking(false);
    }
  };
  const pending = state.approvals.filter(item => item.status === "Pending").length;
  const dueTasks = state.tasks.filter(item => item.status !== "Done").length;
  const activeFeatures = Object.values(state.features).filter(Boolean).length;

  return (
    <div className="page admin-page">
      <PageIntro eyebrow="ADMINISTRATION" title="Portal overview" text="Manage the complete Take Me employee experience, integrations and company workspaces." action={<button className="primary" onClick={() => navigate("Feature controls")}>Manage features</button>} />
      <div className="admin-kpis">
        {[[String(state.employees.length), "Employee directory", "Verified Google sign-ins"], [String(activeFeatures), "Enabled features", `${Object.keys(state.features).length} available`], [String(pending), "Pending approvals", "Current workspace"], [String(dueTasks), "Open tasks", "Current workspace"]].map(item => (
          <section className="card" key={item[1]}>
            <span>{item[1]}</span>
            <b>{item[0]}</b>
            <small>{item[2]}</small>
          </section>
        ))}
      </div>
      <div className="admin-dashboard">
        <section className="card span-two">
          <div className="card-head padded">
            <h3>Modules and services</h3>
            <button onClick={() => navigate("Feature controls")}>Configure all →</button>
          </div>
          <div className="module-list">
            {[
              ["People and directory", "People & access", state.features.people, `${state.employees.length} employees`, "people"],
              ["Forms and approvals", "Forms & workflows", state.features.requests, `${state.requests.length} requests`, "requests"],
              ["Projects and boards", "Project management", state.features.projects, `${state.projectBoards.filter(board => !board.archived).length} boards`, "projects"],
              ["Google Workspace", "Integrations", state.adminSettings.googleConnected, state.adminSettings.googleConnected ? "Connected" : "Setup required", "link"],
              ["Knowledge and documents", "Content", state.features.knowledge, `${state.articles.length} articles`, "knowledge"],
              ["Chat and notifications", "Notifications", state.features.chat, `${state.conversations.length} conversations`, "chat"],
              ["Leave and time off", "Feature controls", state.features.leave, "Balances and requests", "leave"]
            ].map(item => (
              <button key={String(item[0])} onClick={() => navigate(String(item[1]))}>
                <i><SvgIcon name={String(item[4])} size={18} /></i>
                <span><b>{String(item[0])}</b><small>{String(item[3])}</small></span>
                <StatusPill value={item[2] ? "Active" : "Setup needed"} />
                <em>Configure</em>
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h3>Portal health</h3>
            <button disabled={checking} onClick={runHealthCheck}>{checking ? "Checking…" : "Run check"}</button>
          </div>
          {[
            ["Database", health?.database || "Not checked"],
            ["File storage", health?.fileStorage || "Not checked"],
            ["Google Workspace", health?.googleWorkspace || "Not checked"],
            ["Live updates", health?.realtime || "Not checked"],
            ["Last automatic save", "Up to date"]
          ].map(item => (
            <div className="health-row" key={item[0]}>
              <span>{item[0]}</span>
              <StatusPill value={item[1]} />
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head">
            <h3>Usage this month</h3>
          </div>
          <p className="prototype-note">Usage analytics is listed under Planned integrations until a provider is connected.</p>
        </section>
      </div>
    </div>
  );
}

function PeopleAccess({ state, updateState, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  return (
    <AdminPage title="People & access" text="Control employee accounts, roles, invitations and Google directory provisioning." autosave>
      <div className="settings-kpis">
        {[[String(state.employees.length), "Active employees"], ["0", "Pending invitations"], ["0", "Department admins"], [String(state.employees.filter(employee => employee.status === "Suspended").length), "Suspended accounts"]].map(item => (
          <section className="card" key={item[1]}><b>{item[0]}</b><span>{item[1]}</span></section>
        ))}
      </div>
      <div className="settings-columns">
        <SettingCard title="Account provisioning" description="Choose how employees join and leave the portal." badge="Google ready">
          <Toggle title="Google Workspace sign-in" description="Only company Google accounts can sign in." checked={state.features.directorySync} onChange={value => updateState(current => ({ ...current, features: { ...current.features, directorySync: value } }))} />
          <Toggle title="Create profiles from directory sync" description="Automatically add new employees from Workspace." checked={state.features.people} onChange={value => updateState(current => ({ ...current, features: { ...current.features, people: value } }))} />
          <Toggle title="Suspend access for leavers" description="Disable access when the Workspace account is suspended." checked={state.adminSettings.suspendLeavers} onChange={value => setting(updateState, "suspendLeavers", value)} />
          <p className="autosave-note">Changes save automatically.</p>
        </SettingCard>
        <SettingCard title="Roles and permissions" description="Review what each employee group can view and manage.">
          {[["Super administrator", "Configured by access policy"], ["Department administrator", "No assignments"], ["Manager", "No assignments"], ["Employee", `${state.employees.length} members`]].map(role => (
            <button className="setting-link" key={role[0]} onClick={() => setEditor(role[0])}>
              <span><b>{role[0]}</b><small>{role[1]}</small></span>
              <em>›</em>
            </button>
          ))}
          <button className="secondary card-button" onClick={() => setEditor("Invite employees")}>＋ Invite employees</button>
        </SettingCard>
      </div>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={editor === "Invite employees" ? ["Company email addresses", "Role", "Department"] : ["Portal areas", "Allowed actions", "Department scope"]} />}
    </AdminPage>
  );
}

function Departments({ state, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  const rows = Array.from(new Set(state.employees.map(employee => employee.department).filter(Boolean))).sort().map(department => {
    const members = state.employees.filter(employee => employee.department === department);
    return [department, "Not assigned", String(members.length), members.find(employee => employee.location)?.location || "Not set"];
  });
  return (
    <AdminPage title="Departments" text="Organise teams, managers, locations and departmental ownership.">
      <SettingCard title="Company structure" description="Departments control targeted content, permissions, forms and reporting." badge={`${rows.length} departments`}>
        <div className="admin-table">
          <div className="table-head department-head">
            <span>Department</span>
            <span>Manager</span>
            <span>Employees</span>
            <span>Location</span>
            <span></span>
          </div>
          {rows.map(row => (
            <button className="table-row department-row" key={row[0]} onClick={() => setEditor(row[0])}>
              <b>{row[0]}</b>
              <span data-label="Manager">{row[1]}</span>
              <span data-label="Employees">{row[2]}</span>
              <span data-label="Location">{row[3]}</span>
              <em>›</em>
            </button>
          ))}
        </div>
        <div className="card-actions">
          <button className="secondary" onClick={() => setEditor("Locations")}>Manage locations</button>
          <button className="primary" onClick={() => setEditor("New department")}>＋ Add department</button>
        </div>
      </SettingCard>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={["Department name", "Manager", "Primary location", "Google Group"]} />}
    </AdminPage>
  );
}

function Workflows({ state, updateState, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  return (
    <AdminPage title="Forms & workflows" text="Build employee forms, templates and approval routes." autosave>
      <div className="settings-columns">
        <SettingCard title="Request forms" description="Published forms available from Quick create." badge="18 active">
          {[["Purchase order request", "3 approval steps"], ["Marketing support", "2 approval steps"], ["IT access request", "1 approval step"], ["Leave request", "Manager approval"], ["Equipment request", "IT & facilities review"]].map(form => (
            <button className="setting-link" key={form[0]} onClick={() => setEditor(form[0])}>
              <span><b>{form[0]}</b><small>{form[1]}</small></span>
              <em>›</em>
            </button>
          ))}
          <button className="primary card-button" onClick={() => setEditor("New form")}>＋ Create form</button>
        </SettingCard>
        <SettingCard title="Workflow defaults" description="Company rules for reminders, escalation and delegation.">
          <Field label="Reminder after" value={state.adminSettings.approvalReminderDays} onChange={value => setting(updateState, "approvalReminderDays", value)} />
          <Field label="Escalate after" value={state.adminSettings.approvalEscalationDays} onChange={value => setting(updateState, "approvalEscalationDays", value)} />
          <Toggle title="Allow approval delegation" description="Approvers can nominate a delegate while away." checked={state.adminSettings.approvalDelegation} onChange={value => setting(updateState, "approvalDelegation", value)} />
          <p className="autosave-note">Changes save automatically.</p>
        </SettingCard>
      </div>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={["Form name", "Fields", "Approvers", "Reminder and escalation", "Who can submit"]} />}
    </AdminPage>
  );
}

function PurchaseOrders({ state, updateState, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  return (
    <AdminPage title="Purchase orders" text="Configure procurement rules, suppliers, thresholds and numbering." autosave>
      <div className="settings-columns">
        <SettingCard title="Approval thresholds" description="Route purchase requests according to total value.">
          {[["Up to £500", "Line manager"], ["£501–£5,000", "Department head"], ["£5,001–£25,000", "Finance director"], ["Above £25,000", "Executive approval"]].map(rule => (
            <button className="setting-link" key={rule[0]} onClick={() => setEditor(rule[0])}>
              <span><b>{rule[0]}</b><small>{rule[1]}</small></span>
              <em>›</em>
            </button>
          ))}
          <button className="secondary card-button" onClick={() => setEditor("New threshold")}>＋ Add threshold</button>
        </SettingCard>
        <SettingCard title="Numbering & policy" description="Configure PO prefixes and mandatory supplier fields.">
          <Field label="PO prefix" value={state.adminSettings.poPrefix} onChange={value => setting(updateState, "poPrefix", value)} />
          <Field label="Default currency" value={state.adminSettings.defaultCurrency} onChange={value => setting(updateState, "defaultCurrency", value)} />
          <p className="prototype-note">Supplier quotation and duplicate-invoice enforcement are not active. These controls require a procurement service before they can be enabled.</p>
          <p className="autosave-note">Prefix and currency changes save automatically.</p>
        </SettingCard>
      </div>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={["Minimum value", "Maximum value", "Approver role", "Additional finance approval"]} />}
    </AdminPage>
  );
}

function FeatureControls({ state, updateState }: AdminProps) {
  const groups: [string, FeatureKey[]][] = [
    ["Everyday work", ["actionInbox", "tasks", "projects", "people", "requests", "calendar", "knowledge", "documents", "chat", "leave"]],
    ["Google Workspace", ["googleCalendar", "googleDrive", "directorySync", "notifications"]],
    ["Portal experience", ["quickCreate", "commandBar", "pwa", "accessibility", "analytics"]],
  ];

  return (
    <AdminPage title="Feature controls" text="Enable or disable every portal capability and decide what appears to employees." autosave>
      <div className="feature-groups">
        {groups.map(group => (
          <SettingCard key={group[0]} title={group[0]} description="Changes are reflected throughout the employee portal.">
            {group[1].map(key => (
              <Toggle
                key={key}
                title={featureLabels[key][0]}
                description={featureLabels[key][1]}
                checked={state.features[key]}
                onChange={value => updateState(current => audit({ ...current, features: { ...current.features, [key]: value } }, `${value ? "Enabled" : "Disabled"} ${featureLabels[key][0]}`, "Features"))}
              />
            ))}
          </SettingCard>
        ))}
      </div>
    </AdminPage>
  );
}

function ProjectManagement({ state, updateState, navigate, notify }: AdminProps) {
  const boards = state.projectBoards.filter(board => !board.archived);
  const archived = state.projectBoards.filter(board => board.archived);
  const automations = state.projectAutomations;
  const totalCards = boards.reduce((acc, board) => acc + board.cards.filter(card => !card.archived).length, 0);

  return (
    <AdminPage title="Project management" text="Oversee company boards, workspace permissions, default automations and Google integrations." autosave>
      <div className="settings-kpis">
        {[
          [String(boards.length), "Active boards"],
          [String(totalCards), "Tracked cards"],
          [String(automations.length), "Automations active"],
          [String(archived.length), "Archived boards"],
        ].map(item => (
          <section className="card" key={item[1]}>
            <b>{item[0]}</b>
            <span>{item[1]}</span>
          </section>
        ))}
      </div>

      <div className="settings-columns">
        <SettingCard title="Workspace boards" description="Open or manage any company board across all departments." badge={`${boards.length} active`}>
          {boards.map(board => (
            <div key={board.id} className="admin-board-row">
              <div>
                <b>{board.title}</b>
                <small>{board.visibility} · {board.lists.length} lists · {board.cards.filter(card => !card.archived).length} cards</small>
              </div>
              <div className="admin-board-actions">
                <button className="secondary" onClick={() => { navigate("Projects"); notify(`Opened ${board.title}`); }}>Open</button>
                <button
                  className="secondary"
                  onClick={() => {
                    updateState(current => ({
                      ...current,
                      projectBoards: current.projectBoards.map(item => item.id === board.id ? { ...item, archived: true } : item),
                    }));
                    notify(`${board.title} archived`);
                  }}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
          {archived.length > 0 && (
            <div className="archived-section">
              <h4>Archived boards</h4>
              {archived.map(board => (
                <div key={board.id} className="admin-board-row">
                  <div>
                    <b>{board.title}</b>
                    <small>Archived</small>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      updateState(current => ({
                        ...current,
                        projectBoards: current.projectBoards.map(item => item.id === board.id ? { ...item, archived: false } : item),
                      }));
                      notify(`${board.title} restored`);
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </SettingCard>

        <SettingCard title="Board defaults & permissions" description="Govern who can create boards and manage templates.">
          <Toggle
            title="Allow all employees to create boards"
            description="Employees can start project workspaces from templates."
            checked={state.adminSettings.projectWorkspaceCreation}
            onChange={value => setting(updateState, "projectWorkspaceCreation", value)}
          />
          <Toggle
            title="Enable automations"
            description="Allow rule-based card moves, auto-assignments and labels."
            checked={state.adminSettings.projectAutomation}
            onChange={value => setting(updateState, "projectAutomation", value)}
          />
          <Toggle
            title="Card permanent deletion"
            description="Allow board owners to permanently delete cards."
            checked={state.adminSettings.projectCardDelete}
            onChange={value => setting(updateState, "projectCardDelete", value)}
          />
          <Toggle
            title="Google Calendar milestone sync"
            description="Allow project due dates to sync with Google Calendar."
            checked={state.adminSettings.projectGoogleCalendar}
            onChange={value => setting(updateState, "projectGoogleCalendar", value)}
          />
          <Toggle
            title="Google Drive board folders"
            description="Automatically link Google Drive folders to project boards."
            checked={state.adminSettings.projectGoogleDrive}
            onChange={value => setting(updateState, "projectGoogleDrive", value)}
          />
          <div className="card-actions">
            <span className="autosave-note">Changes save automatically.</span>
          </div>
        </SettingCard>
      </div>
    </AdminPage>
  );
}

function ContentSettings({ state, updateState }: AdminProps) {
  return (
    <AdminPage title="Content & knowledge" text="Manage policies, company guidance, review schedules and home page highlights." autosave>
      <div className="settings-columns">
        <SettingCard title="Knowledge review governance" description="Ensure policies remain accurate with required annual reviews.">
          <Toggle title="Mandatory review workflows" description="Alert owners 30 days before review dates." checked={state.adminSettings.contentReview} onChange={value => setting(updateState, "contentReview", value)} />
          <Toggle title="Policy acknowledgements" description="Record employee acknowledgement on major policy changes." checked={state.adminSettings.policyAcknowledgement} onChange={value => setting(updateState, "policyAcknowledgement", value)} />
          <p className="autosave-note">Changes save automatically.</p>
        </SettingCard>
        <SettingCard title="Featured home story" description="Select the announcement displayed to employees on Home.">
          <p className="prototype-note">No featured story is published. Add company content before selecting a home-page highlight.</p>
        </SettingCard>
      </div>
    </AdminPage>
  );
}

function NotificationSettings({ state, updateState }: AdminProps) {
  return (
    <AdminPage title="Notification centre" text="Configure company broadcasts, channel announcements and delivery channels." autosave>
      <div className="settings-columns">
        <SettingCard title="Delivery channels" description="Where portal announcements and urgent alerts are sent.">
          <Toggle title="Portal notification panel" description="In-app alerts and counter badges." checked={state.features.notifications} onChange={value => updateState(current => ({ ...current, features: { ...current.features, notifications: value } }))} />
          <Toggle title="Daily email digest" description="Send employees their daily action summary at 08:30." checked={state.adminSettings.dailyDigest} onChange={value => setting(updateState, "dailyDigest", value)} />
          <Toggle title="Google Chat announcements" description="Post urgent company messages to Google Chat spaces." checked={state.adminSettings.urgentGoogleChat} onChange={value => setting(updateState, "urgentGoogleChat", value)} />
          <p className="autosave-note">Available channel settings save automatically.</p>
        </SettingCard>
        <PlannedIntegrations items={[["Company broadcasts", "Notification provider and delivery audit"], ["Notification analytics", "Delivery, read and action reporting"]]} />
      </div>
    </AdminPage>
  );
}

function Integrations({ state, updateState, notify, realtime }: AdminProps) {
  const [tab, setTab] = useState("Google Workspace");
  const [clientId, setClientId] = useState(state.adminSettings.googleClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; configured: boolean; loginConfigured: boolean; missing: string[]; missingLogin: string[] } | null>(null);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [googleConnectedUsers, setGoogleConnectedUsers] = useState(0);

  const google = state.adminSettings;

  useEffect(() => {
    const loadGoogleStatus = async () => {
      try {
        const response = await fetch("/api/google/status");
        const result = await response.json() as { connected: boolean; configured: boolean; loginConfigured: boolean; missing: string[]; missingLogin: string[]; connectedUsers?: number };
        setGoogleStatus(result);
        if (typeof result.connectedUsers === "number") setGoogleConnectedUsers(result.connectedUsers);
        if (result.connected !== google.googleConnected) setting(updateState, "googleConnected", result.connected);
      } catch {
        /* proceed offline/local fallback */
      }
    };
    loadGoogleStatus();
  }, [google.googleConnected, updateState]);

  const saveGoogleConfig = async () => {
    setSavingGoogle(true);
    try {
      const response = await fetch("/api/google/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyDomain: google.companyDomain,
          googleProjectId: google.googleProjectId,
          googleClientId: clientId,
          googleClientSecret: clientSecret || undefined,
        }),
      });
      const result = await response.json() as { error?: string; status?: { connected: boolean; configured: boolean; loginConfigured: boolean; missing: string[]; missingLogin: string[] } };
      if (!response.ok) throw new Error(result.error || "Google configuration could not be saved");
      updateState(current => ({
        ...current,
        adminSettings: {
          ...current.adminSettings,
          googleClientId: clientId,
          googleSecretConfigured: current.adminSettings.googleSecretConfigured || Boolean(clientSecret),
        },
      }));
      if (result.status) setGoogleStatus(result.status);
      setClientSecret("");
      notify("Google Workspace OAuth configuration saved");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Configuration failed");
    } finally {
      setSavingGoogle(false);
    }
  };

  const testGoogleConnection = async () => {
    setTestingGoogle(true);
    try {
      const response = await fetch("/api/google/status");
      const result = await response.json() as { connected: boolean; missing: string[]; connectedUsers?: number };
      if (typeof result.connectedUsers === "number") setGoogleConnectedUsers(result.connectedUsers);
      notify(result.connected ? "Google Workspace integration is operational" : `Google Workspace setup needed: ${result.missing.join(", ")}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setTestingGoogle(false);
    }
  };

  const callbackAddress = useMemo(() => "/api/auth/google/callback", []);
  const loginCallbackAddress = useMemo(() => "/api/auth/google/login/callback", []);

  return (
    <AdminPage title="Integrations" text="Connect Google Workspace and external business systems." autosave>
      <div className="segmented">{["Google Workspace", "Communication", "Business tools"].map(value => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{value}</button>)}</div>
      {tab === "Google Workspace" && (
        <>
          <div className="google-hero card">
            <div className="google-brand">
              <GoogleGLogo size={42} />
              <div>
                <p className="eyebrow">PRIMARY WORKSPACE SUITE</p>
                <h2>Google Workspace integration</h2>
                <p>Allow employees to connect their company account, manage Google Calendar and Meet events, and browse company Drive documents directly from the portal.</p>
              </div>
            </div>
            <div className="google-status-pill">
              <StatusPill value={googleStatus?.connected ? "Connected" : googleStatus?.configured ? "Ready to connect" : "Setup needed"} />
              <small>{googleConnectedUsers ? `${googleConnectedUsers} active Google connection${googleConnectedUsers === 1 ? "" : "s"}` : googleStatus?.loginConfigured ? "Login ready for employees" : "Credentials required"}</small>
            </div>
          </div>

          <div className="settings-columns">
            <SettingCard title="1. Google Cloud OAuth credentials" description="Configure the OAuth 2.0 Web application credentials from Google Cloud Console." badge={googleStatus?.configured ? "Configured" : "Credentials required"}>
              <Field label="Company domain restriction" value={google.companyDomain} placeholder="takeme.taxi" onChange={value => setting(updateState, "companyDomain", value.toLowerCase())} />
              <Field label="Google Cloud project ID" value={google.googleProjectId} placeholder="take-me-portal-prod" onChange={value => setting(updateState, "googleProjectId", value)} />
              <Field label="OAuth client ID" value={clientId} placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com" onChange={value => setClientId(value)} />
              <Field label="OAuth client secret" value={clientSecret} placeholder={google.googleSecretConfigured ? "•••••••••••••••• (saved — leave blank to keep)" : "Enter client secret"} onChange={value => setClientSecret(value)} />
              <div className="card-actions">
                <button className="primary" disabled={savingGoogle} onClick={saveGoogleConfig}>{savingGoogle ? "Saving…" : "Save credentials"}</button>
                <button className="secondary" disabled={testingGoogle} onClick={testGoogleConnection}>{testingGoogle ? "Testing…" : "Test connection"}</button>
              </div>
            </SettingCard>

            <SettingCard title="2. Authorised redirect URIs" description="Add these exact URIs into your Google Cloud Console OAuth client settings.">
              <div className="callback-field">
                <span>Google Calendar & Drive connection URI</span>
                <div>
                  <code>{callbackAddress}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${callbackAddress}`); notify("Calendar callback copied"); }}>Copy full address</button>
                </div>
              </div>
              <div className="callback-field">
                <span>Employee Google Login redirect URI</span>
                <div>
                  <code>{loginCallbackAddress}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${loginCallbackAddress}`); notify("Login callback copied"); }}>Copy full address</button>
                </div>
              </div>
              <div className="scopes-box">
                <b>Required Google Scopes</b>
                <ul>
                  <li><code>https://www.googleapis.com/auth/calendar.events</code> (Calendar & Meet)</li>
                  <li><code>https://www.googleapis.com/auth/drive.readonly</code> (Drive documents)</li>
                  <li><code>openid email profile</code> (Employee Google login)</li>
                </ul>
              </div>
              <div className="card-actions">
                <a className="primary" href="/api/auth/google/start" target="_blank" rel="noreferrer">Connect your Google account →</a>
              </div>
            </SettingCard>
          </div>

          <section className="card google-features">
            <div className="card-head padded">
              <h3>Google Workspace services enabled</h3>
              <button onClick={() => notify("Google sync schedule: real-time on page load and manual on demand")}>Sync schedule</button>
            </div>
            <div className="google-feature-grid">
              {[
                ["Google Calendar & Meet", "Create, edit and cancel events with Google Meet links", "calendar"],
                ["Google Drive & Docs", "Browse company files and attach shared resources to projects", "documents"],
                ["Google Directory sync", "Provision employee profiles automatically from Google Workspace", "people"],
                ["Google Chat", "Approval and notifications", "notifications"]
              ].map(item => (
                <div key={item[0]}>
                  <i><SvgIcon name={item[2]} size={20} /></i>
                  <b>{item[0]}</b>
                  <small>{item[1]}</small>
                  <StatusPill value={googleStatus?.connected ? "Operational" : googleStatus?.loginConfigured ? "Login ready" : "Setup needed"} />
                </div>
              ))}
            </div>
            <div className="google-login-notice">
              <b>Google-only employee login</b>
              <p>Employees enter with a verified @{google.companyDomain} Workspace account. Calendar and Drive permissions remain a separate per-user connection.</p>
              <StatusPill value={googleStatus?.loginConfigured ? "Ready" : "Setup required"} />
              <div className="callback-field">
                <span>Employee login redirect path</span>
                <div>
                  <code>{loginCallbackAddress}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${loginCallbackAddress}`); notify("Login callback address copied"); }}>Copy full address</button>
                </div>
              </div>
              <p className="field-help">The OAuth client credentials are configured above. Keep the 32+ character PORTAL_SESSION_SECRET in secure Vercel environment settings.</p>
              {googleStatus && !googleStatus.loginConfigured && <p className="field-help">Missing login requirements: {googleStatus.missingLogin.join(", ")}</p>}
              <button className="secondary" onClick={() => window.open("/?preview=login", "_blank", "noopener,noreferrer")}>Preview login screen</button>
            </div>
          </section>
        </>
      )}
      {tab === "Communication" && (
        <div className="settings-columns">
          <SettingCard title="Communication preferences" description="Prepare channel behavior before connectors are enabled.">
            <Toggle title="Urgent Google Chat notices" description="Use this preference when the Google Chat connector becomes active." checked={google.urgentGoogleChat} onChange={value => setting(updateState, "urgentGoogleChat", value)} />
            <Toggle title="Daily approval summary" description="Use this preference when the Gmail connector becomes active." checked={google.dailyDigest} onChange={value => setting(updateState, "dailyDigest", value)} />
            <Field label="Default Google Chat space" value={google.chatSpace} onChange={value => setting(updateState, "chatSpace", value)} />
          </SettingCard>
          <PlannedIntegrations items={[["Google Chat delivery", "Approval updates and urgent announcements"], ["Gmail delivery", "Digests, reminders and status updates"], ["Delivery audit", "Receipts, failures and retry history"]]} />
        </div>
      )}
      {tab === "Communication" && (
        <div className="settings-columns realtime-settings-grid">
          <SettingCard title="Live portal collaboration" description="Keep chats, project boards, approvals and shared content current without reloading." badge={realtime.status === "live" ? `${Math.max(1, realtime.onlineUsers.length)} online` : realtime.status === "syncing" ? "Auto-sync active" : realtime.status === "offline" ? "Offline" : realtime.status === "disabled" ? "Disabled" : "Connecting"}>
            <Toggle title="Automatic live updates" description="Use WebSockets when available and secure background synchronization everywhere else." checked={google.realtimeEnabled} onChange={value => setting(updateState, "realtimeEnabled", value)} />
            <Toggle title="Typing indicators" description="Show when a colleague is composing a chat message; message text is never sent as a typing event." checked={google.realtimeTyping} onChange={value => setting(updateState, "realtimeTyping", value)} />
            <Toggle title="Employee presence" description="Show connected employees and the portal area they are viewing." checked={google.realtimePresence} onChange={value => setting(updateState, "realtimePresence", value)} />
            <Field label="Background refresh interval (seconds)" value={google.realtimePollingSeconds} placeholder="3" onChange={value => setting(updateState, "realtimePollingSeconds", value.replace(/[^0-9]/g, "").slice(0, 2))} />
            <p className="field-help">Vercel uses background synchronization automatically. Forge switches to instant WebSockets when REALTIME_URL and the realtime daemon are configured.</p>
            <p className="autosave-note">Changes save automatically.</p>
          </SettingCard>
          <SettingCard title="Realtime connection" description="Current employee-session transport and deployment readiness." badge={realtime.configured ? "Gateway configured" : "Polling fallback"}>
            <div className="health-row"><span>Current transport</span><StatusPill value={realtime.status === "live" ? "WebSocket live" : realtime.status === "offline" ? "Offline" : "Background sync"} /></div>
            <div className="health-row"><span>Connected sessions</span><b>{realtime.onlineUsers.length || (realtime.status === "live" ? 1 : 0)}</b></div>
            <div className="health-row"><span>Vercel compatibility</span><StatusPill value="Active" /></div>
            <div className="health-row"><span>Forge instant gateway</span><StatusPill value={realtime.configured ? "Configured" : "Setup needed"} /></div>
            <p className="field-help">The browser never receives the gateway secret. It requests a five-minute employee token after the existing Google or temporary-admin session is verified.</p>
          </SettingCard>
        </div>
      )}
      {tab === "Business tools" && (
        <PlannedIntegrations items={[["Project tracking", "Milestones and roadmap reporting"], ["Accounting and expenses", "Suppliers, cost centres and expenses"], ["CRM", "Customer and account information"], ["HR and payroll", "Leave balances and employee records"]]} />
      )}
    </AdminPage>
  );
}

function SecuritySettings({ state, updateState }: AdminProps) {
  return (
    <AdminPage title="Security & compliance" text="Session controls, audit retention and multi-factor authentication requirements." autosave>
      <div className="settings-columns">
        <SettingCard title="Session security" description="Protect company information across employee devices.">
          <Field label="Session timeout" value={state.adminSettings.sessionTimeout} onChange={value => setting(updateState, "sessionTimeout", value)} />
          <Toggle title="Enforce multi-factor authentication (MFA)" description="Require 2FA through Google Workspace." checked={state.adminSettings.requireMfa} onChange={value => setting(updateState, "requireMfa", value)} />
          <p className="autosave-note">Changes save automatically.</p>
        </SettingCard>
        <SettingCard title="Audit and compliance" description="Track every administrator and employee action across the portal.">
          <Field label="Audit log retention" value={state.adminSettings.auditRetention} onChange={value => setting(updateState, "auditRetention", value)} />
          <p className="autosave-note">Changes save automatically.</p>
        </SettingCard>
      </div>
    </AdminPage>
  );
}

function AuditLog({ state }: AdminProps) {
  return (
    <AdminPage title="Audit log" text="A tamper-evident log of administrative changes, feature toggles and company decisions.">
      <section className="card data-card">
        <div className="card-head padded">
          <h3>Recent activity ({state.audit.length} entries)</h3>
          <span className="planned-label">Export is in Planned integrations</span>
        </div>
        <div className="data-head audit-head">
          <span>Actor</span>
          <span>Action</span>
          <span>Area</span>
          <span>Timestamp</span>
        </div>
        {state.audit.map(item => (
          <div className="data-row audit-row" key={item.id}>
            <span><b>{item.actor}</b><small>{item.id}</small></span>
            <span data-label="Action">{item.action}</span>
            <span className="mobile-field" data-label="Area"><StatusPill value={item.area} /></span>
            <span data-label="Timestamp">{item.time}</span>
          </div>
        ))}
      </section>
    </AdminPage>
  );
}

function AdminPage({ title, text, children, autosave = false }: { title: string; text: string; children: React.ReactNode; autosave?: boolean }) {
  return (
    <div className="page admin-page">
      <PageIntro eyebrow="ADMINISTRATION" title={title} text={text} action={autosave && <span className="autosave-note" role="status">Changes save automatically</span>} />
      {children}
    </div>
  );
}

function PlannedIntegrations({ items }: { items: Array<[string, string]> }) {
  return (
    <SettingCard title="Planned integrations" description="Future services are grouped here so unfinished controls do not interrupt active settings." badge={`${items.length} planned`}>
      <div className="planned-integrations-list">
        {items.map(([title, detail]) => <div key={title}><span><b>{title}</b><small>{detail}</small></span><StatusPill value="Planned" /></div>)}
      </div>
    </SettingCard>
  );
}

function AdminEditor({ title, close }: { title: string; fields: string[]; close: () => void; notify: Notify }) {
  return (
    <Modal title={title} eyebrow="CONFIGURATION" close={close} className="medium-modal">
      <div className="create-form">
        <p className="prototype-note">This configuration becomes available when its dedicated service is connected.</p>
        <div className="modal-actions"><button className="secondary" onClick={close}>Close</button></div>
      </div>
    </Modal>
  );
}
