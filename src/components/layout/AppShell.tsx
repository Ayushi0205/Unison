import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { DemoBanner } from './DemoBanner'
import { AUTHOR_NAME, CASE_STUDY_URL } from '../../config/portfolio'
import { ToastProvider, ToastStyles } from '../shared/Toast'

export function AppShell() {
  return (
    <ToastProvider>
      <ToastStyles />
      <div className="h-screen flex flex-col">
        <TopBar />
        <DemoBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white flex flex-col">
          <div className="flex-1 max-w-7xl w-full mx-auto px-8 pb-6">
            <Outlet />
          </div>
          <footer className="border-t border-gray-100 py-4 px-8">
            <div className="max-w-7xl mx-auto text-xs text-gray-400">
              Unison is a portfolio product by {AUTHOR_NAME}. Built with Claude Code.
              {CASE_STUDY_URL && (
                <>
                  {' · '}
                  <a href={CASE_STUDY_URL} className="text-gray-500 hover:text-primary hover:underline">
                    Case study
                  </a>
                </>
              )}
            </div>
          </footer>
        </main>
      </div>
      </div>
    </ToastProvider>
  )
}
