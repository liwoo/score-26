import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The score-match edge function ships its own copy of the scoring engine +
// adapter (Deno can't import from src/). These tests guarantee the copies never
// drift from the source of truth — they're byte-identical bar the header comment
// and the adapter's import path. If one fails: re-copy the source file into
// supabase/functions/score-match/ (keeping the header).
const root = join(import.meta.dir, '..', '..')

function stripLeadingLineComments(s: string): string {
  const lines = s.split('\n')
  let i = 0
  while (i < lines.length && lines[i].startsWith('//')) i++
  return lines.slice(i).join('\n')
}

describe('edge function scoring parity', () => {
  it('score-match/scoring.ts matches src/lib/scoring.ts', () => {
    const src = readFileSync(join(root, 'src/lib/scoring.ts'), 'utf8')
    const copy = readFileSync(
      join(root, 'supabase/functions/score-match/scoring.ts'),
      'utf8',
    )
    expect(stripLeadingLineComments(copy)).toBe(src)
  })

  it('score-match/scoringAdapters.ts matches src/data/scoringAdapters.ts', () => {
    const src = readFileSync(join(root, 'src/data/scoringAdapters.ts'), 'utf8')
    const copy = readFileSync(
      join(root, 'supabase/functions/score-match/scoringAdapters.ts'),
      'utf8',
    )
    const normalized = stripLeadingLineComments(copy).replace(
      "from './scoring.ts'",
      "from '../lib/scoring'",
    )
    expect(normalized).toBe(src)
  })
})
