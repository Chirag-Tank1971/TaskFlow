# TaskFlow Client

React frontend for **TaskFlow**, a lead-calling and task distribution platform for call-centre teams.
Managers import and assign leads and watch performance. Agents work their queue, log calls and schedule
callbacks. Everyone gets an AI assistant that answers from the company's own documents.

**Backend:** [TaskFlow_Server](https://github.com/Chirag-Tank1971/TaskFlow_Server) (Express, MongoDB, Chroma Cloud, Gemini)

---

## Features

### For admins and managers
- **Dashboard:** task and agent statistics, category and status charts, recently distributed tasks.
- **Tasks:** search and filter every task; create, edit and reassign; bulk status changes, reassignment and delete.
- **Agents:** add, update and remove agents, and set their availability.
- **Upload Tasks:** CSV import (`FirstName, Phone, Notes`) with live progress. Tasks are categorized by AI and spread across agents automatically.
- **Analytics:** trends, distribution per agent and performance charts.
- **Activity:** the full audit log (who changed what, and when), filterable by action, role, customer and date.
- **Knowledge:** upload PDF, DOCX, TXT or Markdown documents for the AI to answer from. Choose who sees answers from each one (everyone, or managers only), track indexing status, and review **unanswered questions** to spot gaps in the documentation.

### For agents
- **Agent dashboard:** personal queue, completion rate, and a banner for callbacks due now or coming up next.
- **My Tasks:** grid or list view, filters by category and status, and a **Callbacks** view sorted soonest first.
- **Log Call:** one click to record the outcome (no answer, busy, call back, interested, converted, not interested, wrong number) and a note. Callbacks are scheduled with quick presets. Outcomes update the task's status automatically.
- **Task details:** full **History** timeline, **Calls** list, and **✨ Call Assist**: AI talking points, likely objections and a next best action, with sources.

### TaskFlow AI assistant (every page)
- **Floating launcher (bottom left):** a round ✨ button that slides open to "Ask TaskFlow AI" on hover. It also peeks open 5 seconds after login, then at random intervals.
- **Knowledge Base mode (everyone):** answers come *only* from uploaded documents, rendered as Markdown with clickable citation badges linked to their sources.
- **Your Data mode (admins and managers):** plain-English questions like *"show urgent tasks"* or *"who has the most open tasks?"* return sortable tables. Clicking a task row opens its details. It's read-only by design.
- **The conversation is kept** across page navigation and refreshes in the same browser tab, and cleared on logout.

---

## Tech stack

| Area | Technology |
|---|---|
| Framework / build | React 19, Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 (+ `@tailwindcss/forms`), custom CSS animations |
| HTTP | Axios (cookie-based session, `withCredentials`) |
| Charts | Recharts |
| UI | lucide-react icons, react-toastify, framer-motion |
| AI answer rendering | react-markdown + remark-gfm |

---

## How it talks to the backend

The app calls **`/api/...` on its own origin** and never a hard-coded backend URL:

| Environment | Where `/api` requests go |
|---|---|
| Local development | The Vite dev server forwards `/api` → `http://localhost:5000` (`vite.config.js`) |
| Production (Vercel) | `vercel.json` rewrites `/api/*` → the Render backend |

The browser therefore sees a single site, so the HttpOnly session cookie counts as **first-party**. That's
needed for login to work in browsers that block third-party cookies (Safari, Firefox, and some Chrome setups).
Nothing auth-related is stored in `localStorage`; the session is checked with `GET /api/auth/me` on load.

---

## Getting started

**Prerequisites:** Node.js **22.12+**, and the [backend](https://github.com/Chirag-Tank1971/TaskFlow_Server) running on port 5000.

```bash
git clone https://github.com/Chirag-Tank1971/TaskFlow_Client.git
cd TaskFlow_Client
npm install
npm run dev          # http://localhost:3000
```

No `.env` is needed for normal use. `VITE_API_URL` exists only to call a backend on a different origin
directly, which isn't recommended because of the cookie issue above (see [`.env.example`](.env.example)).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm start` | Vite dev server on port 3000, with `/api` forwarded to the backend |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Deployment (Vercel)

`vercel.json` configures everything, so dashboard settings don't matter:

- **Build settings:** framework `vite`, build command `npm run build`, output folder `dist`.
- **Rewrites:** `/api/*` goes to the Render backend, and every other path goes to `index.html`, so refreshing on a page like `/tasks` works.
- **Node version:** pinned via `"engines": { "node": ">=22.12.0" }` in `package.json`.

**Checklist**
1. Update the backend address in `vercel.json` if your Render URL changes.
2. In **Vercel → Settings → Environment Variables**, make sure `VITE_API_URL` / `REACT_APP_API_URL` are **not** set.
3. On the backend (Render), set **`ALLOWED_ORIGINS`** to your Vercel address, e.g. `https://your-app.vercel.app`. Otherwise login fails with *"CORS policy violation: Origin not allowed"*.

---

## Roles and pages

| Route | Page | Who |
|---|---|---|
| `/` · `/agent/login` | Admin / agent login | public |
| `/signup` · `/agent/signup` | Registration (admin signup only during first-time setup) | public |
| `/dashboard` | Operations dashboard | admin, manager |
| `/tasks` | All tasks | admin, manager |
| `/agents` | Agent management | admin, manager |
| `/upload` | CSV import | admin, manager |
| `/analytics` | Analytics | admin, manager |
| `/activity` | Audit log | admin, manager |
| `/knowledge` | Knowledge base documents and questions | admin, manager |
| `/agent/dashboard` | Agent home | agent |
| `/agent/tasks` | My tasks (`?view=callbacks` opens the callbacks view) | agent |

Roles come from the server-verified session only. The UI hides pages a role can't use, and the backend enforces the same rules.

---

## Project structure

```
TaskFlow_Client/
├── vercel.json                  # Vercel build config + /api rewrite + page fallback
├── vite.config.js               # Dev server on :3000, /api proxy to :5000
├── src/
│   ├── App.jsx                  # Routes; the TaskFlow AI panel mounted once, outside the routes
│   ├── index.css                # Tailwind, glass styles, launcher and modal animations
│   ├── config/api.js            # API base URL (same origin by default)
│   ├── context/AuthContext.jsx  # Session (cookie-based), roles, logout clean-up
│   ├── constants/               # Call outcomes, activity types (labels, colours, wording)
│   ├── pages/                   # Dashboard, AgentTasks, Agents, UploadCSV, Analytics,
│   │                            #   ActivityLog, KnowledgeBase, agent pages, login/signup
│   └── components/
│       ├── layout/              # AppLayout, Navbar
│       ├── tasks/               # TaskCard, TaskModal, TaskFormModal, LogCallModal, ActivityTimeline
│       ├── knowledge/           # AskPanel (the TaskFlow AI chat), AiLauncher, CallAssistPanel,
│       │                        #   CitedText (Markdown + citations), askPanelStorage
│       ├── data/DataResult.jsx  # Data-assistant result tables
│       └── common/              # StatCard, ConfirmModal
└── public/                      # Static files, including sample_tasks.csv (CSV template)
```

---

## Notes

- **Reduced motion:** if the operating system asks for reduced motion (e.g. Windows *Animation effects* off), the
  launcher's looping glow, shimmer and twinkle are disabled. The short open/close slide and the open-state glow remain.
- **AI assistant storage:** conversations live in `sessionStorage`, one per user. They're capped at 30 messages per
  mode and cleared on logout or when the tab closes.
- **CSV template:** `public/sample_tasks.csv`, downloadable from the Upload page.

---

## Author

**Chirag Tank** · GitHub [@Chirag-Tank1971](https://github.com/Chirag-Tank1971) · chiragtank1971@gmail.com
