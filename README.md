# Pulse

Pulse is a task manager that takes the breadth of TickTick (tasks + calendar + pomodoro + habits in one app) and pairs it with the calmness of Things 3 and the keyboard speed of Linear. Mobile-first responsive PWA.

It is being built standalone first and will plug into [TheEDGEx](https://theedgex.com) as the **Tasks** module via the `tasks.theedgex.com` subdomain, sharing the existing Supabase project for auth and data.

The full spec lives at `../tasks-module-spec.md`.

## Status

**M0 — scaffold complete.** Login (magic link + password), protected app shell, empty Today screen, sidebar nav, mobile bottom tab bar, EDGEx design tokens applied. DB migration for `lists`, `tasks`, `user_settings` ready to apply.

**M1 — core tasks complete.** Tasks layer with TanStack Query (today, leftovers, inbox queries + create/toggle/update/delete/bulk-reschedule mutations, optimistic completion). Natural-language quick-add (today, tomorrow, weekday names, "next monday", "in 3 days", clock times like "9am" or "15:00", !high/!med/!low priorities, #tag extraction). Task rows with circular priority-tinted checkbox, inline title edit, due/priority/tag chips. Today screen renders real data: pinned Leftovers section with bulk-action chips, morning intention, quick-add, scheduled vs. anytime grouping, "Done today" disclosure. Inbox renders untagged/unscheduled tasks. Global keyboard shortcuts: `n` quick-add overlay, `?` shortcut reference, `g i/t/u/h/c/f/s` vim-style jumps, `Esc` to dismiss.

**M2 — multi-list, tags, palette complete.** Migration 0002 adds `folders` and `tags` tables plus subtask indexes. Lists/folders data layer with fractional-indexing helper for drag-reorder. Sidebar renders real lists grouped under folders with inline-create (Enter to save, Esc to cancel), collapse toggle, active-route highlight. `/lists/[id]` renders list detail with header rename, color picker dot, view-mode toggle between list and board (kanban grouped by status), delete with confirm. `/lists` index page for the mobile tab. Tags get deterministic fallback colors and link out from task rows. `/tags` index shows usage counts; `/tags/[name]` filters tasks by tag. Cmd+K command palette: fuzzy task search by default, `/` for navigation commands and "new task", `#` for tag jumps, `@` for list jumps, arrow keys + Enter.

**M3 — calendar + recurrence + upcoming complete.** Virtual recurrence engine: RRULE-only template rows expand to in-memory instances for whatever date window is on screen; exception rows are materialized only when a recurring instance is completed, edited, or skipped. Upcoming view shows next 7 days as anchored buckets and a flat next-30-day list (empty days kept faint). Calendar shell with three view modes (day/week/month), prev/next/today toolbar, hour gutter with 15-minute snap grid, current-time line. Drag-to-schedule from a left-side "Unscheduled" rail; drag-to-reschedule between days; resize handle on event blocks for duration. Month view shows up to three colored badges per day with overflow indicator. Task Detail side-drawer with full editor: title, notes, list, priority pills, start/due datetime, tags, and a recurrence picker (preset pills + raw RRULE textbox). For virtual instances, the first edit transparently materializes the exception row.

**M4 — focus timer complete.** Migration 0003 adds ownership-safe relationship constraints, a concrete tag upsert conflict index, and `focus_sessions` with RLS. Focus screen now has Pomodoro/Flow/Custom modes, task linking, soft-suggestion overtime, strict-mode auto-stop, interruption logging, session notes, recent session history, and a last-7-days minutes chart. Settings includes Pomodoro defaults and strict mode. Today includes a compact focus-minutes stats card.

**M5 — habits complete.** Migration 0004 adds `habits` and `habit_logs` with RLS. Habits screen supports daily/weekdays/weekly/custom cadence, one-tap logging, archive, color selection, 90-day heatmaps, current/longest streak, and month completion rate. Today now surfaces habits due today and includes completed habit logs in the Done today disclosure.

**M6 — mobile polish + PWA complete.** Added app manifest, SVG app icon, service worker shell cache, offline fallback page, service-worker registration, online/offline sync banner, local offline queue for task creation, mobile bottom-tab polish, mobile scroll/tap refinements, and swipe gestures on task rows: swipe right to complete, swipe left to open details.

**M7 — v1 launch hardening complete.** Settings now covers appearance, accent, density, week start, work hours, default view, Pomodoro defaults, strict mode, shortcut reference, sign-out, and JSON data export. Runtime settings apply theme/accent/density in-app. Added an authenticated `/api/export` route for lists, folders, tags, tasks, habits, habit logs, focus sessions, and settings. Accessibility and launch hardening pass added reduced-motion support, stronger settings control semantics, a production-safe login Suspense boundary, and removed build-time Google Fonts fetching so offline/restricted builds are stable.

**Note on first install:** the scaffold was authored and statically reviewed inside the Cowork sandbox, where `npm install` was killed by the sandbox's memory ceiling before it could finish. The local `node_modules` copy is currently incomplete: package folders exist, but `.bin` shims and some transitive dependencies/types are missing. Run a clean `npm install` on your machine before full build verification.

**Next: M8+** — TheEDGEx subdomain handoff, shared-cookie auth verification on `.theedgex.com`, module card entrypoint, and a Work-module "today's tasks" widget.

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind · shadcn-style primitives · Supabase (Postgres + Auth + Realtime) · TanStack Query · Zustand · Framer Motion · Lucide. Hosted on Vercel.

## Setup

```bash
cd pulse
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_ANON_KEY from the EDGEx Supabase dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The middleware redirects unauthenticated requests to `/login`.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Already filled to `https://mdkyijbgvxedelcqcouu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Get from the EDGEx Supabase dashboard, **Settings → API** |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | only in production | Set to `.theedgex.com` so the auth cookie is shared with the other modules |

### Hostinger deployment check

Deploy Pulse as a Node/Next.js app from the `pulse` repo root, not as static files. In Hostinger, set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mdkyijbgvxedelcqcouu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon/publishable key>
NEXT_PUBLIC_COOKIE_DOMAIN=
```

Leave `NEXT_PUBLIC_COOKIE_DOMAIN` blank on Hostinger's temporary domain. Set it to `.theedgex.com` only after Pulse is running on the final EDGEx subdomain.

Use these commands:

```bash
npm install
npm run build
npm run start
```

The production build uses Next's standalone server output. Hostinger should start the app with `npm run start`, which runs `node server.js`. The root `server.js` normalizes Hostinger's socket-style `HOSTNAME` value before loading Next's standalone server.

After deployment, open `/api/health`. A healthy deployment returns `"ok": true`. If a required env var is missing, Pulse redirects app pages to `/deployment-error` instead of failing with an opaque 500.

### Apply the DB migration

The `tasks`, `lists`, and `user_settings` tables live in the shared EDGEx Postgres. Apply the migration once:

```bash
# Option A — Supabase CLI
npx supabase login
npx supabase link --project-ref mdkyijbgvxedelcqcouu
npx supabase db push

# Option B — copy/paste in the Supabase SQL editor
# Open supabase/migrations/0001_pulse_init.sql and run it in the dashboard.
```

The migrations are idempotent (use `if not exists` and `drop policy if exists`) so re-running them is safe.

## Project layout

```
pulse/
├── app/
│   ├── (app)/                  Authed surfaces (sidebar + tabbar layout)
│   │   ├── today/              Home screen
│   │   ├── inbox/ upcoming/ ...
│   │   └── layout.tsx          Auth-gated shell
│   ├── auth/
│   │   ├── callback/route.ts   OAuth/magic-link code exchange
│   │   └── signout/route.ts
│   ├── login/page.tsx
│   ├── layout.tsx              Root, fonts, providers
│   ├── providers.tsx           TanStack Query
│   └── globals.css             Tailwind + EDGEx tokens
├── components/
│   ├── app-shell/              SidebarNav, MobileTabBar, Placeholder
│   └── ui/                     Button, Input (shadcn-style)
├── lib/
│   ├── supabase/               browser, server, middleware clients
│   └── utils.ts                cn(), formatDateLong()
├── types/database.ts           Hand-written DB types (regen later)
├── supabase/migrations/        SQL migrations
├── middleware.ts               Auth redirect
├── tailwind.config.ts
├── next.config.mjs
└── tsconfig.json
```

## Cross-subdomain auth (production)

Pulse is designed to share a Supabase Auth session with the rest of TheEDGEx. The mechanism: cookies scoped to the parent domain.

1. Deploy Pulse to `tasks.theedgex.com` (Vercel custom domain).
2. Set `NEXT_PUBLIC_COOKIE_DOMAIN=.theedgex.com` in Vercel env.
3. In the Supabase dashboard, add `https://tasks.theedgex.com/auth/callback` to **Authentication → URL Configuration → Redirect URLs**.
4. Add `https://tasks.theedgex.com` and `https://theedgex.com` to **Site URL** allowed origins.

Once this is wired, signing in on either origin sets the auth cookie at `.theedgex.com` and the other origin picks it up automatically. The existing HTML modules (`work.html`, `goals.html`, etc.) read `sb_session` from `localStorage` — that path keeps working in parallel; the cookie is the bridge for Next.js.

## Reading from Pulse tables in HTML modules

Once the migration is applied, any TheEDGEx HTML module can read Pulse data through the same Supabase JS client it already uses. Example for `work.html`:

```js
const { data: tasksToday } = await supabase
  .from('tasks')
  .select('id, title, priority, start_at, duration_minutes')
  .gte('start_at', startOfDayISO)
  .lt('start_at', endOfDayISO)
  .is('deleted_at', null)
  .is('completed_at', null)
  .order('start_at', { ascending: true });
```

RLS scopes results to the signed-in user automatically. No service-role keys, no cross-module API.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server on `:3000` |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint (Next defaults + TypeScript) |
| `npm run type-check` | `tsc --noEmit`, no JS emit |

## Roadmap

Per the spec:

- **M0** scaffold ✅
- **M1** core tasks (week 2)
- **M2** multi-list, tags, subtasks, command palette (week 3)
- **M3** calendar + scheduling + recurrence (week 4)
- **M4** focus timer ✅
- **M5** habits ✅
- **M6** mobile polish + PWA ✅
- **M7** v1 launch ✅
- **M8+** TheEDGEx subdomain handoff
