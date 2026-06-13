import { Outlet } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'

export function App() {
  return (
    <PhoneFrame>
      <Outlet />
    </PhoneFrame>
  )
}
