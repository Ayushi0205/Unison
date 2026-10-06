import { useState } from 'react'

export function ArticleFeedback() {
  const [sent, setSent] = useState<null | 'up' | 'down'>(null)
  return (
    <div className="mt-6 border-t border-gray-200 pt-4 flex items-center gap-3 text-[13px] text-gray-700">
      {sent ? (
        <span>Thanks for the feedback.</span>
      ) : (
        <>
          <span>Was this helpful?</span>
          <button onClick={() => setSent('up')} className="border border-gray-200 rounded-md px-3 py-1 hover:bg-gray-50">
            👍 Yes
          </button>
          <button onClick={() => setSent('down')} className="border border-gray-200 rounded-md px-3 py-1 hover:bg-gray-50">
            👎 No
          </button>
        </>
      )}
    </div>
  )
}
