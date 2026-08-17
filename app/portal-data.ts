export type Tone = "blue" | "green" | "amber" | "red" | "slate";

export type Profile = {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  timezone: string;
  department: string;
};

export type Preferences = {
  theme: "light" | "dark";
  textSize: "normal" | "large";
  highContrast: boolean;
  reducedMotion: boolean;
  emailNotifications: boolean;
  browserNotifications: boolean;
  weeklyDigest: boolean;
  quietHours: boolean;
  onboardingComplete: boolean;
  onboardingStep: number;
};

export type TimelineItem = { label: string; person: string; time: string; complete: boolean };
export type RequestItem = {
  id: string;
  title: string;
  type: string;
  amount: string;
  status: string;
  tone: Tone;
  requester: string;
  created: string;
  details: string;
  priority: string;
  timeline: TimelineItem[];
};
export type Approval = { id: string; requestId: string; title: string; requester: string; due: string; amount: string; status: string; type: string };
export type TaskItem = { id: string; title: string; owner: string; due: string; status: "To do" | "In progress" | "Done" | "Waiting"; source: string; priority: string };
export type EventItem = { id: string; title: string; date: string; start: string; end: string; location: string; meet: boolean; guests: string[]; notes: string; googleId?: string; webLink?: string };
export type ChatMessage = { id: string; author: string; initials: string; text: string; time: string; mine?: boolean };
export type Conversation = { id: string; name: string; type: "Channel" | "Group" | "Direct"; members: string[]; messages: ChatMessage[]; unread: number };
export type DocumentItem = { id: string; name: string; type: string; owner: string; updated: string; folder: string; size: string; key?: string; drive?: boolean };
export type Article = { id: string; title: string; category: string; summary: string; owner: string; reviewed: string; acknowledgement?: boolean; helpful?: number };
export type LeaveItem = { id: string; employee: string; type: string; dates: string; days: number; status: string };
export type ShiftItem = { id: string; date: string; time: string; team: string; location: string; status: string };
export type Driver = { id: string; name: string; licence: string; vehicle: string; status: string; expiry: string };
export type Vehicle = { id: string; registration: string; model: string; driver: string; status: string; service: string };
export type Incident = { id: string; title: string; category: string; reported: string; owner: string; status: string; confidential: boolean };
export type Handover = { id: string; shift: string; author: string; note: string; priority: string; read: boolean };
export type ServiceStatus = { id: string; name: string; status: "Operational" | "Degraded" | "Maintenance"; note: string; updated: string };
export type NotificationItem = { id: string; title: string; detail: string; group: string; time: string; read: boolean; snoozed?: boolean };
export type AuditItem = { id: string; actor: string; action: string; area: string; time: string };

export type ProjectMember = { id: string; name: string; initials: string; email: string; color: string };
export type ProjectLabel = { id: string; name: string; color: string };
export type ChecklistItem = { id: string; text: string; complete: boolean; assignee?: string; dueDate?: string };
export type ProjectChecklist = { id: string; title: string; items: ChecklistItem[] };
export type ProjectComment = { id: string; author: string; initials: string; text: string; createdAt: string; reactions?: string[] };
export type ProjectAttachment = { id: string; name: string; url: string; source: "Google Drive" | "Link" | "Portal"; addedBy: string; addedAt: string };
export type ProjectActivity = { id: string; actor: string; action: string; time: string };
export type ProjectCard = {
  id: string; title: string; description: string; listId: string; order: number; members: string[]; labels: string[];
  startDate: string; dueDate: string; dueComplete: boolean; priority: "Low" | "Normal" | "High" | "Urgent"; estimate: string;
  checklists: ProjectChecklist[]; attachments: ProjectAttachment[]; comments: ProjectComment[]; activity: ProjectActivity[];
  customFields: Record<string, string>; cover: string; watching: boolean; archived: boolean; createdBy: string; createdAt: string;
};
export type ProjectList = { id: string; title: string; order: number; color: string; limit: number; collapsed?: boolean };
export type ProjectBoard = {
  id: string; title: string; description: string; visibility: "Private" | "Workspace" | "Public"; starred: boolean; background: string;
  members: ProjectMember[]; labels: ProjectLabel[]; lists: ProjectList[]; cards: ProjectCard[]; createdAt: string; updatedAt: string;
  calendarSync: boolean; driveFolder: string; archived: boolean;
};
export type ProjectAutomation = {
  id: string; boardId: string; name: string; enabled: boolean; trigger: "Card moved" | "Due date reached" | "Card created" | "Checklist completed";
  triggerValue: string; action: "Add label" | "Assign member" | "Move card" | "Mark due complete" | "Post comment"; actionValue: string; runs: number;
};
export type ProjectTemplate = { id: string; name: string; category: string; description: string; lists: string[]; color: string };

export type FeatureKey =
  | "actionInbox" | "tasks" | "people" | "requests" | "calendar" | "knowledge" | "documents" | "chat"
  | "leave" | "shifts" | "drivers" | "vehicles" | "incidents" | "handover" | "serviceStatus"
  | "googleCalendar" | "googleDrive" | "directorySync" | "notifications" | "quickCreate" | "commandBar"
  | "pwa" | "accessibility" | "analytics" | "projects";

export type FeatureFlags = Record<FeatureKey, boolean>;

export type AdminSettings = {
  companyDomain: string;
  googleProjectId: string;
  googleClientId: string;
  googleSecretConfigured: boolean;
  googleConnected: boolean;
  calendarId: string;
  driveId: string;
  chatSpace: string;
  directoryGroup: string;
  approvalReminderDays: string;
  approvalEscalationDays: string;
  poPrefix: string;
  defaultCurrency: string;
  sessionTimeout: string;
  auditRetention: string;
  dailyDigest: boolean;
  urgentGoogleChat: boolean;
  desktopNotifications: boolean;
  requireMfa: boolean;
  suspendLeavers: boolean;
  approvalDelegation: boolean;
  contentReview: boolean;
  policyAcknowledgement: boolean;
  projectWorkspaceCreation: boolean;
  projectGuests: boolean;
  projectAutomation: boolean;
  projectCardDelete: boolean;
  projectGoogleCalendar: boolean;
  projectGoogleDrive: boolean;
  projectDefaultVisibility: string;
  realtimeEnabled: boolean;
  realtimeTyping: boolean;
  realtimePresence: boolean;
  realtimePollingSeconds: string;
};

export type PortalState = {
  profile: Profile;
  preferences: Preferences;
  features: FeatureFlags;
  adminSettings: AdminSettings;
  requests: RequestItem[];
  approvals: Approval[];
  tasks: TaskItem[];
  events: EventItem[];
  conversations: Conversation[];
  documents: DocumentItem[];
  articles: Article[];
  leave: LeaveItem[];
  shifts: ShiftItem[];
  drivers: Driver[];
  vehicles: Vehicle[];
  incidents: Incident[];
  handovers: Handover[];
  services: ServiceStatus[];
  notifications: NotificationItem[];
  audit: AuditItem[];
  projectBoards: ProjectBoard[];
  projectAutomations: ProjectAutomation[];
  projectTemplates: ProjectTemplate[];
  widgets: string[];
};

const timeline = (submitted: string, approver: string): TimelineItem[] => [
  { label: "Submitted", person: submitted, time: "13 Aug · 09:12", complete: true },
  { label: "Manager review", person: approver, time: "Waiting", complete: false },
  { label: "Final confirmation", person: "Portal workflow", time: "Waiting", complete: false },
];

export const featureLabels: Record<FeatureKey, [string, string]> = {
  actionInbox: ["Unified action inbox", "Approvals and decisions in one place"],
  tasks: ["Tasks and follow-ups", "Personal and shared task lists"],
  people: ["Employee directory", "Profiles, skills and organisation chart"],
  requests: ["Requests and workflows", "Forms, tracking and saved drafts"],
  calendar: ["Team calendar", "Company events and availability"],
  knowledge: ["Knowledge base", "Policies, news and acknowledgements"],
  documents: ["Documents", "Portal uploads and company files"],
  chat: ["Chat and channels", "Channels, groups and direct messages"],
  leave: ["Leave management", "Holiday, sickness and WFH requests"],
  shifts: ["Shift and rota centre", "Availability, cover and shift swaps"],
  drivers: ["Driver hub", "Driver records and expiry reminders"],
  vehicles: ["Vehicle hub", "Assignments, maintenance and inspections"],
  incidents: ["Incident reporting", "Safety, complaints and investigations"],
  handover: ["Operations handover", "Shift notes and priority updates"],
  serviceStatus: ["Service status", "Internal systems and maintenance notices"],
  googleCalendar: ["Google Calendar and Meet", "Create and manage Google events"],
  googleDrive: ["Google Drive and Docs", "Browse, attach and create company files"],
  directorySync: ["Google directory sync", "Employees, groups and profile photos"],
  notifications: ["Notification centre", "Portal, email and Google Chat alerts"],
  quickCreate: ["Quick-create menu", "Start common actions from anywhere"],
  commandBar: ["Universal search", "Search and run commands with Ctrl + K"],
  pwa: ["Installable mobile portal", "App-like access and offline shell"],
  accessibility: ["Accessibility preferences", "Contrast, text size and motion"],
  analytics: ["Admin analytics", "Usage, workflow and content insights"],
  projects: ["Boards and projects", "Visual planning, delivery tracking and team collaboration"],
};

export const defaultPortalState: PortalState = {
  profile: { name: "Muneeb Rizwan", jobTitle: "Operations", email: "muneeb.rizwan@takeme.taxi", phone: "", timezone: "Europe/London", department: "Operations" },
  preferences: {
    theme: "light", textSize: "normal", highContrast: false, reducedMotion: false,
    emailNotifications: true, browserNotifications: true, weeklyDigest: false, quietHours: false,
    onboardingComplete: false, onboardingStep: 0,
  },
  features: Object.fromEntries(Object.keys(featureLabels).map(key => [key, true])) as FeatureFlags,
  adminSettings: {
    companyDomain: "takeme.taxi", googleProjectId: "", googleClientId: "", googleSecretConfigured: false, googleConnected: false,
    calendarId: "primary", driveId: "", chatSpace: "", directoryGroup: "all@takeme.taxi", approvalReminderDays: "2",
    approvalEscalationDays: "5", poPrefix: "TM-PO", defaultCurrency: "GBP", sessionTimeout: "8 hours", auditRetention: "7 years",
    dailyDigest: true, urgentGoogleChat: true, desktopNotifications: true, requireMfa: true, suspendLeavers: true,
    approvalDelegation: true, contentReview: true, policyAcknowledgement: true, projectWorkspaceCreation: true,
    projectGuests: false, projectAutomation: true, projectCardDelete: false, projectGoogleCalendar: true, projectGoogleDrive: true,
    projectDefaultVisibility: "Workspace", realtimeEnabled: true, realtimeTyping: true, realtimePresence: true,
    realtimePollingSeconds: "3",
  },
  requests: [
    { id: "PO-2026-041", title: "New design laptops", type: "Purchase order", amount: "£8,450", status: "Awaiting approval", tone: "amber", requester: "Daniel Cole", created: "13 Aug 2026", details: "Four laptops for the design and marketing team.", priority: "High", timeline: timeline("Daniel Cole", "Muneeb Rizwan") },
    { id: "MKT-2026-118", title: "Q4 customer campaign", type: "Marketing request", amount: "—", status: "In progress", tone: "blue", requester: "Sofia Khan", created: "12 Aug 2026", details: "Campaign support for the Q4 passenger promotion.", priority: "Normal", timeline: timeline("Sofia Khan", "Daniel Cole") },
    { id: "IT-2026-327", title: "Figma access for Sam", type: "IT access", amount: "—", status: "Completed", tone: "green", requester: "Sam Wilson", created: "11 Aug 2026", details: "Editor access required for operations templates.", priority: "Normal", timeline: timeline("Sam Wilson", "IT Support").map(item => ({ ...item, complete: true, time: "Completed" })) },
    { id: "HR-2026-204", title: "Annual leave · 24–28 August", type: "Leave request", amount: "—", status: "Approved", tone: "green", requester: "Muneeb Rizwan", created: "10 Aug 2026", details: "Five days annual leave.", priority: "Normal", timeline: timeline("Muneeb Rizwan", "Sofia Khan").map(item => ({ ...item, complete: true, time: "Approved" })) },
  ],
  approvals: [
    { id: "APR-01", requestId: "PO-2026-041", title: "New design laptops", requester: "Daniel Cole", due: "Today", amount: "£8,450", status: "Pending", type: "Purchase order" },
    { id: "APR-02", requestId: "HR-2026-219", title: "Work from home · Friday", requester: "Sam Wilson", due: "Today", amount: "—", status: "Pending", type: "People" },
    { id: "APR-03", requestId: "MKT-2026-121", title: "Airport campaign assets", requester: "Sofia Khan", due: "Tomorrow", amount: "£1,250", status: "Pending", type: "Marketing" },
  ],
  tasks: [
    { id: "TASK-01", title: "Review Q4 campaign brief", owner: "Muneeb Rizwan", due: "Today", status: "In progress", source: "Marketing request", priority: "High" },
    { id: "TASK-02", title: "Confirm all-hands agenda", owner: "Muneeb Rizwan", due: "Today", status: "To do", source: "Calendar", priority: "Normal" },
    { id: "TASK-03", title: "Send fleet document reminder", owner: "Sam Wilson", due: "14 Aug", status: "Waiting", source: "Driver hub", priority: "High" },
    { id: "TASK-04", title: "Read Expenses Policy v3", owner: "Muneeb Rizwan", due: "16 Aug", status: "To do", source: "Knowledge", priority: "Normal" },
  ],
  events: [
    { id: "EV-01", title: "Quarterly all-hands", date: "2026-08-13", start: "15:00", end: "16:00", location: "Google Meet", meet: true, guests: ["all@takeme.taxi"], notes: "Company results and Q4 priorities." },
    { id: "EV-02", title: "Marketing sync", date: "2026-08-14", start: "10:30", end: "11:00", location: "Room Cedar", meet: false, guests: ["marketing@takeme.taxi"], notes: "Weekly campaign review." },
    { id: "EV-03", title: "Operations stand-up", date: "2026-08-11", start: "09:30", end: "10:00", location: "Google Meet", meet: true, guests: ["operations@takeme.taxi"], notes: "Daily service and fleet update." },
  ],
  conversations: [
    { id: "CHAT-01", name: "Company announcements", type: "Channel", members: ["Everyone"], unread: 0, messages: [
      { id: "M-01", author: "Sofia Khan", initials: "SK", text: "Today’s all-hands starts at 3:00 PM. The Google Meet link is in the calendar event.", time: "10:32" },
      { id: "M-02", author: "Daniel Cole", initials: "DC", text: "We’ll also share the Q4 campaign preview.", time: "10:47" },
    ] },
    { id: "CHAT-02", name: "Operations", type: "Channel", members: ["Muneeb Rizwan", "Sam Wilson", "Sofia Khan"], unread: 4, messages: [{ id: "M-03", author: "Sam Wilson", initials: "SW", text: "Morning fleet check is complete. Two vehicles need follow-up.", time: "09:18" }] },
    { id: "CHAT-03", name: "Customer Support", type: "Channel", members: ["Support team"], unread: 2, messages: [] },
    { id: "CHAT-04", name: "Marketing", type: "Channel", members: ["Marketing team"], unread: 0, messages: [] },
  ],
  documents: [
    { id: "DOC-01", name: "Take Me brand guidelines", type: "PDF", owner: "Marketing", updated: "Today", folder: "Brand assets", size: "4.2 MB", drive: true },
    { id: "DOC-02", name: "Employee handbook 2026", type: "Google Doc", owner: "People", updated: "Yesterday", folder: "Policies", size: "—", drive: true },
    { id: "DOC-03", name: "PO request template", type: "Spreadsheet", owner: "Finance", updated: "8 Aug", folder: "Templates", size: "88 KB", drive: true },
    { id: "DOC-04", name: "Vehicle inspection checklist", type: "PDF", owner: "Operations", updated: "6 Aug", folder: "Operations", size: "620 KB" },
  ],
  articles: [
    { id: "KB-01", title: "Employee handbook", category: "People", summary: "Everything you need to know about working at Take Me.", owner: "People team", reviewed: "1 Aug 2026", acknowledgement: true, helpful: 42 },
    { id: "KB-02", title: "How to submit a purchase order", category: "Finance", summary: "Approval limits, supplier details and the complete PO process.", owner: "Finance", reviewed: "4 Aug 2026", helpful: 31 },
    { id: "KB-03", title: "Driver incident response", category: "Operations", summary: "The immediate steps and contacts for operational incidents.", owner: "Operations", reviewed: "9 Aug 2026", acknowledgement: true, helpful: 29 },
    { id: "KB-04", title: "Brand and social media guide", category: "Marketing", summary: "Logos, tone of voice and campaign approval guidance.", owner: "Marketing", reviewed: "7 Aug 2026", helpful: 18 },
    { id: "KB-05", title: "Google Workspace basics", category: "Technology", summary: "Calendar, Drive, Meet and company account help.", owner: "IT", reviewed: "11 Aug 2026", helpful: 36 },
  ],
  leave: [
    { id: "LEAVE-01", employee: "Muneeb Rizwan", type: "Annual leave", dates: "24–28 Aug", days: 5, status: "Approved" },
    { id: "LEAVE-02", employee: "Sam Wilson", type: "Work from home", dates: "14 Aug", days: 1, status: "Pending" },
  ],
  shifts: [
    { id: "SHIFT-01", date: "Thu 13 Aug", time: "08:00–16:00", team: "Operations day", location: "Leicester", status: "Confirmed" },
    { id: "SHIFT-02", date: "Fri 14 Aug", time: "12:00–20:00", team: "Operations late", location: "Leicester", status: "Available" },
    { id: "SHIFT-03", date: "Sat 15 Aug", time: "09:00–17:00", team: "Weekend cover", location: "Nottingham", status: "Needs cover" },
  ],
  drivers: [
    { id: "DRV-1042", name: "Adeel Ahmed", licence: "Verified", vehicle: "TM42 ABC", status: "Active", expiry: "14 Feb 2027" },
    { id: "DRV-1068", name: "James Walker", licence: "Expires soon", vehicle: "TM18 TAX", status: "Review", expiry: "28 Aug 2026" },
    { id: "DRV-1091", name: "Hassan Ali", licence: "Verified", vehicle: "Unassigned", status: "Active", expiry: "3 May 2027" },
    { id: "DRV-1104", name: "Sarah Martin", licence: "Document needed", vehicle: "TM66 CAB", status: "Restricted", expiry: "—" },
  ],
  vehicles: [
    { id: "VEH-42", registration: "TM42 ABC", model: "Toyota Corolla", driver: "Adeel Ahmed", status: "Available", service: "12 Sep 2026" },
    { id: "VEH-18", registration: "TM18 TAX", model: "Skoda Octavia", driver: "James Walker", status: "In service", service: "Today" },
    { id: "VEH-66", registration: "TM66 CAB", model: "Toyota Prius", driver: "Sarah Martin", status: "Inspection due", service: "19 Aug 2026" },
  ],
  incidents: [
    { id: "INC-2026-088", title: "Minor vehicle damage", category: "Vehicle", reported: "Today · 08:42", owner: "Sam Wilson", status: "Investigating", confidential: false },
    { id: "INC-2026-087", title: "Passenger complaint follow-up", category: "Complaint", reported: "Yesterday", owner: "Sofia Khan", status: "Assigned", confidential: true },
  ],
  handovers: [
    { id: "HAND-01", shift: "Night → Day", author: "Adeel Ahmed", note: "Airport queue was heavy after 05:30. Monitor cover through the morning peak.", priority: "High", read: false },
    { id: "HAND-02", shift: "Operations", author: "Sam Wilson", note: "TM18 TAX is in service. Replacement vehicle assigned until 14:00.", priority: "Normal", read: false },
  ],
  services: [
    { id: "STATUS-01", name: "Booking platform", status: "Operational", note: "All booking services are running normally.", updated: "2 minutes ago" },
    { id: "STATUS-02", name: "Phone system", status: "Operational", note: "Inbound and outbound calling is available.", updated: "8 minutes ago" },
    { id: "STATUS-03", name: "Google Workspace", status: "Operational", note: "Calendar, Drive and Gmail are available.", updated: "10 minutes ago" },
    { id: "STATUS-04", name: "Driver document service", status: "Maintenance", note: "Planned maintenance from 18:00 to 19:00.", updated: "Today · 09:00" },
  ],
  notifications: [
    { id: "NOT-01", title: "PO-2026-041 needs your approval", detail: "New design laptops · £8,450", group: "Approvals", time: "5 minutes ago", read: false },
    { id: "NOT-02", title: "Quarterly all-hands starts at 3:00 PM", detail: "Google Meet link is ready", group: "Calendar", time: "2 hours ago", read: false },
    { id: "NOT-03", title: "James Walker’s licence expires soon", detail: "Review before 28 August", group: "Operations", time: "Today", read: false },
    { id: "NOT-04", title: "Your IT access request was completed", detail: "Figma access for Sam", group: "Requests", time: "Yesterday", read: true },
  ],
  audit: [
    { id: "AUD-01", actor: "Muneeb Rizwan", action: "Updated Google Workspace settings", area: "Integrations", time: "Today · 11:24" },
    { id: "AUD-02", actor: "Sofia Khan", action: "Invited 3 employees", area: "People", time: "Today · 10:48" },
    { id: "AUD-03", actor: "Daniel Cole", action: "Changed PO approval workflow", area: "Workflows", time: "Today · 09:16" },
  ],
  projectBoards: [
    {
      id: "BOARD-LAUNCH", title: "Mobile app launch", description: "Plan and deliver the Take Me employee app launch across operations, people and marketing.", visibility: "Workspace", starred: true, background: "ocean", createdAt: "1 Aug 2026", updatedAt: "Today",
      calendarSync: true, driveFolder: "Take Me / Mobile app launch", archived: false,
      members: [
        { id: "MEM-MR", name: "Muneeb Rizwan", initials: "MR", email: "muneeb.rizwan@takeme.taxi", color: "#007eae" },
        { id: "MEM-SK", name: "Sofia Khan", initials: "SK", email: "sofia.khan@takeme.taxi", color: "#7c4dff" },
        { id: "MEM-DC", name: "Daniel Cole", initials: "DC", email: "daniel.cole@takeme.taxi", color: "#d76b16" },
        { id: "MEM-SW", name: "Sam Wilson", initials: "SW", email: "sam.wilson@takeme.taxi", color: "#168a58" },
      ],
      labels: [
        { id: "LBL-OPS", name: "Operations", color: "#168a58" }, { id: "LBL-DESIGN", name: "Design", color: "#7c4dff" },
        { id: "LBL-TECH", name: "Engineering", color: "#007eae" }, { id: "LBL-BLOCK", name: "Blocked", color: "#bd3038" },
        { id: "LBL-MKT", name: "Marketing", color: "#d76b16" },
      ],
      lists: [
        { id: "LIST-BACKLOG", title: "Backlog", order: 0, color: "#75838a", limit: 0 },
        { id: "LIST-READY", title: "Ready", order: 1, color: "#007eae", limit: 5 },
        { id: "LIST-DOING", title: "In progress", order: 2, color: "#d76b16", limit: 4 },
        { id: "LIST-REVIEW", title: "Review", order: 3, color: "#7c4dff", limit: 3 },
        { id: "LIST-DONE", title: "Done", order: 4, color: "#168a58", limit: 0 },
      ],
      cards: [
        { id: "CARD-101", title: "Employee mobile navigation", description: "Create one-handed navigation for the most-used employee actions and verify safe areas on Android and iPhone.", listId: "LIST-DONE", order: 0, members: ["MEM-MR", "MEM-SW"], labels: ["LBL-DESIGN", "LBL-TECH"], startDate: "2026-08-05", dueDate: "2026-08-10", dueComplete: true, priority: "High", estimate: "8h", cover: "#007eae", watching: true, archived: false, createdBy: "Muneeb Rizwan", createdAt: "5 Aug 2026", customFields: { Team: "Product", Sprint: "Launch 1", Risk: "Low" },
          checklists: [{ id: "CHK-101", title: "Acceptance criteria", items: [{ id: "CI-101", text: "Bottom navigation", complete: true }, { id: "CI-102", text: "Safe-area handling", complete: true }, { id: "CI-103", text: "Phone-size QA", complete: true }] }],
          attachments: [{ id: "ATT-101", name: "Mobile navigation brief", url: "https://drive.google.com/", source: "Google Drive", addedBy: "Muneeb Rizwan", addedAt: "6 Aug" }],
          comments: [{ id: "COM-101", author: "Sam Wilson", initials: "SW", text: "Tested the primary actions with the operations team. The layout is much faster to use.", createdAt: "10 Aug · 14:20", reactions: ["👍 3"] }],
          activity: [{ id: "ACT-101", actor: "Muneeb Rizwan", action: "moved this card to Done", time: "10 Aug · 15:10" }] },
        { id: "CARD-102", title: "Google Calendar event sync", description: "Connect card due dates to company calendars and support Meet links for project milestones.", listId: "LIST-DOING", order: 0, members: ["MEM-MR"], labels: ["LBL-TECH"], startDate: "2026-08-12", dueDate: "2026-08-18", dueComplete: false, priority: "Urgent", estimate: "12h", cover: "#0f9d58", watching: true, archived: false, createdBy: "Muneeb Rizwan", createdAt: "8 Aug 2026", customFields: { Team: "Engineering", Sprint: "Launch 1", Risk: "Medium" },
          checklists: [{ id: "CHK-102", title: "Integration", items: [{ id: "CI-104", text: "OAuth configuration", complete: true }, { id: "CI-105", text: "Create and edit events", complete: true }, { id: "CI-106", text: "Production account test", complete: false, assignee: "MEM-MR", dueDate: "2026-08-18" }] }], attachments: [], comments: [], activity: [{ id: "ACT-102", actor: "Muneeb Rizwan", action: "started work", time: "12 Aug · 09:00" }] },
        { id: "CARD-103", title: "App-store rollout guide", description: "Prepare employee installation instructions, screenshots and support notes.", listId: "LIST-READY", order: 0, members: ["MEM-SK", "MEM-DC"], labels: ["LBL-MKT"], startDate: "2026-08-17", dueDate: "2026-08-21", dueComplete: false, priority: "Normal", estimate: "5h", cover: "#d76b16", watching: false, archived: false, createdBy: "Sofia Khan", createdAt: "11 Aug 2026", customFields: { Team: "Marketing", Sprint: "Launch 2", Risk: "Low" }, checklists: [], attachments: [], comments: [], activity: [] },
        { id: "CARD-104", title: "Employee pilot feedback", description: "Run a pilot with operations and customer support employees and collect structured feedback.", listId: "LIST-BACKLOG", order: 0, members: ["MEM-SW"], labels: ["LBL-OPS"], startDate: "2026-08-19", dueDate: "2026-08-25", dueComplete: false, priority: "High", estimate: "2d", cover: "", watching: false, archived: false, createdBy: "Sam Wilson", createdAt: "12 Aug 2026", customFields: { Team: "Operations", Sprint: "Launch 2", Risk: "Medium" }, checklists: [], attachments: [], comments: [], activity: [] },
        { id: "CARD-105", title: "Fix profile menu on phones", description: "Ensure the mobile profile and preferences button stays above app navigation.", listId: "LIST-REVIEW", order: 0, members: ["MEM-MR"], labels: ["LBL-DESIGN", "LBL-BLOCK"], startDate: "2026-08-13", dueDate: "2026-08-14", dueComplete: false, priority: "Urgent", estimate: "2h", cover: "#bd3038", watching: true, archived: false, createdBy: "Muneeb Rizwan", createdAt: "13 Aug 2026", customFields: { Team: "Product", Sprint: "Launch 1", Risk: "High" }, checklists: [], attachments: [], comments: [{ id: "COM-105", author: "Muneeb Rizwan", initials: "MR", text: "Confirmed on a 390px phone viewport. Ready for the final fix.", createdAt: "Today · 11:30" }], activity: [] },
      ],
    },
    { id: "BOARD-OPS", title: "Operations improvement", description: "Continuous improvements for dispatch, fleet and customer operations.", visibility: "Workspace", starred: true, background: "midnight", createdAt: "12 Jul 2026", updatedAt: "Yesterday", calendarSync: false, driveFolder: "Take Me / Operations", archived: false, members: [{ id: "MEM-MR", name: "Muneeb Rizwan", initials: "MR", email: "muneeb.rizwan@takeme.taxi", color: "#007eae" }, { id: "MEM-SW", name: "Sam Wilson", initials: "SW", email: "sam.wilson@takeme.taxi", color: "#168a58" }], labels: [{ id: "LBL-FLEET", name: "Fleet", color: "#168a58" }, { id: "LBL-CX", name: "Customer", color: "#7c4dff" }], lists: [{ id: "LIST-IDEAS", title: "Ideas", order: 0, color: "#75838a", limit: 0 }, { id: "LIST-ACTIVE", title: "Active", order: 1, color: "#007eae", limit: 5 }, { id: "LIST-COMPLETE", title: "Complete", order: 2, color: "#168a58", limit: 0 }], cards: [{ id: "CARD-201", title: "Morning fleet readiness checklist", description: "Standardise the daily fleet handover.", listId: "LIST-ACTIVE", order: 0, members: ["MEM-SW"], labels: ["LBL-FLEET"], startDate: "2026-08-10", dueDate: "2026-08-17", dueComplete: false, priority: "High", estimate: "1d", checklists: [], attachments: [], comments: [], activity: [], customFields: { Team: "Operations" }, cover: "#168a58", watching: false, archived: false, createdBy: "Sam Wilson", createdAt: "10 Aug 2026" }],
    },
    { id: "BOARD-MKT", title: "Q4 marketing campaign", description: "Campaign planning, content production and launch approvals.", visibility: "Workspace", starred: false, background: "sunset", createdAt: "28 Jul 2026", updatedAt: "3 days ago", calendarSync: true, driveFolder: "Take Me / Marketing / Q4", archived: false, members: [{ id: "MEM-SK", name: "Sofia Khan", initials: "SK", email: "sofia.khan@takeme.taxi", color: "#7c4dff" }, { id: "MEM-DC", name: "Daniel Cole", initials: "DC", email: "daniel.cole@takeme.taxi", color: "#d76b16" }], labels: [{ id: "LBL-COPY", name: "Copy", color: "#007eae" }, { id: "LBL-DESIGN", name: "Design", color: "#7c4dff" }], lists: [{ id: "LIST-BRIEF", title: "Briefs", order: 0, color: "#75838a", limit: 0 }, { id: "LIST-PRODUCTION", title: "Production", order: 1, color: "#d76b16", limit: 6 }, { id: "LIST-APPROVAL", title: "Approval", order: 2, color: "#7c4dff", limit: 3 }, { id: "LIST-LIVE", title: "Live", order: 3, color: "#168a58", limit: 0 }], cards: [{ id: "CARD-301", title: "Passenger app launch story", description: "Customer story for the Q4 campaign.", listId: "LIST-PRODUCTION", order: 0, members: ["MEM-SK"], labels: ["LBL-COPY"], startDate: "2026-08-12", dueDate: "2026-08-20", dueComplete: false, priority: "Normal", estimate: "6h", checklists: [], attachments: [], comments: [], activity: [], customFields: { Channel: "Website" }, cover: "#7c4dff", watching: false, archived: false, createdBy: "Sofia Khan", createdAt: "12 Aug 2026" }],
    },
  ],
  projectAutomations: [
    { id: "AUTO-01", boardId: "BOARD-LAUNCH", name: "Complete cards moved to Done", enabled: true, trigger: "Card moved", triggerValue: "LIST-DONE", action: "Mark due complete", actionValue: "", runs: 14 },
    { id: "AUTO-02", boardId: "BOARD-LAUNCH", name: "Flag review cards", enabled: true, trigger: "Card moved", triggerValue: "LIST-REVIEW", action: "Add label", actionValue: "LBL-DESIGN", runs: 8 },
  ],
  projectTemplates: [
    { id: "TPL-01", name: "Team project", category: "Project management", description: "Plan work from ideas through delivery.", lists: ["Backlog", "Ready", "In progress", "Review", "Done"], color: "ocean" },
    { id: "TPL-02", name: "Marketing campaign", category: "Marketing", description: "Move campaigns from brief to launch.", lists: ["Briefs", "Production", "Approval", "Scheduled", "Live"], color: "sunset" },
    { id: "TPL-03", name: "Operations improvement", category: "Operations", description: "Capture and deliver continuous improvements.", lists: ["Ideas", "Selected", "Active", "Measure", "Complete"], color: "midnight" },
    { id: "TPL-04", name: "Employee onboarding", category: "People", description: "Coordinate every new-starter action.", lists: ["Before joining", "First day", "First week", "First month", "Complete"], color: "forest" },
  ],
  widgets: ["approvals", "calendar", "tasks", "status", "news", "quickLinks"],
};

export function mergePortalState(value: Partial<PortalState> | null | undefined): PortalState {
  if (!value) return defaultPortalState;
  const repaired = repairTextEncoding(value) as Partial<PortalState>;
  return {
    ...defaultPortalState,
    ...repaired,
    profile: { ...defaultPortalState.profile, ...repaired.profile },
    preferences: { ...defaultPortalState.preferences, ...repaired.preferences },
    features: { ...defaultPortalState.features, ...repaired.features },
    adminSettings: { ...defaultPortalState.adminSettings, ...repaired.adminSettings },
  };
}

function repairTextEncoding<T>(value: T): T {
  if (typeof value === "string" && /[ÂÃâ]/.test(value) && [...value].every(character => character.charCodeAt(0) < 256)) {
    try { const decoded = new TextDecoder().decode(Uint8Array.from([...value].map(character => character.charCodeAt(0)))); if (!decoded.includes("�")) return decoded as T; } catch { /* keep original */ }
  }
  if (Array.isArray(value)) return value.map(item => repairTextEncoding(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, repairTextEncoding(item)])) as T;
  return value;
}

export const makeId = (prefix: string) => {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 6).toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
};
