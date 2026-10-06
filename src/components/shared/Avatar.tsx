export function Avatar({ email, size = 'md' }: { email: string; size?: 'sm' | 'md' }) {
  const local = email.split('@')[0] || ''
  const parts = local.split('.')
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase()

  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs'

  return (
    <span className={`${dim} rounded-full bg-gray-200 text-gray-700 font-medium inline-grid place-items-center shrink-0`}>
      {initials}
    </span>
  )
}
