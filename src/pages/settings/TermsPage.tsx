import { InfoPage } from '../../components/InfoPage'

export function TermsPage() {
  return (
    <InfoPage
      title="Terms of Service"
      emoji="📜"
      updated="June 2026"
      intro="By playing Score26 you agree to keep it friendly and fair. These terms are short on purpose — it's a game, not a contract you need a lawyer for."
      sections={[
        {
          heading: 'Fair play',
          body: (
            <p>
              You get up to three predictions per match and we score your best
              one. Don't try to game the system, automate submissions, or
              impersonate other players.
            </p>
          ),
        },
        {
          heading: 'Your profile',
          body: (
            <p>
              Pick a username that isn't offensive or misleading. We may reset
              profiles that break the spirit of the game without notice.
            </p>
          ),
        },
        {
          heading: 'No guarantees',
          body: (
            <p>
              Scores, fixtures and results depend on third-party data and may be
              corrected or delayed. Score26 is provided “as is” for entertainment
              and carries no prize or monetary value.
            </p>
          ),
        },
        {
          heading: 'Changes',
          body: (
            <p>
              We may update these terms as the game evolves. Continuing to play
              after an update means you're good with the latest version.
            </p>
          ),
        },
      ]}
    />
  )
}
