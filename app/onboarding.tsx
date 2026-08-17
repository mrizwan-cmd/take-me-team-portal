"use client";

import { useMemo, useState } from "react";
import type { PortalState } from "./portal-data";
import type { UpdatePortal } from "./employee-portal";
import { GoogleGLogo, SvgIcon, type Notify } from "./portal-ui";

const tourSteps = [
  {
    icon: "home",
    short: "Welcome",
    title: "Welcome to your Take Me workspace",
    intro: "This portal brings daily work, company information and Google Workspace tools into one secure place.",
    points: [
      ["Start from Home", "My Day shows meetings, tasks, approvals, company news and service updates."],
      ["Use the left menu", "Every employee tool is grouped in one consistent navigation."],
      ["Search from anywhere", "Choose the search bar or press Ctrl K to find pages, people, documents and commands."],
      ["Use it on your phone", "The bottom bar keeps Home, Projects, Create and Chat within easy reach."]
    ],
    tip: "Your profile, theme, accessibility and notification choices are personal and saved to your account.",
    page: "Home"
  },
  {
    icon: "plus",
    short: "Daily work",
    title: "Handle everyday work quickly",
    intro: "Create common work without hunting through menus, then follow progress from Home.",
    points: [
      ["Choose Create", "Start a request, meeting, conversation, task, leave request, shift update, incident or handover."],
      ["Watch My Day", "Home brings urgent items and upcoming work together."],
      ["Use Action inbox", "Managers and approvers can decide purchase orders, leave and other requests."],
      ["Manage notifications", "Open the bell icon to read, snooze or jump directly to an update."]
    ],
    tip: "Use Quick create on mobile for the fastest route to common forms.",
    page: "Home"
  },
  {
    icon: "projects",
    short: "Projects",
    title: "Plan and deliver projects",
    intro: "Projects provides visual boards for team delivery, from an initial idea through completion.",
    points: [
      ["Open or create a board", "Start blank or use a Take Me template for projects, campaigns, operations or onboarding."],
      ["Move cards through lists", "Drag cards on desktop or change the List field from a phone."],
      ["Add working detail", "Assign members, labels, dates, priorities, checklists, comments, files and custom fields."],
      ["Change the view", "Use Board, Table, Calendar, Timeline, Dashboard and Activity views for different questions."],
      ["Automate routine steps", "Rules can complete, label, assign, move or comment when work changes."]
    ],
    tip: "A card deadline can create a real Google Calendar event after your Google account is connected.",
    page: "Projects"
  },
  {
    icon: "google",
    short: "Google",
    title: "Use Google Workspace inside the portal",
    intro: "Calendar and Drive remain connected to your own Take Me Google account and are never shared between employees.",
    points: [
      ["Calendar", "Sync company events, create Google Meet meetings, edit invitations and cancel events from the portal."],
      ["Drive", "Browse Workspace files, open Google documents and attach Drive links to project cards."],
      ["People", "Company email identities, teams and directory details keep collaboration accurate."],
      ["Connect once", "Open Profile or Admin Integrations and connect the same @takeme.taxi account used to sign in."]
    ],
    tip: "Google login only proves company access; Calendar and Drive permissions are requested separately when you use them.",
    page: "Calendar"
  },
  {
    icon: "requests",
    short: "Requests",
    title: "Submit requests and follow approvals",
    intro: "Company forms replace email chains with clear ownership, status and history.",
    points: [
      ["Choose the right form", "Use Requests or Quick create for purchase orders, expenses, IT, marketing and facilities."],
      ["Save or submit", "Keep an unfinished draft or send it into the approval workflow."],
      ["Track every step", "Each request shows submission, manager review and final confirmation."],
      ["Approve responsibly", "Authorised managers can approve or reject from Action inbox; employees only see their own records."]
    ],
    tip: "Attach quotations and include useful detail so approvers can decide without chasing information.",
    page: "Requests"
  },
  {
    icon: "people",
    short: "People & info",
    title: "Find people, conversations and company knowledge",
    intro: "The portal is the quickest route to colleagues, answers and controlled company files.",
    points: [
      ["People", "Find colleagues by name, team, location or skills, then email or start a chat."],
      ["Chat", "Use company channels, team groups or direct conversations."],
      ["Knowledge", "Read policies, guides and company news; acknowledge policies when requested."],
      ["Documents", "Browse portal files and Google Drive without leaving the employee workspace."]
    ],
    tip: "Try universal search first when you are unsure where something lives.",
    page: "People"
  },
  {
    icon: "leave",
    short: "Work life",
    title: "Manage work life and get help",
    intro: "Finish setup with the tools employees use for schedules, mobile access and support.",
    points: [
      ["Leave & shifts", "Check balances, request leave, offer availability and follow rota changes."],
      ["Operations", "Drivers and operations teams can review vehicles, incidents, handovers and service status."],
      ["Install the portal", "Add it to an Android or iPhone Home Screen for an app-like experience."],
      ["Open Help anytime", "The question-mark button contains detailed guides for every area and can restart this tour."],
      ["Keep your account secure", "Never share access. Sign out on shared devices and report unexpected account activity to IT."]
    ],
    tip: "You can change dark mode, text size, contrast, motion and alerts under Profile and preferences.",
    page: "Leave & shifts"
  },
];

export function OnboardingGuide({ state, updateState, close, navigate, notify }: { state: PortalState; updateState: UpdatePortal; close: () => void; navigate: (page: string) => void; notify: Notify }) {
  const step = Math.min(Math.max(state.preferences.onboardingStep || 0, 0), tourSteps.length - 1);
  const item = tourSteps[step];
  const move = (next: number) => updateState(current => ({ ...current, preferences: { ...current.preferences, onboardingStep: Math.min(Math.max(next, 0), tourSteps.length - 1) } }));
  const finish = () => {
    updateState(current => ({ ...current, preferences: { ...current.preferences, onboardingComplete: true, onboardingStep: tourSteps.length - 1 } }));
    close();
    notify("Your portal introduction is complete");
  };

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-label="First-time portal guide">
        <aside className="onboarding-side">
          <p className="eyebrow">FIRST-TIME GUIDE</p>
          <h2>Learn the portal</h2>
          <p>Seven short steps cover the complete employee experience.</p>
          <nav className="onboarding-progress" aria-label="Onboarding steps">
            {tourSteps.map((tour, index) => (
              <button key={tour.short} className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => move(index)}>
                <i>{index < step ? <SvgIcon name="check" size={12} /> : index + 1}</i>
                {tour.short}
              </button>
            ))}
          </nav>
          <small>Your current step is saved. Choose Continue later and return from Help whenever you want.</small>
        </aside>
        <div className="onboarding-main">
          <header>
            <i className="onboarding-icon">
              {item.icon === "google" ? <GoogleGLogo size={28} /> : <SvgIcon name={item.icon} size={28} />}
            </i>
            <div>
              <p className="eyebrow">STEP {step + 1} OF {tourSteps.length}</p>
              <h1>{item.title}</h1>
              <p>{item.intro}</p>
            </div>
            <button className="onboarding-close" aria-label="Continue onboarding later" onClick={close}>×</button>
          </header>
          <div className="onboarding-steps">
            {item.points.map((point, index) => (
              <article key={point[0]}>
                <i>{index + 1}</i>
                <span><b>{point[0]}</b><small>{point[1]}</small></span>
              </article>
            ))}
          </div>
          <div className="onboarding-tip">
            <b>Useful tip:</b> {item.tip}
          </div>
          <footer className="onboarding-actions">
            <button className="text-button" onClick={() => { navigate(item.page); close(); }}>Open {item.page}</button>
            <div>
              {step > 0 && <button className="secondary" onClick={() => move(step - 1)}>Back</button>}
              {step < tourSteps.length - 1 ? (
                <button className="primary" onClick={() => move(step + 1)}>Next step</button>
              ) : (
                <button className="primary" onClick={finish}>Finish introduction</button>
              )}
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}

type HelpTopic = { category: string; icon: string; title: string; summary: string; steps: string[]; page: string };
const helpTopics: HelpTopic[] = [
  { category: "Start", icon: "home", title: "Home and navigation", summary: "Understand My Day, the menu, mobile bar and saved home cards.", page: "Home", steps: ["Open Home to see current meetings, tasks, decisions and company updates.", "Choose Customise home to show, hide or reorder your personal cards.", "Use the left menu on a computer or More on a phone for every portal area.", "Use the top search or Ctrl K to find a page, record or quick command."] },
  { category: "Start", icon: "plus", title: "Quick create and notifications", summary: "Start work and respond to updates from anywhere.", page: "Home", steps: ["Choose Create in the top bar or phone navigation.", "Select the item you need and complete the required fields.", "Open the notification bell to read grouped updates.", "Snooze an item or select it to open the relevant record."] },
  { category: "Work", icon: "projects", title: "Projects, boards and cards", summary: "Plan projects, collaborate on cards and report delivery.", page: "Projects", steps: ["Open Projects and select an existing board or an approved template.", "Create lists for your process and add cards for deliverable work.", "Assign members, labels, dates, priorities, checklists, files and comments.", "Drag cards between lists or change the List field on mobile.", "Use Calendar, Timeline and Dashboard for deadlines and reporting.", "Open Automation to configure repeatable card actions."] },
  { category: "Work", icon: "tasks", title: "Tasks and follow-ups", summary: "Organise personal and shared actions.", page: "Tasks", steps: ["Open Tasks or choose Task from Quick create.", "Add a clear title, owner, due date and priority.", "Move work between To do, In progress, Waiting and Done.", "Review due work from the Home task card."] },
  { category: "Work", icon: "requests", title: "Requests and approvals", summary: "Submit forms, follow status and make authorised decisions.", page: "Requests", steps: ["Open Requests and choose the correct form type.", "Add the purpose, amount and supporting detail.", "Save a draft or submit it into the workflow.", "Follow the timeline for manager review and confirmation.", "Authorised approvers use Action inbox to approve or reject."] },
  { category: "Google", icon: "calendar", title: "Google Calendar and Meet", summary: "Connect, create, edit and cancel company events.", page: "Calendar", steps: ["Open Calendar and choose Connect Google Calendar if needed.", "Sign in with the same @takeme.taxi account used for the portal.", "Choose Create event, add guests and enable Google Meet when required.", "Select a synced event to edit, cancel or open it in Google.", "Project card deadlines can also create Google Calendar events."] },
  { category: "Google", icon: "documents", title: "Google Drive and documents", summary: "Find company files and connect them to work.", page: "Documents", steps: ["Open Documents and connect your Google account if required.", "Choose Browse Google Drive to load company files.", "Open a file in Google or use its Drive link on a project card.", "Use portal upload only for files that should be stored directly in the portal."] },
  { category: "People", icon: "people", title: "People directory", summary: "Find a colleague, skill, team or contact route.", page: "People", steps: ["Search by name, department, location or useful skill.", "Open a profile to review contact and team information.", "Choose Email or Chat to contact the colleague.", "Keep your own job, department and phone details current under Profile."] },
  { category: "People", icon: "chat", title: "Chat and conversations", summary: "Use channels, groups and direct conversations.", page: "Chat", steps: ["Open Chat and select a company channel or conversation.", "Choose New conversation to start a channel, group or direct chat.", "Add only the colleagues who need the conversation.", "Use clear channel names and keep sensitive records in approved systems."] },
  { category: "Information", icon: "knowledge", title: "Knowledge and policies", summary: "Find trusted guidance, news and required reading.", page: "Knowledge", steps: ["Search Knowledge by title, category or subject.", "Open an article to read the current owner and review date.", "Complete policy acknowledgement when requested.", "Mark useful guidance as Helpful and contact the owner for corrections."] },
  { category: "Work life", icon: "leave", title: "Leave, shifts and rota", summary: "Manage time away, availability and shift changes.", page: "Leave & shifts", steps: ["Review your current leave balance and rota.", "Create a leave request with accurate dates and type.", "Offer availability or request a shift change when needed.", "Follow the status and manager decision from the same page."] },
  { category: "Work life", icon: "operations", title: "Operations tools", summary: "Drivers, vehicles, incidents, handovers and service status.", page: "Operations", steps: ["Choose the relevant Operations tab.", "Review driver and vehicle warnings before assigning work.", "Report incidents with accurate details and confidentiality settings.", "Read handover notes at the start of a shift.", "Check Service status before reporting a known outage."] },
  { category: "Account", icon: "settings", title: "Profile, accessibility and mobile app", summary: "Personalise the portal and install it on a phone.", page: "Home", steps: ["Choose your name in the menu to open Profile and preferences.", "Update work details and select your time zone.", "Choose dark mode, larger text, high contrast or reduced motion.", "Set notification preferences and connect Google services.", "Choose Install portal or add it from your phone browser menu."] },
  { category: "Account", icon: "lock", title: "Security and signing out", summary: "Keep company information protected.", page: "Home", steps: ["Always enter through Continue with Google using @takeme.taxi.", "Do not share your account or leave the portal open on a shared device.", "Choose Sign out at the bottom of the navigation when using a shared or temporary device.", "Report unexpected access, prompts or activity to Take Me IT immediately."] },
];

export function HelpCentre({ close, restartTour, navigate, isAdmin }: { close: () => void; restartTour: () => void; navigate: (page: string) => void; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [open, setOpen] = useState("");
  const topics = useMemo(() => helpTopics.filter(topic => (category === "All" || topic.category === category) && `${topic.title} ${topic.summary} ${topic.steps.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [category, query]);
  const categories = ["All", ...new Set(helpTopics.map(topic => topic.category))];

  return (
    <div className="utility-panel help-centre-panel" role="dialog" aria-label="Help centre">
      <header>
        <h2>Help centre</h2>
        <button aria-label="Close Help centre" onClick={close}>×</button>
      </header>
      <section className="help-welcome">
        <h3>New to the portal?</h3>
        <p>Restart the complete seven-step employee introduction at any time.</p>
        <button onClick={restartTour}>Start guided introduction</button>
      </section>
      <div className="panel-search">
        <SvgIcon name="search" size={16} />
        <input aria-label="Search help" placeholder="Search projects, Google, requests, shifts…" value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      <div className="help-categories">
        {categories.map(item => (
          <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {topics.map(topic => (
        <section className="help-topic" key={topic.title}>
          <button onClick={() => setOpen(value => value === topic.title ? "" : topic.title)}>
            <i><SvgIcon name={topic.icon} size={16} /></i>
            <span><b>{topic.title}</b><small>{topic.summary}</small></span>
            <em>{open === topic.title ? "−" : "+"}</em>
          </button>
          {open === topic.title && (
            <div className="help-topic-detail">
              <p>Follow these steps:</p>
              <ol>{topic.steps.map(step => <li key={step}>{step}</li>)}</ol>
              <button className="text-button" onClick={() => { navigate(topic.page); close(); }}>Open {topic.page} →</button>
            </div>
          )}
        </section>
      ))}
      {!topics.length && (
        <div className="help-empty">
          <b>No matching guide</b>
          <p>Try a simpler word or choose All.</p>
        </div>
      )}
      {isAdmin && (
        <button className="panel-footer" onClick={() => { navigate("Overview"); close(); }}>Open administrator settings</button>
      )}
    </div>
  );
}
