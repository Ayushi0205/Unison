import type { DocImageData, ActionMarker } from '../../data/help/schema'
import { renderInline } from './renderInline'

/** A page "action map": one screenshot with numbered markers + a synced legend.
 *  Used only for orientation ("what you can do on this page"), never for tasks. */
export function DocActionMap({ data, markers }: { data: DocImageData; markers: ActionMarker[] }) {
  return (
    <div className="my-5">
      <div className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <img src={data.src} alt={data.alt} className="block w-full" />
        {markers.map((m) => (
          <span
            key={m.n}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white shadow-[0_0_0_4px_rgba(186,117,23,0.25)]"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            {m.n}
          </span>
        ))}
      </div>
      <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 list-none p-0">
        {markers.map((m) => (
          <li key={m.n} className="flex gap-2.5 text-[13.5px]">
            <span className="shrink-0 mt-px w-[19px] h-[19px] rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
              {m.n}
            </span>
            <span>
              <b className="font-semibold">{m.label}</b> — <span className="text-gray-500">{renderInline(m.desc)}</span>
              {m.tag && (
                <span className="ml-1.5 align-middle text-[9px] font-bold tracking-wide uppercase text-primary-strong bg-primary-tint rounded px-1.5 py-0.5">
                  {m.tag}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
