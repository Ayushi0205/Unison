export function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white border border-[#cdeadf] text-primary-strong text-[11px] font-semibold px-2.5 py-0.5">
      {label}
    </span>
  )
}
