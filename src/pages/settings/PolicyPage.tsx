import { InfoPage } from '../../components/InfoPage'

export function PolicyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      emoji="🔒"
      updated="June 2026"
      intro="Score26 is a play-for-fun World Cup prediction game. We keep the data we collect to the bare minimum needed to put you on the leaderboard — nothing more."
      sections={[
        {
          heading: 'What we store',
          body: (
            <p>
              Your username, chosen avatar and country live in a single cookie on
              your own device. Your prediction history is kept in your browser's
              local storage. We don't run trackers or sell anything to anyone.
            </p>
          ),
        },
        {
          heading: 'Your predictions',
          body: (
            <p>
              When you lock in a prediction it's saved so we can score it against
              the real result and rank you. Only your username, country and points
              are ever shown publicly on the leaderboard.
            </p>
          ),
        },
        {
          heading: 'Signing in',
          body: (
            <p>
              Sign-in creates a lightweight profile to tie your predictions
              together. We never post on your behalf or read anything outside the
              game.
            </p>
          ),
        },
        {
          heading: 'Your control',
          body: (
            <p>
              Logging out from Settings clears your session cookie. Clearing your
              browser data removes your prediction history. It's your device, your
              call.
            </p>
          ),
        },
      ]}
    />
  )
}
