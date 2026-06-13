import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { LandingPage } from './pages/LandingPage'
import { MatchSelectPage } from './pages/MatchSelectPage'
import { DonePage } from './pages/DonePage'
import { PredictionLayout } from './features/prediction/PredictionLayout'
import { WinnerStep } from './pages/predict/WinnerStep'
import { MarginStep } from './pages/predict/MarginStep'
import { OpponentStep } from './pages/predict/OpponentStep'
import { TimelineStep } from './pages/predict/TimelineStep'
import { StatsStep } from './pages/predict/StatsStep'
import { SubmitStep } from './pages/predict/SubmitStep'
import { SettingsPage } from './pages/settings/SettingsPage'
import { SignupPage } from './pages/settings/SignupPage'
import { PolicyPage } from './pages/settings/PolicyPage'
import { TermsPage } from './pages/settings/TermsPage'
import { HelpPage } from './pages/settings/HelpPage'

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/matches', element: <MatchSelectPage /> },
      { path: '/done', element: <DonePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/signup', element: <SignupPage /> },
      { path: '/settings/policy', element: <PolicyPage /> },
      { path: '/settings/terms', element: <TermsPage /> },
      { path: '/settings/help', element: <HelpPage /> },
      {
        path: '/play/:matchId',
        element: <PredictionLayout />,
        children: [
          { index: true, element: <WinnerStep /> },
          { path: 'margin', element: <MarginStep /> },
          { path: 'opponent', element: <OpponentStep /> },
          { path: 'timeline', element: <TimelineStep /> },
          { path: 'stats', element: <StatsStep /> },
          { path: 'submit', element: <SubmitStep /> },
        ],
      },
    ],
  },
])
