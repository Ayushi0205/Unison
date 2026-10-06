import { useState } from 'react'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { ConfirmModal } from '../shared/ConfirmModal'
import { resetDemo } from '../../data/demo-store'

export function DemoBanner() {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="bg-primary-tint border-b border-primary/15 px-4 py-1.5 flex items-center justify-between gap-4 text-[13px] text-primary-strong shrink-0">
      <span className="flex items-center gap-2 min-w-0">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <span className="font-medium">Demo workspace.</span> Meridian Works is a fictional company. Your changes are saved in
          this browser only.
        </span>
      </span>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="shrink-0 inline-flex items-center gap-1.5 font-medium hover:underline"
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        Reset demo
      </button>
      <ConfirmModal
        open={confirmOpen}
        title="Reset the demo?"
        body="This restores the original sample templates, partials, rules, and projects. Your changes in this browser will be lost."
        confirmLabel="Reset demo"
        variant="destructive"
        onConfirm={resetDemo}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
