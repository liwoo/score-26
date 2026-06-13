# Score26 ⚽

A play-for-fun **2026 FIFA World Cup** prediction game. Call the winner, the
scoreline, the scorers and the goal timeline for each match — then climb the
leaderboard against everyone else. Built as a phone-framed web app with a
tactile, cartoon "neo-brutalist" look.

> Up to **3 predictions per match** — the engine keeps your highest-scoring one.

---

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | React 19 + TypeScript |
| Build/dev      | Vite 8 |
| Routing        | React Router 7 (`createBrowserRouter`) |
| Server state   | TanStack Query 5 |
| Backend        | Supabase (Postgres + Auth + RLS) |
| Styling        | Tailwind CSS 4 (`@tailwindcss/vite`), custom theme in `src/index.css` |
| Animation      | Motion (`motion/react`) |
| Drag & drop    | `@dnd-kit/core` (timeline step) |
| Flags          | `country-flag-icons` |
| Squad data     | Scraped from Wikipedia (see [`scraper/`](#data--the-scraper)) |

---

## Quick start

Requires **Node 20+** and a Supabase project (for auth + squad/submission data).

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:5173
```

### Environment

Create `.env.local` with your Supabase credentials:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Without these, the app still renders but squads won't load and sign-in won't
work (you'll see a `Supabase env vars missing` warning in the console).

### Scripts

| Command           | Does |
| ----------------- | ---- |
| `npm run dev`     | Start the Vite dev server with HMR |
| `npm run build`   | Type-check (`tsc -b`) then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint`    | Run ESLint over the project |

---

## How the game works

1. **Home** (`/`) — the leaderboard (All-Time / Today / per-Match) and a
   `Start Predicting` CTA. A ⚙️ gear opens Settings.
2. **Pick a match** (`/matches`).
3. **Predict** (`/play/:matchId`) — a guided wizard, one step per screen:
   1. **Winner** — home win / away win / draw
   2. **Margin** — the scoreline
   3. **Opponent** — (draw branch) the other side's goals
   4. **Timeline** — drag goals into time buckets, pick scorers & assists
   5. **Stats** — possession & shots (used to judge goalless draws)
   6. **Submit** — review, sign in with Google, lock it in
4. **Done** (`/done`) — confetti and your attempt number.

Scoring rewards riskier calls (exact scorers, goal timings) more than the bare
outcome. The scoring engine itself is still a work in progress — point values in
`useSquad.ts` are placeholders.

### Settings (`/settings`)

- **Account** — sign up / log out; your profile (avatar, username, country).
- **My Sessions** — every match you've predicted on, with attempts used/left.
- **About** — Help & Support, Privacy Policy, Terms of Service.

---

## Project structure

```
src/
  main.tsx                 App entry: QueryClient → AuthProvider → Router
  router.tsx               All routes
  index.css                Tailwind theme tokens (colors, fonts, shadow-pop)
  App.tsx                  Shell — wraps every screen in the PhoneFrame

  pages/
    LandingPage.tsx        Home + leaderboard
    MatchSelectPage.tsx    Match picker
    DonePage.tsx           Post-submit celebration
    predict/               The 6-step prediction wizard
    settings/              Settings hub, Signup, Policy, Terms, Help

  features/
    auth/AuthProvider.tsx  Supabase auth + app profile context
    prediction/            Prediction wizard state (Context + layout)

  components/              Reusable UI (PopButton, Screen, Avatar, Flag,
                           PhoneFrame, InfoPage, GoalModal, …)

  data/                    Domain data + Supabase access
    worldCup2026.ts        Generated squad/fixture data (gitignored)
    teams.ts, matches.ts   Static team/fixture model built on top of it
    submissions.ts         Read/write predictions (submissions, *_goals)
    useSquad.ts            TanStack Query hook → Supabase `players`
    profile.ts             Countries, avatar seeds, MAX_PREDICTIONS
    leaderboard.ts         Leaderboard data

  lib/
    supabase.ts            Supabase client (reads VITE_ env vars)
    queryClient.ts         TanStack Query client
```

---

## Backend (Supabase)

The app talks to Supabase directly from the browser using the anon key, so
**Row Level Security must be enabled** on every table. Tables in use:

| Table              | Purpose |
| ------------------ | ------- |
| `profiles`         | One row per signed-in user (`email`, `username`, `avatar_seed`, `country_iso`). |
| `teams`            | World Cup teams (`fifa_code`, …). |
| `players`          | Squad members, joined to `teams`; powers `useSquad`. |
| `submissions`      | One row per prediction attempt (`email`, `match_id`, `attempt`, `outcome`, …). |
| `submission_goals` | Goal-level detail for a submission (`side`, `bucket`, scorer/assist). |

Auth is **Google OAuth** via Supabase. RLS is expected to constrain
`submissions`/`profiles` so a user can only write rows matching their
authenticated email.

---

## Data — the scraper

Squad data comes from a standalone tool in [`scraper/`](scraper/) that scrapes
the [2026 FIFA World Cup squads](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads)
from Wikipedia (48 squads × 26 players), enriched with player photos via the
MediaWiki API.

```bash
cd scraper
bun install
bun run scrape      # writes squads.json (+ cached HTML/photos)
```

The `scraper/` directory and the generated `src/data/worldCup2026.ts` are
**gitignored** — regenerate them locally (and load `squads.json` into Supabase)
rather than committing the large artifacts. See [`scraper/README.md`](scraper/README.md)
for the output schema and details.

> ⚠️ Because `src/data/worldCup2026.ts` is gitignored but imported by the app, a
> fresh clone needs it regenerated before `npm run build` will succeed.

---

## Design system

The look lives in `src/index.css` as Tailwind theme tokens:

- **Colors** — `ink` (the cartoon outline), `cream` (paper), and arcade accents
  (`grass`, `sun`, `coral`, `sky`, `grape`, `tangerine`, `bubble`).
- **Fonts** — `Lilita One` (display) and `Nunito` (body).
- **Signature shadow** — `.shadow-pop` / `-lg` / `-xl`: a hard offset shadow that
  collapses when a `PopButton` is pressed.

Build new screens with the `Screen` component (header + scroll body + footer) and
`PopButton` for the tactile buttons to stay consistent.
