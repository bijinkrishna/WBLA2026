# WBLA 2026 Election Activity Tracker
## District Election Office — Paschim Medinipur, West Bengal

A comprehensive election activity tracking system for the West Bengal Legislative Assembly Elections 2026. Designed for the District Election Officer to manage, monitor, and visualize activities across **13 cells** at the District Headquarters.

---

## Features

- **13 Election Cells** — Define and manage cells (General Admin, Electoral Roll, EVM, Security, etc.)
- **Activity Management** — Create activities under each cell with start/end dates, duration, priority, status
- **Sub-Activities** — Hierarchical activities with parent-child relationships
- **Dependencies** — Link activities so one must complete before another can start
- **Relative scheduling** — Schedule activities relative to Polling Day (P) or Counting Day (C), e.g. P-2, C-1
- **Progress Tracking** — Update progress (0–100%) with automatic status tracking and change logs
- **Gantt Chart** — Interactive timeline view with zoom (day/week/month), today marker, cell-wise grouping
- **Dashboard** — Overview with cell-wise progress, overdue alerts, upcoming activities
- **Filters & Search** — Filter by cell, status, priority; full-text search across activities

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + API)
- **Deployment:** Vercel (recommended)

---

## Quick Start

### 1. Clone & Install

```bash
cd election-tracker
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration files (in order):
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_activity_dependencies.sql
   supabase/migrations/003_election_relative_scheduling.sql
   ```
   The first creates all tables, views, triggers, and seeds the 13 election cells. The second adds activity dependency support. The third adds relative scheduling (P-2, C-1) and election settings.

3. Copy your project credentials:
   - Go to **Settings → API**
   - Copy `Project URL` and `anon/public` key

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Enable Email Auth in Supabase

1. Go to **Authentication → Providers** in your Supabase dashboard
2. Enable **Email** provider
3. (Optional) Disable **Confirm email** for easier local testing

### 5. Create a User

In **Authentication → Users**, click **Add user** → **Create new user** and set an email/password, or use **Sign up** from the login page.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page if not authenticated.

---

## Project Structure

```
src/
├── app/
│   ├── dashboard/page.tsx     # Main dashboard with stats & cell progress
│   ├── cells/page.tsx         # Cell management (CRUD)
│   ├── activities/            # Activity management with sub-activities
│   │   ├── page.tsx
│   │   └── ActivitiesContent.tsx
│   ├── gantt/page.tsx         # Interactive Gantt chart
│   ├── layout.tsx             # Root layout
│   ├── globals.css            # Global styles
│   └── page.tsx               # Redirect to dashboard
├── components/
│   ├── AppShell.tsx           # Main layout shell
│   ├── Sidebar.tsx            # Navigation sidebar
│   ├── ui/index.tsx           # Reusable UI components
│   ├── cells/CellForm.tsx     # Cell create/edit form
│   └── activities/ActivityForm.tsx  # Activity create/edit form
├── lib/
│   ├── supabase.ts            # Browser Supabase client
│   ├── supabase-server.ts     # Server Supabase client
│   ├── hooks.ts               # Data hooks (CRUD operations)
│   └── utils.ts               # Utilities and constants
├── types/
│   └── index.ts               # TypeScript type definitions
supabase/
└── migrations/
    └── 001_initial_schema.sql # Complete database schema + seed data
```

---

## Database Schema

### Tables
- **cells** — 13 election cells with metadata and color coding
- **activities** — Activities with hierarchical sub-activities support
- **activity_logs** — Automatic audit trail of progress/status changes

### Views
- **cell_progress_summary** — Aggregated progress per cell
- **gantt_data** — Flattened activity data for Gantt rendering

### Triggers
- Auto-update `updated_at` timestamps
- Auto-log progress and status changes

---

## Pre-seeded Cells

| # | Cell | Code | Focus |
|---|------|------|-------|
| 1 | General Administration & Coordination | GAC | Overall coordination |
| 2 | Electoral Roll & Voter ID | ERVID | Voter lists & EPIC |
| 3 | Polling Station & Infrastructure | PSI | Booth setup |
| 4 | EVM & VVPAT Management | EVM | Machine preparation |
| 5 | Law & Order / Security | SEC | Force deployment |
| 6 | Transport & Logistics | TL | Vehicle & routes |
| 7 | Communication & IT | CIT | IT systems |
| 8 | Training & Capacity Building | TCB | Personnel training |
| 9 | Media & MCMC | MCMC | Media monitoring |
| 10 | Expenditure Monitoring | EM | Spending oversight |
| 11 | Accessibility & Inclusion | AI | PwD & inclusion |
| 12 | Material Management & Supply | MMS | Material logistics |
| 13 | Counting & Result | CR | Counting process |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

---

## License

For official use by the District Election Office, Paschim Medinipur.
