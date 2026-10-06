import { Fragment } from 'react'
import type { DiagramNode } from '../../data/help/schema'

/** A simple horizontal process/lifecycle diagram. Concept pages only. */
export function DocDiagram({ nodes }: { nodes: DiagramNode[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-0 my-5">
      {nodes.map((n, i) => (
        <Fragment key={i}>
          <div
            className={`flex-1 min-w-[120px] border rounded-[10px] px-3 py-2.5 ${
              n.result ? 'border-primary bg-[#f3f8f1]' : 'border-gray-200 bg-white'
            }`}
          >
            <div className={`text-[13px] font-semibold ${n.result ? 'text-primary' : ''}`}>{n.label}</div>
            {n.desc && <div className="text-[11px] text-gray-500 mt-1 leading-snug">{n.desc}</div>}
          </div>
          {i < nodes.length - 1 && <div className="self-center text-[#c7ccd4] text-lg px-1.5">→</div>}
        </Fragment>
      ))}
    </div>
  )
}
