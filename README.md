# Score26 ⚽

A play-for-fun **2026 FIFA World Cup** prediction game. Call the winner, the
scoreline, the scorers and the goal timeline for each match — then climb the
leaderboard against everyone else. Built as an installable, phone-framed web app
(PWA) with a tactile, cartoon "neo-brutalist" look.

> Up to **3 predictions per match** — the engine keeps your highest-scoring one.

---

## Tech stack

| Concern         | Choice |
| --------------- | ------ |
| Framework       | React 19 + TypeScript |
| Build/dev       | Vite 8 |
| Routing         | React Router 7 (`createBrowserRouter`) |
| Server state    | TanStack Query 5 |
| Backend         | Supabase (Postgres + Auth + RLS + Edge Functions) |
| Scoring/emails  | Supabase Edge Functions (Deno) + [Resend](https://resend.com) |
| Styling         | Tailwind CSS 4 (`@tailwindcss/vite`), custom theme in `src/index.css` |
| Animation       | Motion (`motion/react`) |
| Drag & drop     | `@dnd-kit/core` (timeline step) |
| Flags           | `country-flag-icons` |
| App shell       | PWA — web manifest + service worker, installable & fullscreen |
| Tests/scripts   | Bun (`bun test`, `bun run scripts/…`) |
| Hosting         | Vercel (SPA) + Supabase (functions) |

---

## Quick start

Requires **Node 20+** (Bun for tests/scripts) and a Supabase project.

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

Without these, the app still renders but squads/leaderboards won't load and
sign-in won't work (you'll see a `Supabase env vars missing` warning).

### Scripts

| Command           | Does |
| ----------------- | ---- |
| `npm run dev`     | Start the Vite dev server with HMR |
| `npm run build`   | Type-check (`tsc -b`) then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint`    | Run ESLint over the project |
| `bun test`        | Run the scoring engine unit + edge-parity tests |
| `bun run scripts/gen-fixtures-sql.ts` | Emit SQL to seed the DB `matches`/`teams` from the app's own fixtures |

The app version (`package.json` → `version`) is injected at build time as
`__APP_VERSION__` (shown in Settings).

---

## How the game works

1. **Home** (`/`) — the leaderboard (All-Time / Today / per-Match) and a
   `Start Predicting` CTA. ⚙️ opens Settings; a 📤 share button invites friends.
   First-timers get a **How to Play** modal.
2. **Pick a match** (`/matches`).
3. **Predict** (`/play/:matchId`) — a guided wizard, one step per screen:
   1. **Winner** — home win / away win / draw
   2. **Margin** — the scoreline
   3. **Opponent** — (draw branch) the other side's goals
   4. **Timeline** — drag goals into time buckets, pick scorers & assists
      (with a **Timeline guide** modal)
   5. **Stats** — possession & shots (used to judge goalless draws)
   6. **Submit** — review, sign in with Google, lock it in
4. **Done** (`/done`) — confetti and your attempt number.

### Settings (`/settings`)

- **Account** — sign up / log out; your profile (avatar, username, country).
- **My Sessions** — every match you've predicted on; tap through to a per-match
  **score breakdown** (`/settings/match/:matchId`).
- **Notifications** — opt in to full-time result push notifications.
- **Share** — native device share to invite friends.
- **About** — Help & Support, Privacy Policy, Terms of Service.
- **Admin** (admin account only) — enter match outcomes to trigger scoring.

### Routes

| Path | Screen |
| ---- | ------ |
| `/` | Home + leaderboard |
| `/matches` | Match picker |
| `/play/:matchId` → `margin` · `opponent` · `timeline` · `stats` · `submit` | Prediction wizard |
| `/done` | Post-submit celebration |
| `/settings` | Settings hub |
| `/settings/match/:matchId` | Per-match score breakdown |
| `/settings/signup` · `/policy` · `/terms` · `/help` | Account + info pages |
| `/settings/admin` · `/settings/admin/:matchId` | Admin result entry (gated) |

---

## Scoring

The scoring engine lives in [`src/lib/scoring.ts`](src/lib/scoring.ts) — **pure
and dependency-free**, so the exact same code runs in the app (to render a
breakdown), in Bun tests, and inside the Supabase edge function. Points per
submission, scored against the final result:

| Category | Points |
| -------- | -----: |
| Correct outcome (W/L/score-draw/goalless) | 5 |
| Correct total number of goals | 3 |
| Correct goal distribution (side-agnostic, e.g. 2–0 ≡ 0–2) | 5 |
| Exact scoreline | 10 |
| Each goal in the correct time bracket (per side) | 5 |
| Each goal's scorer | 5 |
| Each goal's assister | 5 |
| Possession within 5% / within 10% — *goalless draw only* | 10 / 5 |
| Total shots within 2 / within 4 per team — *goalless draw only* | 7 / 5 |
| **Perfect prediction** bonus | 50 |

The edge function ships a byte-identical copy of the engine (Deno can't import
from `src/`); [`scoring.parity.test.ts`](src/lib/scoring.parity.test.ts)
guarantees the copies never drift. If it fails, re-copy `src/lib/scoring.ts`
into `supabase/functions/score-match/`.

---

## Results & email pipeline (Supabase Edge Functions)

Functions live in [`supabase/functions/`](supabase/functions/) and run on Deno.
Secrets (`resend_api_key`, `app_base_url`, `email_from`) live in **Supabase
Vault**, read via a `service_role`-only `get_secret()` RPC.

- **`score-match`** — fired by an `AFTER` trigger on `match_outcomes` when the
  admin enters a result (jersey # + minute per goal). It resolves jerseys →
  player ids, mirrors the result into `match_results`/`result_goals` (what the
  app reads), scores **every** submission for the match, records progress in
  `match_outcomes.calculation_status`, then hands off to email.
- **`send-match-emails`** — once all submissions are scored, renders the
  game-styled result template per player (rank, medal, points, growth, next
  match) and sends via Resend, flipping `email_sent` per player.
- **`send-comeback-emails`** — re-engagement for lapsed players (predicted
  before, but missed the last 3 kicked-off matches). Pass
  `{ "preview_to": "you@example.com" }` to send a single example.

Email templates are HTML with `{{variable}}` substitution (Resend has no
conditionals — all branching is pre-computed into variables by the function).
The standalone source template also lives in [`emails/`](emails/).

Deploy with the Supabase CLI:

```bash
supabase functions deploy score-match
supabase functions deploy send-match-emails
supabase functions deploy send-comeback-emails
```

---

## Backend (Supabase)

The browser talks to Supabase with the anon key, so **Row Level Security must be
enabled on every table**. Core tables:

| Table | Purpose |
| ----- | ------- |
| `profiles` | One row per user (`email`, `username`, `avatar_seed`, `country_iso`). |
| `teams` | World Cup teams (`fifa_code`, flag, …). |
| `players` | Squad members joined to `teams`; powers `useSquad`. |
| `submissions` | One row per prediction attempt (`email`, `match_id`, `attempt`, `outcome`, …). |
| `submission_goals` | Goal-level detail for a submission (`side`, `bucket`, scorer/assist). |
| `match_outcomes` | Admin-entered final results; its trigger drives scoring. |
| `match_results` / `result_goals` | Normalised result the app reads back. |
| `leaderboard` | Computed standings by scope (`all` / `day` / `match`). |

Auth is **Google OAuth** via Supabase. RLS constrains `submissions`/`profiles`
to the authenticated email, and `match_outcomes` writes to the admin
(`auth.email() = ADMIN_EMAIL`, mirrored UI-side in
[`src/features/auth/admin.ts`](src/features/auth/admin.ts)).

---

## Data — fixtures & the scraper

Static team/fixture/stadium data lives in
[`src/data/worldCup2026.ts`](src/data/worldCup2026.ts) and is **committed** (a
build-time source dependency). `teams.ts`/`matches.ts` build the typed model on
top of it. `scripts/gen-fixtures-sql.ts` emits SQL to seed the DB `matches`/
`teams` tables from this same data (single source of truth).

Squad rosters come from a standalone tool in [`scraper/`](scraper/) that scrapes
the [2026 FIFA World Cup squads](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads)
from Wikipedia (48 squads × 26 players) plus player photos:

```bash
cd scraper && bun install && bun run scrape   # writes squads.json
```

The `scraper/` directory (its deps + large caches) is **gitignored**; load
`squads.json` into Supabase `players`. See [`scraper/README.md`](scraper/README.md).

---

## PWA

The app is installable and runs fullscreen. [`public/manifest.webmanifest`](public/manifest.webmanifest)
defines the icons/theme; [`public/sw.js`](public/sw.js) is a service worker
registered on boot by [`src/lib/pwa.ts`](src/lib/pwa.ts) (called from
`main.tsx`). Icons live in `public/icon-*.png`.

---

## Deployment

- **Frontend → Vercel.** [`vercel.json`](vercel.json) rewrites all routes to
  `index.html` (SPA). Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as
  Vercel env vars.
- **Edge functions → Supabase** (`supabase functions deploy …`), with secrets in
  Supabase Vault.

---

## Project structure

```
src/
  main.tsx                 Entry: QueryClient → AuthProvider → Router (+ SW register)
  router.tsx               All routes
  index.css                Tailwind theme tokens (colors, fonts, shadow-pop)
  App.tsx                  Shell — wraps every screen in the PhoneFrame

  pages/
    LandingPage.tsx        Home + leaderboard
    MatchSelectPage.tsx    Match picker
    DonePage.tsx           Post-submit celebration
    predict/               The 6-step prediction wizard
    settings/              Hub, Signup, Policy, Terms, Help, SubmissionDetail,
                           Admin, AdminScore

  features/
    auth/                  AuthProvider (Supabase auth + profile) · admin gate
    prediction/            Prediction wizard state (Context + layout)

  components/              Reusable UI — PopButton, Screen, Avatar, Flag,
                           PhoneFrame, ShareButton, HowToPlayModal,
                           TimelineGuideModal, InfoPage, GoalModal, …

  data/                    Domain data + Supabase access
    worldCup2026.ts        Committed teams/fixtures/stadiums (source of truth)
    teams.ts, matches.ts   Typed model built on top of it
    submissions.ts         Read/write predictions
    useLeaderboard.ts      Leaderboard + played-match ids (DB-backed)
    useSubmissionsDetail.ts  Per-match score breakdown
    useSquad.ts            Squad hook → Supabase `players`
    profile.ts             Countries, avatar seeds, MAX_PREDICTIONS

  lib/
    scoring.ts             Pure scoring engine (source of truth)
    scoring*.test.ts       Engine unit tests + edge-parity guard
    pwa.ts                 Service-worker registration
    supabase.ts            Supabase client · queryClient.ts

supabase/functions/        Deno edge functions: score-match, send-match-emails,
                           send-comeback-emails (+ shared scoring copy & templates)
scripts/gen-fixtures-sql.ts  Generate DB seed SQL from the app's fixtures
emails/                    Standalone email template + previews
public/                    manifest.webmanifest, sw.js, icons, favicon
```

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
