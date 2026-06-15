---
name: score26-backend
description: Operate the score26 Supabase backend — send emails (Resend), write & deploy edge functions, and query/analyze the database (leaderboard, scoring, submissions, players). Use whenever sending or templating emails, building/deploying a Supabase edge function, running SQL or migrations, or investigating data in this project.
---

# score26 backend ops

Supabase project `djifgdbkftbtkssrijko` — `https://djifgdbkftbtkssrijko.supabase.co`. The React/Vite frontend uses the anon key; all privileged work runs in **edge functions** (service role) or via the Supabase **MCP tools**.

## Pipeline at a glance
Admin records a result → scoring → emails, fully automatic:

`match_outcomes` (status `final`) → AFTER trigger `trigger_score_match` (pg_net) → **score-match** edge fn → writes `submissions.points` + `breakdown`, mirrors into `match_results`/`result_goals`, runs `recompute_leaderboard(match_id)`, updates `calculation_status` → invokes **send-match-emails** once every player is calculated.

`send-comeback-emails` is a separate re-engagement campaign (manual / schedulable).

## Tables (`public`)
- `teams` (id, fifa_code, iso, emoji) · `players` (id, team_id, number, name, photo)
- `matches` (id, home_code, away_code, kickoff_utc, city, local_time) — fixtures (72)
- `profiles` (email, username, country_iso, avatar_seed) — real users
- `submissions` (email, match_id, attempt, outcome, winner/loser_goals, possession/shots, **points**, **breakdown** jsonb) + `submission_goals`
- `match_outcomes` — admin entry: home/away_code, `*_scorers` jsonb `[{no,min,assist_no}]`, stats, `status`, `calculation_status` jsonb `[{email,calculated,email_sent}]`. Drives the pipeline.
- `match_results` + `result_goals` — normalized read model the app reads
- `leaderboard` (scope `all|day|match`, match_id, rank, points, hits, email) — **real players only** (seeded rows removed)
- `email_templates` (name, html) — `match-result`, `comeback`
- `comeback_sends` (email, sent_at) — comeback suppression

Edge functions: `score-match`, `send-match-emails`, `send-comeback-emails`. Repo source: `supabase/functions/<name>/`.

## Critical gotchas
- **App team ids ≠ DB team ids.** Join app match/team data on `teams.fifa_code` (= app `team.code`), never the numeric id. Player ids DO match.
- **Resend verified domain is `chienda.com`** → `email_from` = `score26 <score26@chienda.com>`. Sending from score26.app 403s.
- **Almost all players are in Malawi** → show kickoff in CAT (UTC+2, no DST) computed from `kickoff_utc`, not the US venue `local_time`/`city`.
- **Secrets** are in Vault, read via `get_secret(name)` RPC (service_role only): `resend_api_key`, `app_base_url`, `email_from`. Never hardcode/commit them.
- **Deploying an edge function needs the file content inline** — generate it with the helper (see edge-functions.md), never hand-escape.
- Real emails reach real people — **confirm before a real send**; use the preview/test path first.

## Guides (load when needed)
- **Send emails** — templates, Resend, preview, MW time, adding an email: [emails.md](emails.md)
- **Write & deploy edge functions** — boilerplate, secrets, the deploy escaping dance, pg_net trigger, scoring parity: [edge-functions.md](edge-functions.md)
- **Analyze the database** — schema joins, common queries, migrations vs SQL, resetting test data, advisors/logs: [data.md](data.md)

Helper: `scripts/fn-files.ts` prints the JSON `files` array for `deploy_edge_function` from a function dir.
