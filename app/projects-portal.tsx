"use client";

import { useEffect, useState } from "react";
import { makeId, type ProjectAutomation, type ProjectBoard, type ProjectCard, type ProjectList, type ProjectTemplate, type PortalState } from "./portal-data";
import { EmptyState, Modal, PageIntro, StatusPill, SvgIcon, Toggle, type Notify } from "./portal-ui";
import type { UpdatePortal } from "./employee-portal";

type Props = { state: PortalState; updateState: UpdatePortal; notify: Notify };
type View = "Board" | "Table" | "Calendar" | "Timeline" | "Dashboard" | "Activity";

const boardColors: Record<string, string> = { ocean: "linear-gradient(135deg,#006f9e,#02a6eb)", midnight: "linear-gradient(135deg,#17262d,#31505d)", sunset: "linear-gradient(135deg,#b94d39,#e69b3b)", forest: "linear-gradient(135deg,#146447,#42a775)" };
const today = "2026-08-14";
const completion = (card: ProjectCard) => { const items = card.checklists.flatMap(list => list.items); return items.length ? Math.round(items.filter(item => item.complete).length / items.length * 100) : 0; };
const cardDateTone = (card: ProjectCard) => card.dueComplete ? "complete" : card.dueDate && card.dueDate < today ? "late" : card.dueDate === today ? "today" : "upcoming";

export default function ProjectsPortal({ state, updateState, notify }: Props) {
  const [boardId, setBoardId] = useState("");
  const [view, setView] = useState<View>("Board");
  const [selectedCard, setSelectedCard] = useState("");
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createBoard, setCreateBoard] = useState(false);
  const [createList, setCreateList] = useState(false);
  const [cardList, setCardList] = useState("");
  const [showAutomation, setShowAutomation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draggedCard, setDraggedCard] = useState("");
  const board = state.projectBoards.find(item => item.id === boardId && !item.archived);

  const updateBoard = (updater: (current: ProjectBoard) => ProjectBoard) => updateState(current => ({
    ...current,
    projectBoards: current.projectBoards.map(item => item.id === boardId ? { ...updater(item), updatedAt: "Just now" } : item),
  }));

  const openBoard = (id: string) => {
    setBoardId(id);
    setView("Board");
    setQuery("");
    setMemberFilter("");
    setLabelFilter("");
    const url = new URL(window.location.href);
    url.searchParams.set("page", "Projects");
    url.searchParams.set("board", id);
    window.history.replaceState({ page: "Projects", admin: false }, "", `${url.pathname}${url.search}`);
  };

  useEffect(() => {
    const requestedBoard = new URLSearchParams(window.location.search).get("board");
    if (requestedBoard && state.projectBoards.some(item => item.id === requestedBoard && !item.archived)) {
      const routeTimer = window.setTimeout(() => setBoardId(requestedBoard), 0);
      return () => window.clearTimeout(routeTimer);
    }
  }, [state.projectBoards]);

  const createFromTemplate = (template: ProjectTemplate) => {
    if (!state.adminSettings.projectWorkspaceCreation) { notify("Board creation is disabled by an administrator"); return; }
    const id = makeId("BOARD");
    const listIds = template.lists.map((_, index) => `${id}-LIST-${index}`);
    const next: ProjectBoard = {
      id,
      title: `${template.name} project`,
      description: template.description,
      visibility: "Workspace",
      starred: false,
      background: template.color,
      members: [{ id: "MEM-MR", name: state.profile.name, initials: initials(state.profile.name), email: state.profile.email, color: "#007eae" }],
      labels: defaultLabels(),
      lists: template.lists.map((title, index) => ({ id: listIds[index], title, order: index, color: index === template.lists.length - 1 ? "#168a58" : "#75838a", limit: 0 })),
      cards: [],
      createdAt: "Just now",
      updatedAt: "Just now",
      calendarSync: false,
      driveFolder: "",
      archived: false,
    };
    updateState(current => ({ ...current, projectBoards: [next, ...current.projectBoards] }));
    openBoard(id);
    notify(`${template.name} board created`);
  };

  if (!board) return (
    <>
      <ProjectsHome state={state} openBoard={openBoard} newBoard={() => state.adminSettings.projectWorkspaceCreation ? setCreateBoard(true) : notify("Board creation is disabled by an administrator")} createFromTemplate={createFromTemplate} />
      {createBoard && <NewBoardModal templates={state.projectTemplates} state={state} updateState={updateState} close={() => setCreateBoard(false)} openBoard={openBoard} />}
    </>
  );

  const cards = board.cards.filter(card => (showArchived ? card.archived : !card.archived) && (!query || `${card.title} ${card.description}`.toLowerCase().includes(query.toLowerCase())) && (!memberFilter || card.members.includes(memberFilter)) && (!labelFilter || card.labels.includes(labelFilter)));
  const activeCard = board.cards.find(card => card.id === selectedCard);

  const moveCard = (cardId: string, listId: string) => updateState(current => {
    const activeBoard = current.projectBoards.find(item => item.id === boardId);
    if (!activeBoard) return current;
    const destination = activeBoard.lists.find(list => list.id === listId);
    if (destination?.limit && activeBoard.cards.filter(card => card.listId === listId && !card.archived).length >= destination.limit) {
      notify(`${destination.title} has reached its work-in-progress limit`);
      return current;
    }
    const rules = current.projectAutomations.filter(rule => rule.boardId === boardId && rule.enabled && rule.trigger === "Card moved" && rule.triggerValue === listId);
    let moved = activeBoard.cards.map(card => card.id === cardId ? { ...card, listId, order: activeBoard.cards.filter(item => item.listId === listId).length, activity: [{ id: makeId("ACT"), actor: current.profile.name, action: `moved this card to ${destination?.title || "another list"}`, time: "Just now" }, ...card.activity] } : card);
    for (const rule of rules) moved = moved.map(card => card.id !== cardId ? card : applyRule(card, rule));
    return {
      ...current,
      projectBoards: current.projectBoards.map(item => item.id === boardId ? { ...item, cards: moved, updatedAt: "Just now" } : item),
      projectAutomations: current.projectAutomations.map(rule => rules.some(item => item.id === rule.id) ? { ...rule, runs: rule.runs + 1 } : rule),
    };
  });

  const exportBoard = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${board.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Board exported");
  };

  return (
    <div className="projects-page">
      <header className="project-board-header" style={{ background: boardColors[board.background] || boardColors.ocean }}>
        <div className="project-breadcrumb">
          <button onClick={() => setBoardId("")}>Projects</button>
          <span>›</span>
          <b>{board.title}</b>
        </div>
        <div className="project-title-row">
          <button className={`project-star ${board.starred ? "active" : ""}`} aria-label={board.starred ? "Unstar board" : "Star board"} onClick={() => updateBoard(current => ({ ...current, starred: !current.starred }))}>★</button>
          <div>
            <h1>{board.title}</h1>
            <p>{board.description}</p>
          </div>
          <span className="visibility-chip">{board.visibility}</span>
          <MemberStack board={board} />
        </div>
        <div className="project-toolbar">
          <div className="project-views">
            {(["Board", "Table", "Calendar", "Timeline", "Dashboard", "Activity"] as View[]).map(item => (
              <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
                <i><SvgIcon name={viewIconName(item)} size={14} /></i>
                <span>{item}</span>
              </button>
            ))}
          </div>
          <div className="project-actions">
            <button onClick={() => setShowAutomation(true)}>⚡ Automation</button>
            <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/?page=Projects&board=${board.id}`).then(() => notify("Board link copied"))}>Share</button>
            <button aria-label="Board settings" onClick={() => setShowSettings(true)}>•••</button>
          </div>
        </div>
      </header>

      <section className="project-filterbar">
        <label className="project-search">
          <SvgIcon name="search" size={14} />
          <input aria-label="Search cards" placeholder="Search cards" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <select aria-label="Filter by member" value={memberFilter} onChange={event => setMemberFilter(event.target.value)}>
          <option value="">All members</option>
          {board.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <select aria-label="Filter by label" value={labelFilter} onChange={event => setLabelFilter(event.target.value)}>
          <option value="">All labels</option>
          {board.labels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}
        </select>
        <button className={showArchived ? "active" : ""} onClick={() => setShowArchived(value => !value)}>Archive</button>
        {(query || memberFilter || labelFilter) && <button onClick={() => { setQuery(""); setMemberFilter(""); setLabelFilter(""); }}>Clear filters</button>}
        <span>{cards.length} cards</span>
      </section>

      {view === "Board" && <BoardView board={board} cards={cards} draggedCard={draggedCard} setDraggedCard={setDraggedCard} moveCard={moveCard} openCard={setSelectedCard} addCard={setCardList} addList={() => setCreateList(true)} updateBoard={updateBoard} />}
      {view === "Table" && <TableView board={board} cards={cards} openCard={setSelectedCard} />}
      {view === "Calendar" && <CalendarView board={board} cards={cards} openCard={setSelectedCard} />}
      {view === "Timeline" && <TimelineView board={board} cards={cards} openCard={setSelectedCard} />}
      {view === "Dashboard" && <DashboardView board={board} cards={cards} />}
      {view === "Activity" && <ActivityView board={board} />}

      {activeCard && <CardDetails card={activeCard} board={board} state={state} updateBoard={updateBoard} close={() => setSelectedCard("")} notify={notify} updateState={updateState} />}
      {cardList && <NewCardModal board={board} listId={cardList} updateBoard={updateBoard} close={() => setCardList("")} notify={notify} />}
      {createList && <NewListModal board={board} updateBoard={updateBoard} close={() => setCreateList(false)} />}
      {createBoard && <NewBoardModal templates={state.projectTemplates} state={state} updateState={updateState} close={() => setCreateBoard(false)} openBoard={openBoard} />}
      {showAutomation && <AutomationCenter board={board} automations={state.projectAutomations.filter(item => item.boardId === board.id)} updateState={updateState} close={() => setShowAutomation(false)} notify={notify} />}
      {showSettings && <BoardSettings board={board} updateBoard={updateBoard} close={() => setShowSettings(false)} exportBoard={exportBoard} notify={notify} />}
    </div>
  );
}

function ProjectsHome({ state, openBoard, newBoard, createFromTemplate }: { state: PortalState; openBoard: (id: string) => void; newBoard: () => void; createFromTemplate: (template: ProjectTemplate) => void }) {
  const boards = state.projectBoards.filter(board => !board.archived);
  const cards = boards.flatMap(board => board.cards.filter(card => !card.archived));
  const dueSoon = cards.filter(card => !card.dueComplete && card.dueDate && card.dueDate <= "2026-08-21").length;

  return (
    <div className="page project-home">
      <PageIntro eyebrow="PROJECT MANAGEMENT" title="Projects and boards" text="Plan work visually, coordinate teams, automate routine steps and keep delivery moving." action={<button className="primary" onClick={newBoard}>＋ Create board</button>} />
      <div className="project-kpis">
        <section className="card"><i><SvgIcon name="projects" size={20} /></i><span><b>{boards.length}</b><small>Active boards</small></span></section>
        <section className="card"><i><SvgIcon name="tasks" size={20} /></i><span><b>{cards.length}</b><small>Open cards</small></span></section>
        <section className="card"><i><SvgIcon name="calendar" size={20} /></i><span><b>{dueSoon}</b><small>Due this week</small></span></section>
        <section className="card"><i>⚡</i><span><b>{state.projectAutomations.filter(rule => rule.enabled).length}</b><small>Active automations</small></span></section>
      </div>
      <div className="project-section-head"><div><h2>Starred boards</h2><p>Your most important workspaces.</p></div></div>
      <div className="board-gallery">{boards.filter(board => board.starred).map(board => <BoardTile key={board.id} board={board} open={() => openBoard(board.id)} />)}</div>
      <div className="project-section-head"><div><h2>All boards</h2><p>Projects shared across Take Me Group.</p></div></div>
      <div className="board-gallery">
        {boards.map(board => <BoardTile key={board.id} board={board} open={() => openBoard(board.id)} />)}
        <button className="new-board-tile" onClick={newBoard}>
          <i><SvgIcon name="plus" size={24} /></i>
          <b>Create a new board</b>
          <small>Start blank or use a template</small>
        </button>
      </div>
      <div className="project-section-head"><div><h2>Templates</h2><p>Start with a proven Take Me workflow.</p></div></div>
      <div className="template-gallery">
        {state.projectTemplates.map(template => (
          <button key={template.id} onClick={() => createFromTemplate(template)}>
            <i style={{ background: boardColors[template.color] }} />
            <span><b>{template.name}</b><small>{template.category} · {template.description}</small></span>
            <em>Use template</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function BoardTile({ board, open }: { board: ProjectBoard; open: () => void }) {
  const active = board.cards.filter(card => !card.archived);
  return (
    <button className="board-tile" onClick={open} style={{ background: boardColors[board.background] || boardColors.ocean }}>
      <header><span>{board.starred ? "★" : ""}</span><small>{board.visibility}</small></header>
      <div><h3>{board.title}</h3><p>{board.description}</p></div>
      <footer><span>{active.length} cards</span><MemberStack board={board} /></footer>
    </button>
  );
}

function MemberStack({ board }: { board: ProjectBoard }) {
  return (
    <span className="member-stack" aria-label={`${board.members.length} board members`}>
      {board.members.slice(0, 4).map(member => <i key={member.id} title={member.name} style={{ background: member.color }}>{member.initials}</i>)}
      {board.members.length > 4 && <i>+{board.members.length - 4}</i>}
    </span>
  );
}

function BoardView({ board, cards, draggedCard, setDraggedCard, moveCard, openCard, addCard, addList, updateBoard }: { board: ProjectBoard; cards: ProjectCard[]; draggedCard: string; setDraggedCard: (id: string) => void; moveCard: (cardId: string, listId: string) => void; openCard: (id: string) => void; addCard: (listId: string) => void; addList: () => void; updateBoard: (updater: (board: ProjectBoard) => ProjectBoard) => void }) {
  const lists = [...board.lists].sort((a, b) => a.order - b.order);
  return (
    <div className="kanban-scroll">
      <div className="kanban-board">
        {lists.map(list => {
          const listCards = cards.filter(card => card.listId === list.id).sort((a, b) => a.order - b.order);
          return (
            <section className={`kanban-list ${list.collapsed ? "collapsed" : ""}`} key={list.id} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedCard) moveCard(draggedCard, list.id); setDraggedCard(""); }}>
              <header>
                <i style={{ background: list.color }} />
                <b>{list.title}</b>
                <span>{listCards.length}{list.limit ? `/${list.limit}` : ""}</span>
                <button aria-label={`Collapse ${list.title}`} onClick={() => updateBoard(current => ({ ...current, lists: current.lists.map(item => item.id === list.id ? { ...item, collapsed: !item.collapsed } : item) }))}>{list.collapsed ? "›" : "•••"}</button>
              </header>
              {!list.collapsed && (
                <>
                  <div className="kanban-cards">
                    {listCards.map(card => <ProjectCardTile key={card.id} card={card} board={board} open={() => openCard(card.id)} drag={() => setDraggedCard(card.id)} />)}
                  </div>
                  <button className="add-card" onClick={() => addCard(list.id)}>＋ Add a card</button>
                </>
              )}
            </section>
          );
        })}
        <button className="add-list" onClick={addList}>＋ Add another list</button>
      </div>
    </div>
  );
}

function ProjectCardTile({ card, board, open, drag }: { card: ProjectCard; board: ProjectBoard; open: () => void; drag: () => void }) {
  const progress = completion(card);
  return (
    <button type="button" className={`project-card priority-${card.priority.toLowerCase()} ${cardDateTone(card)}`} draggable onDragStart={drag} onClick={open}>
      <div className="card-cover" style={{ background: card.cover || "transparent" }} />
      {card.labels.length > 0 && (
        <div className="card-labels">
          {card.labels.map(id => {
            const label = board.labels.find(item => item.id === id);
            return label && <span key={id} title={label.name} style={{ background: label.color }}>{label.name}</span>;
          })}
        </div>
      )}
      <h3>{card.title}</h3>
      <div className="card-meta">
        {card.dueDate && <span className="due-chip"><i><SvgIcon name="calendar" size={10} /></i> {card.dueDate.slice(5)}</span>}
        {card.description && <span title="Has description">≡</span>}
        {card.comments.length > 0 && <span><i><SvgIcon name="chat" size={10} /></i> {card.comments.length}</span>}
        {card.attachments.length > 0 && <span><i><SvgIcon name="documents" size={10} /></i> {card.attachments.length}</span>}
        {progress > 0 && <span className={progress === 100 ? "complete" : ""}>✓ {progress}%</span>}
      </div>
      <footer>
        <span className="priority-chip">{card.priority}</span>
        <span className="member-stack">
          {card.members.slice(0, 3).map(id => {
            const member = board.members.find(item => item.id === id);
            return member && <i key={id} title={member.name} style={{ background: member.color }}>{member.initials}</i>;
          })}
        </span>
      </footer>
    </button>
  );
}

function TableView({ board, cards, openCard }: { board: ProjectBoard; cards: ProjectCard[]; openCard: (id: string) => void }) {
  return (
    <section className="project-table-wrap">
      <table className="project-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>List</th>
            <th>Members</th>
            <th>Labels</th>
            <th>Priority</th>
            <th>Due date</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {cards.map(card => (
            <tr key={card.id} onClick={() => openCard(card.id)}>
              <td><b>{card.title}</b><small>{card.id}</small></td>
              <td>{board.lists.find(list => list.id === card.listId)?.title}</td>
              <td><span className="member-stack">{card.members.map(id => { const member = board.members.find(item => item.id === id); return member && <i key={id} style={{ background: member.color }}>{member.initials}</i>; })}</span></td>
              <td>{card.labels.map(id => board.labels.find(label => label.id === id)?.name).filter(Boolean).join(", ")}</td>
              <td><StatusPill value={card.priority} /></td>
              <td>{card.dueDate || "—"}</td>
              <td>{completion(card)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CalendarView({ board, cards, openCard }: { board: ProjectBoard; cards: ProjectCard[]; openCard: (id: string) => void }) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date("2026-08-10T12:00:00");
    date.setDate(date.getDate() + index);
    return date;
  });
  return (
    <div className="project-calendar">
      <header>
        <button>‹</button>
        <h2>August 2026</h2>
        <button>›</button>
      </header>
      <div className="project-calendar-grid">
        {days.map(day => {
          const value = day.toISOString().slice(0, 10);
          return (
            <section key={value} className={value === today ? "today" : ""}>
              <time>{day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</time>
              {cards.filter(card => card.dueDate === value).map(card => (
                <button key={card.id} onClick={() => openCard(card.id)} style={{ borderLeftColor: board.labels.find(label => label.id === card.labels[0])?.color || "#007eae" }}>
                  {card.title}
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ board, cards, openCard }: { board: ProjectBoard; cards: ProjectCard[]; openCard: (id: string) => void }) {
  return (
    <div className="project-timeline">
      <header>
        <span>Card</span>
        {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(day => <b key={day}>{day}</b>)}
      </header>
      {cards.filter(card => card.startDate && card.dueDate).map(card => {
        const start = Math.max(0, Number(card.startDate.slice(-2)) - 10);
        const end = Math.min(13, Number(card.dueDate.slice(-2)) - 10);
        return (
          <div key={card.id}>
            <button onClick={() => openCard(card.id)}>{card.title}</button>
            <span style={{ gridColumn: `${start + 2} / ${end + 3}`, background: card.cover || "#007eae" }}>
              {board.lists.find(list => list.id === card.listId)?.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardView({ board, cards }: { board: ProjectBoard; cards: ProjectCard[] }) {
  const byList = board.lists.map(list => ({ name: list.title, count: cards.filter(card => card.listId === list.id).length, color: list.color }));
  const overdue = cards.filter(card => cardDateTone(card) === "late").length;
  const complete = cards.filter(card => card.dueComplete).length;
  return (
    <div className="project-dashboard">
      <div className="project-kpis">
        <section className="card"><b>{cards.length}</b><small>Total cards</small></section>
        <section className="card"><b>{cards.length - complete}</b><small>Open</small></section>
        <section className="card"><b>{complete}</b><small>Complete</small></section>
        <section className="card"><b>{overdue}</b><small>Overdue</small></section>
      </div>
      <section className="card chart-card">
        <h2>Cards by list</h2>
        <div className="project-bars">
          {byList.map(item => (
            <div key={item.name}>
              <span>{item.name}</span>
              <i><b style={{ width: `${Math.max(6, item.count / Math.max(1, cards.length) * 100)}%`, background: item.color }} /></i>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="card chart-card">
        <h2>Work by member</h2>
        <div className="member-work">
          {board.members.map(member => (
            <div key={member.id}>
              <i style={{ background: member.color }}>{member.initials}</i>
              <span><b>{member.name}</b><small>{cards.filter(card => card.members.includes(member.id)).length} cards</small></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActivityView({ board }: { board: ProjectBoard }) {
  const activity = board.cards.flatMap(card => card.activity.map(item => ({ ...item, card: card.title })));
  return (
    <section className="card project-activity">
      <h2>Board activity</h2>
      {activity.length ? (
        activity.map(item => (
          <article key={item.id}>
            <i>{initials(item.actor)}</i>
            <span><b>{item.actor}</b> {item.action}<small>{item.card} · {item.time}</small></span>
          </article>
        ))
      ) : (
        <EmptyState title="No activity yet" text="Card changes will appear here." />
      )}
    </section>
  );
}

function CardDetails({ card, board, state, updateBoard, close, notify, updateState }: { card: ProjectCard; board: ProjectBoard; state: PortalState; updateBoard: (updater: (board: ProjectBoard) => ProjectBoard) => void; close: () => void; notify: Notify; updateState: UpdatePortal }) {
  const [tab, setTab] = useState("Details");
  const [comment, setComment] = useState("");
  const [checkItem, setCheckItem] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const change = (values: Partial<ProjectCard>, action = "updated this card") => updateBoard(current => ({
    ...current,
    cards: current.cards.map(item => item.id === card.id ? { ...item, ...values, activity: [{ id: makeId("ACT"), actor: "Muneeb Rizwan", action, time: "Just now" }, ...item.activity] } : item),
  }));

  const addComment = () => {
    if (!comment.trim()) return;
    change({ comments: [...card.comments, { id: makeId("COM"), author: "Muneeb Rizwan", initials: "MR", text: comment.trim(), createdAt: "Just now" }] }, "commented");
    setComment("");
  };

  const addCheck = () => {
    if (!checkItem.trim()) return;
    const lists = card.checklists.length
      ? card.checklists.map((list, index) => index ? list : { ...list, items: [...list.items, { id: makeId("CI"), text: checkItem.trim(), complete: false }] })
      : [{ id: makeId("CHK"), title: "Checklist", items: [{ id: makeId("CI"), text: checkItem.trim(), complete: false }] }];
    change({ checklists: lists });
    setCheckItem("");
  };

  const addAttachment = () => {
    if (!attachmentName.trim() || !attachmentUrl.trim()) return;
    change({ attachments: [...card.attachments, { id: makeId("ATT"), name: attachmentName.trim(), url: attachmentUrl.trim(), source: attachmentUrl.includes("drive.google") ? "Google Drive" : "Link", addedBy: "Muneeb Rizwan", addedAt: "Just now" }] }, "attached a file");
    setAttachmentName("");
    setAttachmentUrl("");
  };

  const syncCalendar = async () => {
    if (!state.adminSettings.projectGoogleCalendar) return notify("Google Calendar is disabled for projects by an administrator");
    if (!card.dueDate) return notify("Add a due date first");
    if (!state.adminSettings.googleConnected) { window.location.assign("/api/auth/google/start"); return; }
    try {
      const guests = board.members.filter(member => card.members.includes(member.id)).map(member => member.email);
      const response = await fetch("/api/google/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: card.title,
          date: card.dueDate,
          start: "09:00",
          end: "09:30",
          location: "Project deadline",
          notes: `${board.title}\n\n${card.description}`,
          guests,
          meet: false,
          timeZone: state.profile.timezone,
        }),
      });
      const result = await response.json() as { id?: string; htmlLink?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Google Calendar event could not be created");
      updateState(current => ({
        ...current,
        events: [
          ...current.events.filter(event => event.id !== `PROJECT-${card.id}`),
          { id: `PROJECT-${card.id}`, googleId: result.id, webLink: result.htmlLink, title: card.title, date: card.dueDate, start: "09:00", end: "09:30", location: "Project deadline", meet: false, guests, notes: card.description },
        ],
      }));
      notify("Card deadline added to Google Calendar");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Google Calendar event could not be created");
    }
  };

  return (
    <Modal title={card.title} eyebrow={`${board.title.toUpperCase()} · ${board.lists.find(list => list.id === card.listId)?.title || "CARD"}`} close={close} className="project-card-modal">
      <div className="card-detail-tabs">
        {["Details", "Checklist", "Attachments", "Comments", "Activity"].map(item => (
          <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>
            {item}{item === "Comments" && ` ${card.comments.length}`}
          </button>
        ))}
      </div>
      {tab === "Details" && (
        <div className="card-detail-layout">
          <div className="card-detail-main">
            <label>Title<input value={card.title} onChange={event => change({ title: event.target.value }, "renamed this card")} /></label>
            <label>Description<textarea value={card.description} onChange={event => change({ description: event.target.value })} placeholder="Add a more detailed description" /></label>
            <div className="detail-form-grid">
              <label>List<select value={card.listId} onChange={event => change({ listId: event.target.value }, "moved this card")}>{board.lists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
              <label>Priority<select value={card.priority} onChange={event => change({ priority: event.target.value as ProjectCard["priority"] })}>{["Low", "Normal", "High", "Urgent"].map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Start date<input type="date" value={card.startDate} onChange={event => change({ startDate: event.target.value })} /></label>
              <label>Due date<input type="date" value={card.dueDate} onChange={event => change({ dueDate: event.target.value })} /></label>
              <label>Estimate<input value={card.estimate} onChange={event => change({ estimate: event.target.value })} /></label>
              <label className="check-row"><input type="checkbox" checked={card.dueComplete} onChange={event => change({ dueComplete: event.target.checked }, event.target.checked ? "completed this card" : "reopened this card")} /> Due complete</label>
            </div>
            <section className="card-subsection">
              <h3>Members</h3>
              <div className="choice-chips">
                {board.members.map(member => (
                  <button className={card.members.includes(member.id) ? "active" : ""} key={member.id} onClick={() => change({ members: card.members.includes(member.id) ? card.members.filter(id => id !== member.id) : [...card.members, member.id] })}>
                    <i style={{ background: member.color }}>{member.initials}</i>
                    {member.name}
                  </button>
                ))}
              </div>
            </section>
            <section className="card-subsection">
              <h3>Labels</h3>
              <div className="choice-chips labels">
                {board.labels.map(label => (
                  <button className={card.labels.includes(label.id) ? "active" : ""} key={label.id} style={{ borderColor: label.color }} onClick={() => change({ labels: card.labels.includes(label.id) ? card.labels.filter(id => id !== label.id) : [...card.labels, label.id] })}>
                    <i style={{ background: label.color }} />
                    {label.name}
                  </button>
                ))}
              </div>
            </section>
            <section className="card-subsection">
              <h3>Custom fields</h3>
              <div className="custom-field-grid">
                {Object.entries(card.customFields).map(([key, value]) => (
                  <label key={key}>{key}<input value={value} onChange={event => change({ customFields: { ...card.customFields, [key]: event.target.value } })} /></label>
                ))}
              </div>
            </section>
          </div>
          <aside className="card-detail-actions">
            <button onClick={syncCalendar}><i><SvgIcon name="calendar" size={14} /></i> Add to Calendar</button>
            <button onClick={() => setTab("Attachments")}><i><SvgIcon name="documents" size={14} /></i> Attach from Drive</button>
            <button onClick={() => change({ watching: !card.watching })}>{card.watching ? "◉ Watching" : "○ Watch"}</button>
            <button onClick={() => { const copy = { ...card, id: makeId("CARD"), title: `${card.title} (copy)`, order: board.cards.length, comments: [], activity: [] }; updateBoard(current => ({ ...current, cards: [...current.cards, copy] })); notify("Card copied"); }}><i><SvgIcon name="tasks" size={14} /></i> Copy card</button>
            <button onClick={() => change({ archived: !card.archived }, card.archived ? "restored this card" : "archived this card")}>{card.archived ? "Restore card" : "Archive card"}</button>
          </aside>
        </div>
      )}
      {tab === "Checklist" && (
        <div className="checklist-panel">
          {card.checklists.map(list => (
            <section key={list.id}>
              <header><h3>✓ {list.title}</h3><b>{completion(card)}%</b></header>
              <progress value={completion(card)} max="100" />
              {list.items.map(item => (
                <label key={item.id}>
                  <input type="checkbox" checked={item.complete} onChange={() => change({ checklists: card.checklists.map(checklist => checklist.id === list.id ? { ...checklist, items: checklist.items.map(value => value.id === item.id ? { ...value, complete: !value.complete } : value) } : checklist) }, item.complete ? "reopened a checklist item" : "completed a checklist item")} />
                  <span>{item.text}</span>
                  {item.dueDate && <small>{item.dueDate}</small>}
                </label>
              ))}
            </section>
          ))}
          <div className="inline-add">
            <input value={checkItem} onChange={event => setCheckItem(event.target.value)} onKeyDown={event => event.key === "Enter" && addCheck()} placeholder="Add an item" />
            <button onClick={addCheck}>Add</button>
          </div>
        </div>
      )}
      {tab === "Attachments" && (
        <div className="attachment-panel">
          <div className="attachment-add">
            <input value={attachmentName} onChange={event => setAttachmentName(event.target.value)} placeholder="File or link name" />
            <input value={attachmentUrl} onChange={event => setAttachmentUrl(event.target.value)} placeholder="Google Drive or web link" />
            <button className="primary" onClick={addAttachment}>Attach</button>
          </div>
          {card.attachments.map(item => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
              <i><SvgIcon name="documents" size={14} /></i>
              <span><b>{item.name}</b><small>{item.source} · {item.addedBy} · {item.addedAt}</small></span>
            </a>
          ))}
        </div>
      )}
      {tab === "Comments" && (
        <div className="comment-panel">
          <div className="comment-compose">
            <i>MR</i>
            <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Write a comment…" />
            <button className="primary" onClick={addComment}>Comment</button>
          </div>
          {[...card.comments].reverse().map(item => (
            <article key={item.id}>
              <i>{item.initials}</i>
              <div>
                <header><b>{item.author}</b><small>{item.createdAt}</small></header>
                <p>{item.text}</p>
                {item.reactions?.map(reaction => <button key={reaction}>{reaction}</button>)}
              </div>
            </article>
          ))}
        </div>
      )}
      {tab === "Activity" && (
        <div className="activity-panel">
          {card.activity.map(item => (
            <article key={item.id}>
              <i>{initials(item.actor)}</i>
              <span><b>{item.actor}</b> {item.action}<small>{item.time}</small></span>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}

function NewCardModal({ board, listId, updateBoard, close, notify }: { board: ProjectBoard; listId: string; updateBoard: (updater: (board: ProjectBoard) => ProjectBoard) => void; close: () => void; notify: Notify }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const submit = () => {
    if (!title.trim()) return;
    const card: ProjectCard = {
      id: makeId("CARD"),
      title: title.trim(),
      description,
      listId,
      order: board.cards.filter(item => item.listId === listId).length,
      members: [],
      labels: [],
      startDate: "",
      dueDate,
      dueComplete: false,
      priority: "Normal",
      estimate: "",
      checklists: [],
      attachments: [],
      comments: [],
      activity: [{ id: makeId("ACT"), actor: "Muneeb Rizwan", action: "created this card", time: "Just now" }],
      customFields: { Team: "", Sprint: "", Risk: "" },
      cover: "",
      watching: false,
      archived: false,
      createdBy: "Muneeb Rizwan",
      createdAt: "Just now",
    };
    updateBoard(current => ({ ...current, cards: [...current.cards, card] }));
    close();
    notify("Card created");
  };

  return (
    <Modal title="Create card" eyebrow={board.lists.find(list => list.id === listId)?.title.toUpperCase()} close={close}>
      <div className="create-form">
        <label>Card title<input data-initial-focus value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label>Due date<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
        <div className="modal-actions">
          <button className="secondary" onClick={close}>Cancel</button>
          <button className="primary" onClick={submit}>Create card</button>
        </div>
      </div>
    </Modal>
  );
}

function NewListModal({ board, updateBoard, close }: { board: ProjectBoard; updateBoard: (updater: (board: ProjectBoard) => ProjectBoard) => void; close: () => void }) {
  const [title, setTitle] = useState("");
  const [limit, setLimit] = useState("0");
  const submit = () => {
    if (!title.trim()) return;
    const list: ProjectList = { id: makeId("LIST"), title: title.trim(), order: board.lists.length, color: "#75838a", limit: Number(limit) || 0 };
    updateBoard(current => ({ ...current, lists: [...current.lists, list] }));
    close();
  };

  return (
    <Modal title="Add list" eyebrow="BOARD STRUCTURE" close={close}>
      <div className="create-form">
        <label>List name<input data-initial-focus value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Work-in-progress limit<input inputMode="numeric" value={limit} onChange={event => setLimit(event.target.value)} /></label>
        <div className="modal-actions">
          <button className="secondary" onClick={close}>Cancel</button>
          <button className="primary" onClick={submit}>Add list</button>
        </div>
      </div>
    </Modal>
  );
}

function NewBoardModal({ templates, state, updateState, close, openBoard }: { templates: ProjectTemplate[]; state: PortalState; updateState: UpdatePortal; close: () => void; openBoard: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState("ocean");
  const [visibility, setVisibility] = useState<ProjectBoard["visibility"]>("Workspace");
  const submit = () => {
    if (!title.trim()) return;
    const id = makeId("BOARD");
    const board: ProjectBoard = {
      id,
      title: title.trim(),
      description,
      visibility,
      starred: false,
      background,
      members: [{ id: "MEM-MR", name: state.profile.name, initials: initials(state.profile.name), email: state.profile.email, color: "#007eae" }],
      labels: defaultLabels(),
      lists: ["To do", "In progress", "Done"].map((name, index) => ({ id: `${id}-LIST-${index}`, title: name, order: index, color: index === 2 ? "#168a58" : "#75838a", limit: 0 })),
      cards: [],
      createdAt: "Just now",
      updatedAt: "Just now",
      calendarSync: false,
      driveFolder: "",
      archived: false,
    };
    updateState(current => ({ ...current, projectBoards: [board, ...current.projectBoards] }));
    close();
    openBoard(id);
  };

  return (
    <Modal title="Create a board" eyebrow="NEW PROJECT" close={close} className="medium-modal">
      <div className="board-preview" style={{ background: boardColors[background] }}><b>{title || "Board title"}</b></div>
      <div className="create-form">
        <label>Board title<input data-initial-focus value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label>Visibility<select value={visibility} onChange={event => setVisibility(event.target.value as ProjectBoard["visibility"])}><option>Private</option><option>Workspace</option><option>Public</option></select></label>
        <label>Background<div className="background-choices">{Object.keys(boardColors).map(color => <button className={background === color ? "active" : ""} key={color} style={{ background: boardColors[color] }} onClick={() => setBackground(color)} aria-label={color} />)}</div></label>
        <small>Or start from one of {templates.length} templates on the Projects page.</small>
        <div className="modal-actions">
          <button className="secondary" onClick={close}>Cancel</button>
          <button className="primary" onClick={submit}>Create board</button>
        </div>
      </div>
    </Modal>
  );
}

function AutomationCenter({ board, automations, updateState, close, notify }: { board: ProjectBoard; automations: ProjectAutomation[]; updateState: UpdatePortal; close: () => void; notify: Notify }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [triggerValue, setTriggerValue] = useState(board.lists[0]?.id || "");
  const [action, setAction] = useState<ProjectAutomation["action"]>("Mark due complete");
  const [actionValue, setActionValue] = useState("");
  const create = () => {
    if (!name.trim()) return;
    updateState(current => ({ ...current, projectAutomations: [...current.projectAutomations, { id: makeId("AUTO"), boardId: board.id, name: name.trim(), enabled: true, trigger: "Card moved", triggerValue, action, actionValue, runs: 0 }] }));
    setCreating(false);
    setName("");
    notify("Automation created");
  };

  return (
    <Modal title="Automation" eyebrow="RULES, BUTTONS AND SCHEDULES" close={close} className="medium-modal">
      <div className="automation-summary">
        <span><b>{automations.filter(item => item.enabled).length}</b> active rules</span>
        <span><b>{automations.reduce((sum, item) => sum + item.runs, 0)}</b> actions completed</span>
        <button className="primary" onClick={() => setCreating(true)}>＋ Create rule</button>
      </div>
      {creating && (
        <section className="automation-builder">
          <h3>When a card is moved…</h3>
          <label>Rule name<input value={name} onChange={event => setName(event.target.value)} /></label>
          <label>To list<select value={triggerValue} onChange={event => setTriggerValue(event.target.value)}>{board.lists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
          <label>Then<select value={action} onChange={event => setAction(event.target.value as ProjectAutomation["action"])}>{["Mark due complete", "Add label", "Assign member", "Move card", "Post comment"].map(value => <option key={value}>{value}</option>)}</select></label>
          {action !== "Mark due complete" && (
            <label>Value<select value={actionValue} onChange={event => setActionValue(event.target.value)}>{action === "Add label" ? board.labels.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : action === "Assign member" ? board.members.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : action === "Move card" ? board.lists.map(item => <option key={item.id} value={item.id}>{item.title}</option>) : <option>Automation completed this step.</option>}</select></label>
          )}
          <div className="card-actions">
            <button className="secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="primary" onClick={create}>Save rule</button>
          </div>
        </section>
      )}
      <div className="automation-list">
        {automations.map(rule => (
          <article key={rule.id}>
            <i>⚡</i>
            <span><b>{rule.name}</b><small>When moved to {board.lists.find(list => list.id === rule.triggerValue)?.title}, {rule.action.toLowerCase()} · {rule.runs} runs</small></span>
            <Toggle title="Enabled" description="" checked={rule.enabled} onChange={enabled => updateState(current => ({ ...current, projectAutomations: current.projectAutomations.map(item => item.id === rule.id ? { ...item, enabled } : item) }))} />
          </article>
        ))}
      </div>
    </Modal>
  );
}

function BoardSettings({ board, updateBoard, close, exportBoard, notify }: { board: ProjectBoard; updateBoard: (updater: (board: ProjectBoard) => ProjectBoard) => void; close: () => void; exportBoard: () => void; notify: Notify }) {
  return (
    <Modal title="Board settings" eyebrow="PROJECT ADMINISTRATION" close={close} className="medium-modal">
      <div className="create-form">
        <label>Board name<input value={board.title} onChange={event => updateBoard(current => ({ ...current, title: event.target.value }))} /></label>
        <label>Description<textarea value={board.description} onChange={event => updateBoard(current => ({ ...current, description: event.target.value }))} /></label>
        <label>Visibility<select value={board.visibility} onChange={event => updateBoard(current => ({ ...current, visibility: event.target.value as ProjectBoard["visibility"] }))}><option>Private</option><option>Workspace</option><option>Public</option></select></label>
        <label>Google Drive folder<input value={board.driveFolder} onChange={event => updateBoard(current => ({ ...current, driveFolder: event.target.value }))} /></label>
        <Toggle title="Calendar sync" description="Show card deadlines in the project calendar." checked={board.calendarSync} onChange={calendarSync => updateBoard(current => ({ ...current, calendarSync }))} />
        <div className="card-actions">
          <button className="secondary" onClick={exportBoard}>Export JSON</button>
          <button className="secondary" onClick={() => { updateBoard(current => ({ ...current, archived: true })); notify("Board archived"); close(); }}>Archive board</button>
          <button className="primary" onClick={() => { notify("Board settings saved"); close(); }}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

function applyRule(card: ProjectCard, rule: ProjectAutomation): ProjectCard {
  if (rule.action === "Mark due complete") return { ...card, dueComplete: true };
  if (rule.action === "Add label" && rule.actionValue) return { ...card, labels: [...new Set([...card.labels, rule.actionValue])] };
  if (rule.action === "Assign member" && rule.actionValue) return { ...card, members: [...new Set([...card.members, rule.actionValue])] };
  if (rule.action === "Move card" && rule.actionValue) return { ...card, listId: rule.actionValue };
  if (rule.action === "Post comment") return { ...card, comments: [...card.comments, { id: makeId("COM"), author: "Automation", initials: "⚡", text: rule.actionValue || "Automation completed this step.", createdAt: "Just now" }] };
  return card;
}

const defaultLabels = () => [
  { id: makeId("LBL"), name: "Priority", color: "#bd3038" },
  { id: makeId("LBL"), name: "Operations", color: "#168a58" },
  { id: makeId("LBL"), name: "Marketing", color: "#d76b16" },
  { id: makeId("LBL"), name: "Technology", color: "#007eae" },
];

const initials = (name: string) => name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();

const viewIconName = (view: View) => {
  switch (view) {
    case "Board": return "projects";
    case "Table": return "tasks";
    case "Calendar": return "calendar";
    case "Timeline": return "link";
    case "Dashboard": return "operations";
    case "Activity": return "bell";
    default: return "projects";
  }
};
