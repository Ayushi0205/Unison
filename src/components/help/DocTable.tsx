import { renderInline } from './renderInline'

/** Simple table for the permissions matrix, glossary, and statuses. Cells support inline markdown. */
export function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left font-semibold text-gray-600 border-b border-gray-200 px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-gray-100">
              {r.map((c, ci) => (
                <td key={ci} className="px-3 py-2 align-top">
                  {renderInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
