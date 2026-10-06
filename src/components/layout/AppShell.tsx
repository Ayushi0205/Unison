import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { ToastProvider, ToastStyles } from '../shared/Toast'

export function AppShell() {
  return (
    <ToastProvider>
      <ToastStyles />
      <div className="h-screen flex flex-col">
        <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white flex flex-col">
          <div className="flex-1 max-w-7xl w-full mx-auto px-8 pb-6">
            <Outlet />
          </div>
        </main>
      </div>
      </div>
    </ToastProvider>
  )
}
