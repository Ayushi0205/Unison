/**
 * Filter dropdown — shared across list pages.
 *
 * Designer reference (DF2 item 11):
 *   - Default state: placeholder in gray, vertical divider before chevron.
 *   - Selected state: value in black, vertical divider before chevron.
 * The divider is always visible; only the text color changes.
 */
export function FilterSelect({
  value, onChange, placeholder, options, minWidth, fullWidth, height,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  minWidth?: string
  fullWidth?: boolean
  height?: 'sm' | 'md'
}) {
  const selected = !!value
  const heightClass = height === 'md' ? 'h-11' : 'h-10'
  return (
    <div
      className={`relative ${fullWidth ? 'flex w-full' : 'inline-flex'}`}
      style={minWidth ? { minWidth } : undefined}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none ${heightClass} w-full border border-gray-300 rounded-md text-sm pl-3 pr-12 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
          selected ? 'text-gray-900 font-medium' : 'text-gray-500'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3 pointer-events-none">
        <span className="h-6 w-px bg-gray-300 mr-3" aria-hidden="true" />
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
