import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PROJECTS, saveProjects } from '../data/programs'
import { TEMPLATES } from '../data/templates'
import type { Project } from '../data/types'
import { useToast } from '../components/shared/Toast'

// ─── helpers ────────────────────────────────────────────────────────────────

function templateCount(projectId: string): number {
  return TEMPLATES.filter((t) => t.programId === projectId).length
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ─── icons ──────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
  </svg>
)

const DotsIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <circle cx="4" cy="10" r="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="16" cy="10" r="1.5" />
  </svg>
)

const FolderIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
)

// ─── inline form panel ──────────────────────────────────────────────────────

interface FormState {
  name: string
  client: string
}

function ProjectForm({
  initial,
  onSave,
  onCancel,
  isEdit,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isEdit: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const valid = form.name.trim().length > 0 && form.client.trim().length > 0

  return (
    // DF2: Slide-in side panel - replaces the inline expanding card.
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/20" onClick={onCancel} />
      <aside className="relative w-full max-w-[480px] h-full bg-white shadow-xl border-l border-gray-200 flex flex-col">
        <div className="px-6 py-4 flex items-start justify-between border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit project' : 'New project'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 -mr-1 -mt-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Project Gold"
              className="w-full h-11 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
            />
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Customer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.client}
              onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
              placeholder="e.g. Halcyon Robotics"
              className="w-full h-11 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isEdit ? 'Save changes' : 'Add project'}
          </button>
        </div>
      </aside>
    </div>
  )
}

// ─── inline confirm ──────────────────────────────────────────────────────────

function InlineConfirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
      <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{message}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onConfirm}
            className="h-7 px-3 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="h-7 px-3 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── row ────────────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  count,
  onEdit,
  onDelete,
  isDeletePending,
  onConfirmDelete,
  onCancelDelete,
}: {
  project: Project
  count: number
  onEdit: () => void
  onDelete: () => void
  isDeletePending: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        {/* Name */}
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-gray-900">{project.name}</div>
        </td>

        {/* Client */}
        <td className="px-4 py-3">
          <span className="text-sm text-gray-700">{project.client}</span>
        </td>

        {/* Templates */}
        <td className="px-4 py-3">
          {count > 0 ? (
            <Link
              to={`/templates?program=${project.id}`}
              className="text-sm text-primary hover:underline font-medium"
            >
              {plural(count, 'template')}
            </Link>
          ) : (
            <span className="text-sm text-gray-400">None</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Actions"
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                <button
                  onClick={() => { setMenuOpen(false); onEdit() }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                {count === 0 ? (
                  <button
                    onClick={() => { setMenuOpen(false); onDelete() }}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="block text-left px-3 py-1.5 text-sm text-gray-300 cursor-not-allowed" title={`Used by ${plural(count, 'template')}`}>
                    Delete
                  </span>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* Delete confirm */}
      {isDeletePending && (
        <tr>
          <td colSpan={4} className="pt-0 pb-2">
            <InlineConfirm
              message={
                <>
                  Permanently delete <strong>{project.name}</strong>? This cannot be undone.
                </>
              }
              confirmLabel="Delete"
              onConfirm={onConfirmDelete}
              onCancel={onCancelDelete}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

type PanelState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; projectId: string }

export function ProgramsPage() {
  const { show: toast } = useToast()

  // local state (optimistic; resets on refresh - intentional for v0)
  const [projects, setProjects] = useState<Project[]>(() => [...PROJECTS])
  // Every project change is saved to the visitor's demo store.
  const updateProjects = (fn: (prev: Project[]) => Project[]) =>
    setProjects((prev) => {
      const next = fn(prev)
      saveProjects(next)
      return next
    })
  const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })
  const [deletePending, setDeletePending] = useState<string | null>(null)

  // filters
  const [search, setSearch] = useState('')

  // derived
  const counts = Object.fromEntries(projects.map((p) => [p.id, templateCount(p.id)]))

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase())
    )
  })

  // ── handlers ───────────────────────────────────────────────────────────────

  function handleSave(form: FormState) {
    if (panel.mode === 'add') {
      const newProject: Project = {
        id: `prog-${Date.now()}`,
        name: form.name.trim(),
        client: form.client.trim(),
        archived: false,
      }
      updateProjects((ps) => [...ps, newProject])
      toast(`"${newProject.name}" created.`)
    } else if (panel.mode === 'edit') {
      updateProjects((ps) =>
        ps.map((p) =>
          p.id === panel.projectId
            ? { ...p, name: form.name.trim(), client: form.client.trim() }
            : p
        )
      )
      toast('Project updated.')
    }
    setPanel({ mode: 'closed' })
  }

  function handleConfirmDelete(projectId: string) {
    const name = projects.find((p) => p.id === projectId)?.name ?? 'Project'
    updateProjects((ps) => ps.filter((p) => p.id !== projectId))
    setDeletePending(null)
    toast(`"${name}" deleted.`)
  }

  const editingProject =
    panel.mode === 'edit' ? projects.find((p) => p.id === panel.projectId) : undefined

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 pt-6 pb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Group templates and rules by project.
          </p>
        </div>
        <button
          onClick={() => setPanel({ mode: 'add' })}
          className="shrink-0 h-9 px-4 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New project
        </button>
      </div>

      {/* Add / Edit form */}
      {panel.mode !== 'closed' && (
        <ProjectForm
          key={panel.mode === 'edit' ? panel.projectId : 'new'}
          initial={
            panel.mode === 'edit' && editingProject
              ? { name: editingProject.name, client: editingProject.client }
              : { name: '', client: '' }
          }
          isEdit={panel.mode === 'edit'}
          onSave={handleSave}
          onCancel={() => setPanel({ mode: 'closed' })}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="h-9 pl-9 pr-3 border border-gray-300 rounded-md text-sm w-60 placeholder:italic focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Count badge */}
        <span className="text-sm text-gray-500 ml-1">
          {filtered.length === projects.length
            ? plural(projects.length, 'project')
            : `Showing ${filtered.length} of ${projects.length}`}
        </span>

        {/* Clear search */}
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-sm text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        // Global empty state
        <div className="text-center py-20 text-gray-400">
          <div className="flex justify-center mb-3 opacity-30">
            <FolderIcon />
          </div>
          <p className="text-sm font-medium text-gray-500">No projects yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Projects let you group templates and rules by client engagement.
          </p>
          <button
            onClick={() => setPanel({ mode: 'add' })}
            className="mt-4 h-9 px-4 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            + New project
          </button>
        </div>
      ) : filtered.length === 0 ? (
        // Search empty state
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm font-medium text-gray-500">No projects match your search</p>
          <button
            onClick={() => setSearch('')}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-1/3">
                  Name
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-1/4">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-1/4">
                  Templates
                </th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  count={counts[project.id] ?? 0}
                  onEdit={() => setPanel({ mode: 'edit', projectId: project.id })}
                  onDelete={() => setDeletePending(project.id)}
                  isDeletePending={deletePending === project.id}
                  onConfirmDelete={() => handleConfirmDelete(project.id)}
                  onCancelDelete={() => setDeletePending(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
