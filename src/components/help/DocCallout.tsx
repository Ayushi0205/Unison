import { renderInline } from './renderInline'

const STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  'admin-only': 'bg-primary-tint border-[#cdeadf] text-primary-strong',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
} as const

const LABEL = { info: 'Note', 'admin-only': 'Admin only', warning: 'Heads up' } as const

export function DocCallout({ variant, text }: { variant: keyof typeof STYLES; text: string }) {
  return (
    <div className={`flex gap-2.5 border rounded-lg px-3.5 py-3 text-[13.5px] my-4 ${STYLES[variant]}`}>
      <span className="font-semibold shrink-0">{LABEL[variant]}:</span>
      <div className="min-w-0">{renderInline(text)}</div>
    </div>
  )
}
