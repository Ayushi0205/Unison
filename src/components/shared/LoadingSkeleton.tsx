export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="bg-gray-50 h-10 rounded-t" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100 px-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-3 bg-gray-100 rounded w-32" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-28" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-200 rounded-full" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-6" />
        </div>
      ))}
    </div>
  )
}
