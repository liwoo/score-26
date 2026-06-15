# Writing & deploying edge functions (score26)

Deno functions deployed via the Supabase MCP `deploy_edge_function` tool. Current: `score-match`, `send-match-emails`, `send-comeback-emails`. Repo source: `supabase/functions/<name>/index.ts`.

## Boilerplate
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}))
  // ... work ...
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } })
})
```
- Auto-injected env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (privileged, bypasses RLS), `SUPABASE_ANON_KEY`. Don't set these.
- Deploy with `verify_jwt: true` (default). The DB trigger calls with the public anon key; internal work uses the service role.

## Secrets
Function env secrets can't be set via MCP. Store in Vault, read via the `get_secret(secret_name)` RPC (service_role only):
```ts
const secret = async (name) => (await db.rpc('get_secret', { secret_name: name })).data ?? null
```
Set/update a secret with `execute_sql` (NOT a migration — keeps it out of history):
```sql
select vault.create_secret('value', 'name', 'description');   -- first time
-- update: select vault.update_secret((select id from vault.secrets where name='name'), 'value');
```

## Deploying — the escaping dance (IMPORTANT)
`deploy_edge_function` needs each file's content INLINE in the tool call. Hand-escaping ~10KB of TS (regex backslashes, quotes, newlines, emoji) is error-prone. Generate it:
```bash
bun run .claude/skills/score26-backend/scripts/fn-files.ts supabase/functions/<name>
```
This prints the exact JSON `files` array (entrypoint first, `.html` template sources excluded — those live in the DB). Paste it as the `files` arg of `deploy_edge_function` with `name=<name>`, `entrypoint_path="index.ts"`, `verify_jwt=true`.

Single value, if you only need one file's content: `bun -e 'console.log(JSON.stringify(require("fs").readFileSync(process.argv[1],"utf8")))' <file>`.

## Invoking a function manually
Anon key is public — fetch via MCP `get_publishable_keys` (the legacy `anon` JWT).
```bash
curl -s -X POST 'https://djifgdbkftbtkssrijko.supabase.co/functions/v1/<name>' \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $ANON" -d '{...}'
```

## DB → function trigger (pg_net)
`match_outcomes` insert/update fires `trigger_score_match()` (SECURITY DEFINER), which `net.http_post`s to score-match with the anon bearer. Copy these guards for any new trigger:
- Fire only when relevant (e.g. `status='final'` AND scoring columns changed). The function's own write-back must NOT re-trigger → infinite loop.
- Pin `search_path`; `revoke execute ... from public, anon, authenticated`.

## Scoring engine parity
`src/lib/scoring.ts` (pure, tested) is COPIED into `supabase/functions/score-match/scoring.ts` (+ `scoringAdapters.ts`). Parity is enforced by `src/lib/scoring.parity.test.ts`. If you change scoring: edit the src, `cp` into the function dir (keep the header comment), redeploy. Never let them diverge.

## Checklist for a new / changed function
1. Edit `supabase/functions/<name>/index.ts`.
2. Secrets → Vault + `get_secret` (never inline).
3. `bun run .../scripts/fn-files.ts supabase/functions/<name>` → `deploy_edge_function`.
4. Test via curl (anon bearer) or its trigger.
5. `get_logs(edge-function)` to debug; `get_advisors(security)` after any DDL.
