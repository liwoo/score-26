import { InfoPage } from '../../components/InfoPage'

export function HelpPage() {
  return (
    <InfoPage
      title="Help & Support"
      emoji="💡"
      intro="New to Score26 or stuck on something? Here's the quick rundown of how the game works."
      sections={[
        {
          heading: 'How do I play?',
          body: (
            <p>
              Tap <b>Start Predicting</b>, pick a match, then call the winner, the
              margin, the scorers and the timeline. Lock it in before kickoff and
              we'll score it once the real match is done.
            </p>
          ),
        },
        {
          heading: 'How many predictions do I get?',
          body: (
            <p>
              Up to three per match. We always keep your highest-scoring one, so
              there's no harm in refining a call right up to the deadline.
            </p>
          ),
        },
        {
          heading: 'How are points scored?',
          body: (
            <p>
              You earn points for getting the outcome, scoreline, scorers and goal
              timings right. Riskier calls — like exact scorers — are worth more.
            </p>
          ),
        },
        {
          heading: 'Where do I see my rank?',
          body: (
            <p>
              The home leaderboard ranks everyone all-time, today, and per match.
              Your own row is always pinned so you can find yourself fast.
            </p>
          ),
        },
        {
          heading: 'I changed my mind on my profile',
          body: (
            <p>
              Log out from Settings and sign up again to pick a fresh username,
              avatar or country.
            </p>
          ),
        },
      ]}
    />
  )
}
