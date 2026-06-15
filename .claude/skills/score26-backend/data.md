# Analyzing Supabase data (score26)

MCP tools: `list_tables` (verbose for columns/FKs), `execute_sql` (reads + data fixes), `apply_migration` (DDL — permanent), `get_advisors` (security/perf — run after DDL), `get_logs` (edge-function/postgres/api).

## Migration vs execute_sql
- DDL or anything that must persist on a fresh DB rebuild → `apply_migration` (named, in history).
- Ad-hoc reads, data fixes, and anything secret (Resend key) → `execute_sql` (not stored as a migration).

## Key joins
- `players.team_id → teams.id`. **Map app teams by `teams.fifa_code`** (= app `team.code`), NOT the numeric id (app ids differ; player ids match).
- `submissions.email → profiles.email`; `submission_goals.submission_id → submissions.id`.
- `match_outcomes.match_id` = `submissions.match_id` = `matches.id` = the static WcMatch id.
- `match_results` / `result_goals` keyed by `match_id`.

## Common queries
All-time leaderboard (real players only — seeded null-email rows removed):
```sql
select rank, username, points, hits, email from leaderboard where scope='all' order by rank;
```
A player's submissions + the result for one match:
```sql
select attempt, points, breakdown, outcome, winner_goals, loser_goals
from submissions where email = $1 and match_id = $2 order by attempt;
select * from match_outcomes where match_id = $2;
```
"Last N games" = recent kicked-off fixtures:
```sql
select id, home_code, away_code from matches where kickoff_utc < now() order by kickoff_utc desc limit N;
```
Lapsed players (no submission in the last 3 kicked-off games):
```sql
with last3 as (select id from matches where kickoff_utc < now() order by kickoff_utc desc limit 3)
select p.email, p.username from profiles p
where not exists (select 1 from submissions s
  where s.email = p.email and s.match_id in (select id from last3));
```
Resolve a jersey number to a player (admin-entry style): `players` join `teams` on fifa_code + `number`.

## Scoring data
- `submissions.points` (int) + `submissions.breakdown` (jsonb `ScoreLine[]` = `{key,label,points}`) — written by score-match.
- `match_outcomes.calculation_status` jsonb = `[{email, calculated, email_sent}]` — per-player pipeline progress.
- `recompute_leaderboard(p_match_id)` rebuilds all/match/day scopes for real players (call after any manual points edit).
- Rubric / engine: `src/lib/scoring.ts` (`POINTS` constants). Scorer, timing, and assist are independent +points; "perfect" is a bonus.

## Resetting test data
A fabricated outcome shows to users as a real finished match + real points — always clean up:
```sql
delete from result_goals where match_id = $1;
delete from match_results where match_id = $1;
delete from match_outcomes where match_id = $1;
update submissions set points = 0, breakdown = null where match_id = $1;
select recompute_leaderboard($1);  -- re-rank without this match's contribution
```

## Health checks
- `get_advisors(security)` — expect INFO `rls_enabled_no_policy` on admin-only tables (`match_outcomes`, `email_templates`, `comeback_sends`); that's intentional (service-role only, no anon policies).
- `get_logs(edge-function)` — score-match / send-* runs (200s + any `console.error`).
