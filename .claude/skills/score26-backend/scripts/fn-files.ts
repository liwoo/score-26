#!/usr/bin/env bun
/**
 * Prints the JSON `files` array for the Supabase `deploy_edge_function` MCP tool
 * from an edge-function directory. Paste the output as the tool's `files` arg.
 *
 *   bun run .claude/skills/score26-backend/scripts/fn-files.ts supabase/functions/score-match
 *
 * Includes code files only (.ts/.tsx/.js/.mjs/.json); .html template sources are
 * intentionally excluded — email templates live in the `email_templates` DB
 * table, not bundled in the function. index.ts is emitted first (the entrypoint).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: bun run fn-files.ts <function-dir>')
  process.exit(1)
}

const CODE = /\.(ts|tsx|js|mjs|json)$/

const files = readdirSync(dir)
  .filter((n) => CODE.test(n) && statSync(join(dir, n)).isFile())
  .sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)))
  .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }))

if (files.length === 0) {
  console.error(`no code files found in ${dir}`)
  process.exit(1)
}

console.log(JSON.stringify(files))
