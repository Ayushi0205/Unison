import { Outlet } from 'react-router-dom'
import { HelpNav } from '../../components/help/HelpNav'

/** Two-column docs shell: sticky left nav + scrolling article, inside the app shell's main. */
export function HelpLayout() {
  return (
    <div className="flex gap-8 pt-6 items-start">
      <div className="sticky top-6 self-start shrink-0">
        <HelpNav />
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <Outlet />
      </div>
    </div>
  )
}
