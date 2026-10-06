import { Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './hooks/useCurrentUser'
import { AppShell } from './components/layout/AppShell'
import { AdminGuard } from './components/admin/AdminGuard'
import { LibraryPage } from './pages/LibraryPage'
import { OverviewPage } from './pages/OverviewPage'
import { PartialsPage } from './pages/PartialsPage'
import { PartialDetailPage } from './pages/PartialDetailPage'
import { TemplateDetailPage } from './pages/TemplateDetailPage'
import { AdminOverviewPage } from './pages/AdminOverviewPage'
import { RequiredPartialsPage } from './pages/RequiredPartialsPage'
import { PartialEditorPage } from './pages/PartialEditorPage'
import { ProgramsPage } from './pages/ProgramsPage'
import { TemplateEditorPage } from './pages/TemplateEditorPage'
import { LoginPage } from './pages/LoginPage'
import { HelpLayout } from './pages/help/HelpLayout'
import { HelpArticlePage } from './pages/help/HelpArticlePage'


export default function App() {
  return (
    <UserProvider>
      <Routes>
        {/* Demo entry: pick a role (no app shell). */}
        <Route path="login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="templates" element={<LibraryPage />} />
          <Route path="library" element={<Navigate to="/templates" replace />} />
          <Route path="templates/:id" element={<TemplateDetailPage />} />
          <Route path="templates/new" element={<TemplateEditorPage />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPage />} />
          <Route path="partials" element={<PartialsPage />} />
          <Route path="partials/:id" element={<PartialDetailPage />} />
          {/* Placeholder routes for Phase 9 "Under construction" state. */}
          <Route path="help" element={<HelpLayout />}>
            <Route index element={<Navigate to="/help/welcome" replace />} />
            <Route path=":articleId" element={<HelpArticlePage />} />
          </Route>
          <Route path="admin" element={<AdminGuard />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="required-partials" element={<RequiredPartialsPage />} />
            <Route path="projects" element={<ProgramsPage />} />
            <Route path="partials/new" element={<PartialEditorPage />} />
            <Route path="partials/:id/edit" element={<PartialEditorPage />} />
          </Route>
        </Route>
      </Routes>
    </UserProvider>
  )
}
