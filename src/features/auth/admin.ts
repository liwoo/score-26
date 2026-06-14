/**
 * Single-admin gate. The match-result entry tools are only for this account.
 * This is UI-level convenience only — the real enforcement is the RLS policy on
 * public.match_outcomes (auth.email() = this address).
 */
export const ADMIN_EMAIL = 'jeremiahchienda@gmail.com'

export const isAdmin = (email: string | null | undefined): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL
