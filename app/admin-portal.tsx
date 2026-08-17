"use client";

import { useEffect, useMemo, useState } from "react";
import { featureLabels, makeId, type AdminSettings, type FeatureKey, type PortalState } from "./portal-data";
import { Field, GoogleGLogo, Modal, PageIntro, SettingCard, StatusPill, SvgIcon, Toggle, type Notify } from "./portal-ui";
import type { UpdatePortal } from "./employee-portal";
import type { RealtimeControls } from "./use-realtime";

type AdminProps = { page: string; state: PortalState; updateState: UpdatePortal; navigate: (page: string) => void; notify: Notify; realtime: RealtimeControls };

export default function AdminPortal(props: AdminProps) {
  if (props.page === "Overview") return <AdminOverview {...props} />;
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

const setting = (updateState: UpdatePortal, key: keyof AdminSettings, value: string | boolean) => updateState(current => ({ ...current, adminSettings: { ...current.adminSettings, [key]: value } }));
const audit = (current: PortalState, action: string, area: string) => ({ ...current, audit: [{ id: makeId("AUD"), actor: current.profile.name, action, area, time: "Just now" }, ...current.audit] });

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
  const warnings = state.drivers.filter(item => !item.licence.includes("Verified")).length + state.vehicles.filter(item => item.status !== "Available").length;
  const activeFeatures = Object.values(state.features).filter(Boolean).length;

  return (
    <div className="page admin-page">
      <PageIntro eyebrow="ADMINISTRATION" title="Portal overview" text="Manage the complete Take Me employee experience, integrations and company operations." action={<button className="primary" onClick={() => navigate("Feature controls")}>Manage features</button>} />
      <div className="admin-kpis">
        {[["286", "Active employees", "+4 this month"], [String(activeFeatures), "Enabled features", `${Object.keys(state.features).length} available`], [String(pending), "Pending approvals", "2 due today"], [String(warnings), "Operations warnings", "Review required"]].map(item => (
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
              ["People and directory", "People & access", state.features.people, "286 employees", "people"],
              ["Forms and approvals", "Forms & workflows", state.features.requests, "18 forms", "requests"],
              ["Projects and boards", "Project management", state.features.projects, `${state.projectBoards.filter(board => !board.archived).length} boards`, "projects"],
              ["Google Workspace", "Integrations", state.adminSettings.googleConnected, state.adminSettings.googleConnected ? "Connected" : "Setup required", "link"],
              ["Knowledge and documents", "Content", state.features.knowledge, `${state.articles.length} articles`, "knowledge"],
              ["Chat and notifications", "Notifications", state.features.chat, `${state.conversations.length} conversations`, "chat"],
              ["Take Me operations", "Feature controls", state.features.drivers, `${warnings} warnings`, "operations"]
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
            <button onClick={() => notify("Analytics export is not connected yet; no report was generated")}>Export</button>
          </div>
          <div className="mini-chart" aria-label="Portal usage chart">
            {[42, 58, 50, 76, 68, 88, 81].map((value, index) => <i key={index} style={{ height: `${value}%` }} />)}
          </div>
          <div className="chart-legend">
            <span><b>1,842</b> visits</span>
            <span><b>74%</b> weekly active</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function PeopleAccess({ state, updateState, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  return (
    <AdminPage title="People & access" text="Control employee accounts, roles, invitations and Google directory provisioning." save={() => notify("People and access settings saved")}>
      <div className="settings-kpis">
        {[["286", "Active employees"], ["5", "Pending invitations"], ["14", "Department admins"], ["3", "Suspended accounts"]].map(item => (
          <section className="card" key={item[1]}><b>{item[0]}</b><span>{item[1]}</span></section>
        ))}
      </div>
      <div className="settings-columns">
        <SettingCard title="Account provisioning" description="Choose how employees join and leave the portal." badge="Google ready">
          <Toggle title="Google Workspace sign-in" description="Only company Google accounts can sign in." checked={state.features.directorySync} onChange={value => updateState(current => ({ ...current, features: { ...current.features, directorySync: value } }))} />
          <Toggle title="Create profiles from directory sync" description="Automatically add new employees from Workspace." checked={state.features.people} onChange={value => updateState(current => ({ ...current, features: { ...current.features, people: value } }))} />
          <Toggle title="Suspend access for leavers" description="Disable access when the Workspace account is suspended." checked={state.adminSettings.suspendLeavers} onChange={value => setting(updateState, "suspendLeavers", value)} />
          <div className="card-actions"><button className="primary" onClick={() => notify("Provisioning settings saved")}>Save provisioning</button></div>
        </SettingCard>
        <SettingCard title="Roles and permissions" description="Review what each employee group can view and manage.">
          {[["Super administrator", "3 members"], ["Department administrator", "14 members"], ["Manager", "38 members"], ["Employee", "231 members"]].map(role => (
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

function Departments({ notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  const rows = [["Operations", "Muneeb Rizwan", "74", "Leicester"], ["Customer Support", "Sofia Khan", "63", "Nottingham"], ["Marketing", "Daniel Cole", "18", "London"], ["Finance", "Priya Shah", "22", "Leicester"], ["People", "Amelia Brown", "12", "London"]];
  return (
    <AdminPage title="Departments" text="Organise teams, managers, locations and departmental ownership." save={() => notify("Department settings saved")}>
      <SettingCard title="Company structure" description="Departments control targeted content, permissions, forms and reporting." badge="12 departments">
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
    <AdminPage title="Forms & workflows" text="Build employee forms, templates and approval routes." save={() => notify("Workflow settings saved")}>
      <div className="settings-columns">
        <SettingCard title="Request forms" description="Published forms available from Quick create." badge="18 active">
          {[["Purchase order request", "3 approval steps"], ["Marketing support", "2 approval steps"], ["IT access request", "1 approval step"], ["Leave request", "Manager approval"], ["Incident report", "Operations review"]].map(form => (
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
          <div className="card-actions"><button className="primary" onClick={() => notify("Workflow defaults saved")}>Save defaults</button></div>
        </SettingCard>
      </div>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={["Form name", "Fields", "Approvers", "Reminder and escalation", "Who can submit"]} />}
    </AdminPage>
  );
}

function PurchaseOrders({ state, updateState, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  return (
    <AdminPage title="Purchase orders" text="Configure procurement rules, suppliers, thresholds and numbering." save={() => notify("Purchase order settings saved")}>
      <div className="settings-columns">
        <SettingCard title="Approval thresholds" description="Route purchase requests according to total value.">
          {[["Up to £500", "Line manager"], ["£501–£5,000", "Department head"], ["£5,001–£25,000", "Finance director"], ["Above £25,000", "Executive approval"]].map(rule => (
            <button className="setting-link" key={rule[0]} onClick={() => setEditor(rule[0])}>
              <span><b>{rule[0]}</b><small>{rule[1]}</small></span>
              <em>›</em>
            </button>
          ))}
        </SettingCard>
        <SettingCard title="Purchase order configuration" description="Company-wide procurement defaults.">
          <Field label="PO number prefix" value={state.adminSettings.poPrefix} onChange={value => setting(updateState, "poPrefix", value)} />
          <Field label="Default currency" value={state.adminSettings.defaultCurrency} onChange={value => setting(updateState, "defaultCurrency", value)} />
          <Toggle title="Require supplier quotation" description="A quotation must be attached before submission." checked={true} onChange={() => notify("Supplier quotation rule updated")} />
          <Toggle title="Check duplicate invoices" description="Compare supplier and invoice references." checked={true} onChange={() => notify("Duplicate checking updated")} />
          <div className="card-actions"><button className="primary" onClick={() => notify("PO configuration saved")}>Save configuration</button></div>
        </SettingCard>
      </div>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={["Minimum value", "Maximum value", "Approver role", "Additional finance approval"]} />}
    </AdminPage>
  );
}

function FeatureControls({ state, updateState, notify }: AdminProps) {
  const groups: [string, FeatureKey[]][] = [
    ["Everyday work", ["actionInbox", "tasks", "projects", "people", "requests", "calendar", "knowledge", "documents", "chat", "leave", "shifts"]],
    ["Take Me operations", ["drivers", "vehicles", "incidents", "handover", "serviceStatus"]],
    ["Google Workspace", ["googleCalendar", "googleDrive", "directorySync", "notifications"]],
    ["Portal experience", ["quickCreate", "commandBar", "pwa", "accessibility", "analytics"]],
  ];

  return (
    <AdminPage title="Feature controls" text="Enable or disable every portal capability and decide what appears to employees." save={() => notify("Feature controls saved")}>
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
  const cards = boards.flatMap(board => board.cards.filter(card => !card.archived));
  const archiveBoard = (id: string) => updateState(current => audit({ ...current, projectBoards: current.projectBoards.map(board => board.id === id ? { ...board, archived: true, updatedAt: "Just now" } : board) }, `Archived project board ${id}`, "Projects"));

  return (
    <AdminPage title="Project management" text="Control company boards, project permissions, automations, templates and Google connections." save={() => notify("Project management settings saved")}>
      <div className="settings-kpis">
        {[[String(boards.length), "Active boards"], [String(cards.length), "Open cards"], [String(state.projectAutomations.filter(rule => rule.enabled).length), "Active automations"], [String(state.projectTemplates.length), "Templates"]].map(item => (
          <section className="card" key={item[1]}><b>{item[0]}</b><span>{item[1]}</span></section>
        ))}
      </div>
      <div className="settings-columns">
        <SettingCard title="Workspace governance" description="Choose who can create, share and remove project work.">
          <Toggle title="Allow employees to create boards" description="Employees can start blank boards or use approved templates." checked={state.adminSettings.projectWorkspaceCreation} onChange={value => setting(updateState, "projectWorkspaceCreation", value)} />
          <Toggle title="Allow external guests" description="Board administrators can invite people outside takeme.taxi." checked={state.adminSettings.projectGuests} onChange={value => setting(updateState, "projectGuests", value)} />
          <Toggle title="Allow permanent card deletion" description="When disabled, cards can only be archived and restored." checked={state.adminSettings.projectCardDelete} onChange={value => setting(updateState, "projectCardDelete", value)} />
          <label className="field">Default board visibility<select value={state.adminSettings.projectDefaultVisibility} onChange={event => setting(updateState, "projectDefaultVisibility", event.target.value)}><option>Private</option><option>Workspace</option><option>Public</option></select></label>
        </SettingCard>
        <SettingCard title="Project integrations" description="Connect deadlines and files to the Google tools already used by the company.">
          <Toggle title="Project automation" description="Allow rules to update cards when work moves between lists." checked={state.adminSettings.projectAutomation} onChange={value => setting(updateState, "projectAutomation", value)} />
          <Toggle title="Google Calendar deadlines" description="Create and update calendar events from project cards." checked={state.adminSettings.projectGoogleCalendar} onChange={value => setting(updateState, "projectGoogleCalendar", value)} />
          <Toggle title="Google Drive attachments" description="Attach Drive files and connect a folder to each board." checked={state.adminSettings.projectGoogleDrive} onChange={value => setting(updateState, "projectGoogleDrive", value)} />
          <div className="card-actions"><button className="secondary" onClick={() => navigate("Integrations")}>Configure Google Workspace</button></div>
        </SettingCard>
      </div>
      <SettingCard title="Automation rules" description="Review every enabled project rule and pause it instantly." badge={`${state.projectAutomations.length} rules`}>
        {state.projectAutomations.map(rule => (
          <Toggle key={rule.id} title={rule.name} description={`${rule.trigger} → ${rule.action} · ${rule.runs} runs`} checked={rule.enabled} onChange={value => updateState(current => ({ ...current, projectAutomations: current.projectAutomations.map(item => item.id === rule.id ? { ...item, enabled: value } : item) }))} />
        ))}
      </SettingCard>
      <SettingCard title="Company boards" description="Review active workspaces and archive boards that are no longer used." badge={`${boards.length} active`}>
        <div className="admin-table">
          <div className="table-head">
            <span>Board</span>
            <span>Visibility</span>
            <span>Cards</span>
            <span>Updated</span>
            <span></span>
          </div>
          {boards.map(board => (
            <div className="table-row" key={board.id}>
              <b>{board.title}</b>
              <span data-label="Visibility">{board.visibility}</span>
              <span data-label="Cards">{board.cards.filter(card => !card.archived).length}</span>
              <span data-label="Updated">{board.updatedAt}</span>
              <button className="text-button" onClick={() => archiveBoard(board.id)}>Archive</button>
            </div>
          ))}
        </div>
      </SettingCard>
    </AdminPage>
  );
}

function ContentSettings({ state, updateState, notify }: AdminProps) {
  const [editor, setEditor] = useState("");
  return (
    <AdminPage title="Content management" text="Control news, knowledge, policies, document ownership and publishing." save={() => notify("Content settings saved")}>
      <div className="settings-columns">
        <SettingCard title="Publishing controls" description="Quality and governance for company content.">
          <Toggle title="Require review before publishing" description="News, policies and knowledge need approval." checked={state.adminSettings.contentReview} onChange={value => setting(updateState, "contentReview", value)} />
          <Toggle title="Content expiry reminders" description="Notify owners before the review date." checked={true} onChange={() => notify("Expiry reminder updated")} />
          <Toggle title="Mandatory policy acknowledgement" description="Allow owners to require employee confirmation." checked={state.adminSettings.policyAcknowledgement} onChange={value => setting(updateState, "policyAcknowledgement", value)} />
          <div className="card-actions"><button className="primary" onClick={() => notify("Publishing controls saved")}>Save controls</button></div>
        </SettingCard>
        <SettingCard title="Content areas" description="Manage owners, quick links and publishing access.">
          {[["Company news", "24 published"], ["Knowledge base", `${state.articles.length} articles`], ["Policies", "38 active"], ["Document library", `${state.documents.length} files`], ["Home quick links", "6 links"]].map(area => (
            <button className="setting-link" key={area[0]} onClick={() => setEditor(area[0])}>
              <span><b>{area[0]}</b><small>{area[1]}</small></span>
              <em>›</em>
            </button>
          ))}
        </SettingCard>
      </div>
      {editor && <AdminEditor title={editor} close={() => setEditor("")} notify={notify} fields={["Area owner", "Publishing roles", "Review frequency", "Audience"]} />}
    </AdminPage>
  );
}

function NotificationSettings({ state, updateState, notify }: AdminProps) {
  return (
    <AdminPage title="Notifications" text="Control portal, email, browser and Google Chat messages." save={() => notify("Notification settings saved")}>
      <div className="settings-columns">
        <SettingCard title="Employee notifications" description="Company defaults employees can personalise.">
          <Toggle title="Desktop notifications" description="Show important updates while the portal is open." checked={state.adminSettings.desktopNotifications} onChange={value => setting(updateState, "desktopNotifications", value)} />
          <Toggle title="Daily approval digest" description="Send managers a daily approval summary." checked={state.adminSettings.dailyDigest} onChange={value => setting(updateState, "dailyDigest", value)} />
          <Toggle title="Weekly company digest" description="Combine news, events and recognition." checked={state.preferences.weeklyDigest} onChange={value => updateState(current => ({ ...current, preferences: { ...current.preferences, weeklyDigest: value } }))} />
          <div className="card-actions"><button className="primary" onClick={() => notify("Employee notification defaults saved")}>Save defaults</button></div>
        </SettingCard>
        <SettingCard title="Google Chat and email" description="Send workflow and urgent operational alerts." badge={state.adminSettings.googleConnected ? "Connected" : "Setup needed"}>
          <Toggle title="Urgent Google Chat alerts" description="Post incidents and service notices to the company space." checked={state.adminSettings.urgentGoogleChat} onChange={value => setting(updateState, "urgentGoogleChat", value)} />
          <Field label="Default Google Chat space" value={state.adminSettings.chatSpace} placeholder="spaces/AAAA..." onChange={value => setting(updateState, "chatSpace", value)} />
          <div className="card-actions">
            <button className="secondary" onClick={() => notify("Google Chat delivery is not connected yet; no message was sent")}>Send test</button>
            <button className="primary" onClick={() => notify("Google Chat preferences saved; delivery still requires a connector")}>Save settings</button>
          </div>
        </SettingCard>
      </div>
    </AdminPage>
  );
}

function Integrations({ state, updateState, notify, realtime }: AdminProps) {
  const [tab, setTab] = useState("Google Workspace");
  const [connector, setConnector] = useState("");
  const [secret, setSecret] = useState("");
  const callbackAddress = "/api/auth/google/callback";
  const loginCallbackAddress = "/api/auth/google/login/callback";
  const [googleStatus, setGoogleStatus] = useState<{ configured: boolean; loginConfigured: boolean; connected: boolean; email: string; missing: string[]; missingLogin: string[] } | null>(null);
  const google = state.adminSettings;

  const loadGoogleStatus = async () => {
    const response = await fetch("/api/google/status");
    const result = await response.json() as { configured?: boolean; loginConfigured?: boolean; connected?: boolean; email?: string; missing?: string[]; missingLogin?: string[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Google status could not be checked");
    setGoogleStatus({ configured: Boolean(result.configured), loginConfigured: Boolean(result.loginConfigured), connected: Boolean(result.connected), email: result.email || "", missing: result.missing || [], missingLogin: result.missingLogin || [] });
    return result;
  };

  useEffect(() => {
    let active = true;
    fetch("/api/google/status").then(response => response.json().then(result => ({ response, result }))).then(({ response, result }: { response: Response; result: { configured?: boolean; loginConfigured?: boolean; connected?: boolean; email?: string; missing?: string[]; missingLogin?: string[] } }) => {
      if (active && response.ok) setGoogleStatus({ configured: Boolean(result.configured), loginConfigured: Boolean(result.loginConfigured), connected: Boolean(result.connected), email: result.email || "", missing: result.missing || [], missingLogin: result.missingLogin || [] });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const saveGoogle = async () => {
    const response = await fetch("/api/google/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: google.googleClientId, clientSecret: secret, projectId: google.googleProjectId, domain: google.companyDomain }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) return notify(result.error || "Google Workspace settings could not be saved");
    updateState(current => audit(current, "Saved encrypted Google Workspace configuration", "Integrations"));
    setSecret("");
    await loadGoogleStatus();
    notify("Google OAuth configuration saved securely");
  };

  const testGoogle = async () => {
    try {
      const result = await loadGoogleStatus();
      notify(result.configured ? (result.connected ? `Connected as ${result.email}` : "Secure OAuth settings are ready; connect your account next") : `Missing OAuth requirements: ${(result.missing || []).join(", ")}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Google status could not be checked");
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm("Disconnect your Google Calendar and Drive account from this portal?")) return;
    const response = await fetch("/api/google/status", { method: "DELETE" });
    if (!response.ok) return notify("Google account could not be disconnected");
    await loadGoogleStatus();
    notify("Your Google account was disconnected");
  };

  return (
    <div className="page admin-page">
      <PageIntro eyebrow="ADMIN SETTINGS" title="Integrations" text="Connect Google Workspace and the business systems your teams use." />
      <div className="segmented admin-tabs">
        {["Google Workspace", "Communication", "Business tools", "API & webhooks"].map(value => <button className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{value}</button>)}
      </div>
      {tab === "Google Workspace" && (
        <>
          <section className="card google-card">
            <header>
              <i className="google-mark"><GoogleGLogo size={24} /></i>
              <div>
                <h2>Google Workspace</h2>
                <p>Each employee connects their own Calendar and Drive account; credentials are never shared between users.</p>
              </div>
              <StatusPill value={googleStatus?.connected ? "Connected" : googleStatus?.configured ? "Ready to connect" : "Setup required"} />
            </header>
            <div className="google-config">
              <h3>OAuth configuration</h3>
              <p>Use a Google Cloud web application. The Client Secret is encrypted before it is saved; the token-encryption key remains in secure Vercel environment settings.</p>
              <div className="form-grid">
                <Field label="Company Google domain" value={google.companyDomain} autoComplete="off" onChange={value => setting(updateState, "companyDomain", value)} />
                <Field label="Google Cloud project ID" value={google.googleProjectId} placeholder="take-me-team-portal" autoComplete="off" onChange={value => setting(updateState, "googleProjectId", value)} />
                <Field label="OAuth Client ID" value={google.googleClientId} placeholder="...apps.googleusercontent.com" autoComplete="off" onChange={value => setting(updateState, "googleClientId", value)} />
                <Field label="OAuth Client Secret" type="password" value={secret} placeholder="Enter or replace the encrypted secret" autoComplete="new-password" onChange={setSecret} />
              </div>
              <div className="callback-field">
                <span>Authorized redirect path (use your production domain)</span>
                <div>
                  <code>{callbackAddress}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${callbackAddress}`); notify("Full callback address copied"); }}>Copy full address</button>
                </div>
              </div>
              <div className="google-services">
                {[
                  ["Google sign-in", "Company account authentication", "directorySync"],
                  ["Calendar and Meet", "Create, edit and cancel events", "googleCalendar"],
                  ["Drive and Docs", "Browse, attach and create files", "googleDrive"],
                  ["Directory sync", "Employees, groups and profile photos", "people"],
                  ["Google Chat", "Approval and operational notifications", "notifications"]
                ].map(service => (
                  <Toggle
                    key={service[0]}
                    title={service[0]}
                    description={service[1]}
                    checked={state.features[service[2] as FeatureKey]}
                    onChange={value => updateState(current => ({ ...current, features: { ...current.features, [service[2]]: value } }))}
                  />
                ))}
              </div>
              <div className="card-actions">
                <button className="secondary" onClick={testGoogle}>Test configuration</button>
                <button className="primary" onClick={saveGoogle}>Save configuration</button>
                {googleStatus?.connected ? (
                  <button className="secondary" onClick={disconnectGoogle}>Disconnect {googleStatus.email}</button>
                ) : (
                  <button className="primary dark" disabled={googleStatus ? !googleStatus.configured : true} onClick={() => window.location.assign("/api/auth/google/start")}>Connect my Google account</button>
                )}
              </div>
              {googleStatus && !googleStatus.configured && <p className="field-help">Missing OAuth requirements: {googleStatus.missing.join(", ")}</p>}
            </div>
          </section>
          <section className="card security-note">
            <i><SvgIcon name="check" size={16} /></i>
            <div>
              <b>Per-user secure connection</b>
              <p>OAuth access and refresh tokens are encrypted and isolated by portal user. Only the matching verified @{google.companyDomain} account is accepted.</p>
            </div>
          </section>
          <section className="card security-note sign-in-setup-card">
            <i><GoogleGLogo size={20} /></i>
            <div>
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
          <SettingCard title="Google Chat" description="Portal notifications and request updates." badge="Connector required">
            <Toggle title="Approval notifications" description="Notify approvers when a request needs attention." checked={true} onChange={() => notify("The Google Chat connector is not active; this rule was not changed")} />
            <Toggle title="Urgent operational notices" description="Post important incidents and service updates." checked={google.urgentGoogleChat} onChange={value => setting(updateState, "urgentGoogleChat", value)} />
            <Field label="Default Google Chat space" value={google.chatSpace} onChange={value => setting(updateState, "chatSpace", value)} />
            <div className="card-actions"><button className="primary" onClick={() => notify("Preferences saved; Google Chat delivery still requires a connector")}>Save</button></div>
          </SettingCard>
          <SettingCard title="Email through Gmail" description="Status updates, digests and reminders.">
            <Toggle title="Daily approval summary" description="Send managers their pending decisions." checked={google.dailyDigest} onChange={value => setting(updateState, "dailyDigest", value)} />
            <Toggle title="Request status updates" description="Email employees when status changes." checked={true} onChange={() => notify("Gmail delivery is not active; this rule was not changed")} />
            <div className="card-actions">
              <button className="secondary" onClick={() => notify("Gmail delivery is not connected; no test email was sent")}>Send test</button>
              <button className="primary" onClick={() => notify("Email preferences saved; Gmail delivery still requires a connector")}>Save</button>
            </div>
          </SettingCard>
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
            <div className="card-actions"><button className="primary" onClick={() => notify("Live collaboration settings saved")}>Save collaboration settings</button></div>
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
        <div className="connector-grid">
          {[
            ["Dispatch platform", "Bookings and operational dashboards", "operations"],
            ["Accounting & expenses", "Suppliers, cost centres and expenses", "requests"],
            ["CRM", "Customer and account information", "people"],
            ["HR & payroll", "Leave balances and employee records", "leave"]
          ].map(item => (
            <section className="card connector-card" key={item[0]}>
              <i><SvgIcon name={item[2]} size={20} /></i>
              <h3>{item[0]}</h3>
              <p>{item[1]}</p>
              <StatusPill value="Not connected" />
              <button className="secondary" onClick={() => setConnector(item[0])}>Configure</button>
            </section>
          ))}
        </div>
      )}
      {tab === "API & webhooks" && <ApiSettings notify={notify} />}
      {connector && <AdminEditor title={connector} close={() => setConnector("")} notify={notify} fields={["API address", "Account or tenant ID", "Access token", "Sync frequency"]} />}
    </div>
  );
}

function ApiSettings({ notify }: { notify: Notify }) {
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState("");
  const [endpoint, setEndpoint] = useState("");

  return (
    <div className="settings-columns">
      <SettingCard title="Portal API" description="Allow approved company systems to use portal data." badge="Backend required">
        <Toggle title="Enable API access" description="Require an administrator-issued access token." checked={enabled} onChange={setEnabled} />
        {key && <div className="generated-key"><b>Preview key only</b><code>{key}</code><small>This key is not active and cannot authenticate requests.</small></div>}
        <div className="card-actions">
          <button className="secondary" onClick={() => { setKey(`tm_preview_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`); notify("Preview key generated; it is not an active credential"); }}>Generate preview</button>
          <button className="primary" onClick={() => notify("Portal API issuance is not implemented; no access was enabled")}>Save</button>
        </div>
      </SettingCard>
      <SettingCard title="Webhooks" description="Send signed updates when portal activity occurs.">
        <Field label="Webhook endpoint" value={endpoint} placeholder="https://example.com/webhooks" onChange={setEndpoint} />
        {["Request submitted", "Request approved", "Employee updated", "Calendar event changed", "Incident reported"].map((item, index) => (
          <label className="check-row" key={item}><input type="checkbox" defaultChecked={index < 2} /> {item}</label>
        ))}
        <div className="card-actions">
          <button className="secondary" onClick={() => notify("Webhook delivery is not implemented; no request was sent")}>Send test</button>
          <button className="primary" onClick={() => notify("Webhook storage is not implemented; nothing was saved")}>Save webhook</button>
        </div>
      </SettingCard>
    </div>
  );
}

function SecuritySettings({ state, updateState, notify }: AdminProps) {
  return (
    <AdminPage title="Security" text="Protect access, sessions, confidential records and administrator actions." save={() => notify("Security settings saved")}>
      <div className="settings-columns">
        <SettingCard title="Sign-in security" description="Company-wide identity and session controls.">
          <Toggle title="Require Google Workspace sign-in" description="Block personal Google accounts and external identities." checked={state.features.directorySync} onChange={value => updateState(current => ({ ...current, features: { ...current.features, directorySync: value } }))} />
          <Toggle title="Require multi-factor authentication" description="Enforce the Google Workspace MFA policy." checked={state.adminSettings.requireMfa} onChange={value => setting(updateState, "requireMfa", value)} />
          <Field label="Session timeout" value={state.adminSettings.sessionTimeout} onChange={value => setting(updateState, "sessionTimeout", value)} />
          <Toggle title="Suspend access for leavers" description="Disable portal access after Workspace suspension." checked={state.adminSettings.suspendLeavers} onChange={value => setting(updateState, "suspendLeavers", value)} />
          <div className="card-actions"><button className="primary" onClick={() => notify("Sign-in security saved")}>Save security</button></div>
        </SettingCard>
        <SettingCard title="Data governance" description="Confidential data, downloads and retention.">
          <Toggle title="Audit administrator actions" description="Record configuration and access changes." checked={true} onChange={() => notify("Audit setting updated")} />
          <Toggle title="Restrict confidential downloads" description="Allow only approved roles to download sensitive files." checked={true} onChange={() => notify("Download restriction updated")} />
          <Field label="Audit retention" value={state.adminSettings.auditRetention} onChange={value => setting(updateState, "auditRetention", value)} />
          <div className="card-actions">
            <button className="secondary" onClick={() => notify("Security report prepared")}>Download report</button>
            <button className="primary" onClick={() => notify("Governance settings saved")}>Save governance</button>
          </div>
        </SettingCard>
      </div>
    </AdminPage>
  );
}

function AuditLog({ state, notify }: AdminProps) {
  const [query, setQuery] = useState("");
  const logs = useMemo(() => state.audit.filter(item => `${item.actor} ${item.action} ${item.area}`.toLowerCase().includes(query.toLowerCase())), [query, state.audit]);
  const exportCsv = () => {
    const csv = ["Actor,Action,Area,Time", ...logs.map(item => [item.actor, item.action, item.area, item.time].map(value => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "take-me-portal-audit.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Audit log exported");
  };

  return (
    <AdminPage title="Audit log" text="Search and export important configuration and workflow changes." save={() => exportCsv()} saveLabel="Export CSV">
      <SettingCard title="Recent administrator activity" description="Security-relevant portal changes." badge={`${logs.length} events`}>
        <div className="audit-filter">
          <input aria-label="Search audit log" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search person, action or area" />
          <button className="secondary" onClick={() => setQuery("")}>Clear</button>
          <button className="secondary" onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="admin-table">
          <div className="table-head audit-head">
            <span>Administrator</span>
            <span>Action</span>
            <span>Area</span>
            <span>Time</span>
          </div>
          {logs.map(item => (
            <div className="table-row audit-row" key={item.id}>
              <b>{item.actor}</b>
              <span data-label="Action">{item.action}</span>
              <span data-label="Area">{item.area}</span>
              <span data-label="Time">{item.time}</span>
            </div>
          ))}
        </div>
      </SettingCard>
    </AdminPage>
  );
}

function AdminPage({ title, text, save, saveLabel = "Save settings", children }: { title: string; text: string; save: () => void; saveLabel?: string; children: React.ReactNode }) {
  return (
    <div className="page admin-page">
      <PageIntro eyebrow="ADMIN SETTINGS" title={title} text={text} action={<button className="primary" onClick={save}>{saveLabel}</button>} />
      {children}
    </div>
  );
}

function AdminEditor({ title, fields, close, notify }: { title: string; fields: string[]; close: () => void; notify: Notify }) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <Modal title={title} eyebrow="CONFIGURATION PREVIEW" close={close} className="medium-modal">
      <form onSubmit={event => { event.preventDefault(); notify(`${title} needs its backend connector; no configuration was saved`); close(); }}>
        {fields.map(field => (
          <Field key={field} label={field} value={values[field] || ""} placeholder={`Enter ${field.toLowerCase()}`} onChange={value => setValues(current => ({ ...current, [field]: value }))} />
        ))}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>Cancel</button>
          <button className="primary" type="submit">Validate preview</button>
        </div>
      </form>
    </Modal>
  );
}
