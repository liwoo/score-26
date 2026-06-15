# Sending emails (score26)

Email runs through **Resend** from edge functions. Templates live in the DB so copy changes don't need a redeploy.

## Where things are
- **Templates**: table `email_templates` (name, html), flat **double-brace** `{{var}}` placeholders. Current: `match-result`, `comeback`.
  - Canonical source copies in repo: `supabase/functions/send-match-emails/match-result.html`, `supabase/functions/send-comeback-emails/comeback.html`. Keep DB + repo in sync.
  - ⚠️ `emails/match-result.html` (triple-brace) is an OLD standalone Resend template — **NOT used by the pipeline**. Don't confuse it.
- **Senders**: `send-match-emails` (result email — auto), `send-comeback-emails` (re-engagement — manual).
- **Secrets** (Vault, via `get_secret`): `resend_api_key`, `email_from` (`score26 <score26@chienda.com>`), `app_base_url` (`https://score26.app`).

## Render + send (every sender uses this)
```ts
const render = (tpl, vars) =>
  tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k) => vars[k] ?? '')
// var values may contain HTML (e.g. a precomputed breakdown_rows) — injected as-is.
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: [email], subject, html }),
})
```
`from` must be on the verified domain **chienda.com** or Resend returns 403. `onboarding@resend.dev` only delivers to the Resend account owner (jeremiahchienda@gmail.com) — useful for a one-off test.

## Malawi kickoff time
Show fixtures in CAT (UTC+2, no DST) computed from `kickoff_utc` — NOT `matches.local_time`/`city` (those are US venue-local):
```ts
const mwTime = (utcIso) => {
  const d = new Date(new Date(utcIso).getTime() + 2 * 3600 * 1000)
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
} // label the value " CAT"
```

## Editing a template (no redeploy)
Update the DB row, then mirror the repo copy. Dollar-quote to avoid escaping:
```sql
update email_templates set html = $html$<!doctype html> ... $html$, updated_at = now()
where name = 'match-result';
```
Targeted tweak (no need to repaste the whole file):
```sql
update email_templates set html = replace(html, '📍 {{next_kickoff}}', '⏰ {{next_kickoff}}')
where name = 'comeback';
```
Verify: `select length(html), position('{{token}}' in html) > 0 from email_templates where name='...';`

## Sending
- **Result emails** are automatic (score-match → send-match-emails). To re-test to yourself: set that player's `calculation_status[email].email_sent = false`, then invoke `send-match-emails` with `{"match_id": N}`.
- **Comeback batch** (`send-comeback-emails`):
  - Preview (touches nothing): `-d '{"preview_to":"you@example.com"}'`
  - Real batch: `-d '{}'` → lapsed players; skips anyone in `comeback_sends` within 6 days, then records sends.
  - Audience = account + predicted before + predicted **none of the last 3 kicked-off matches**.

## Adding a new email
1. Write the HTML (double-brace vars) → `supabase/functions/<sender>/<name>.html`.
2. Insert into `email_templates` (dollar-quoted).
3. Write/extend the sender edge fn (load template, build vars, render, POST to Resend). Deploy per edge-functions.md.
4. **Preview to the owner before any real send.**
