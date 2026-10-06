import type { StepItem } from '../../data/help/schema'
import { DocImage } from './DocImage'
import { renderInline } from './renderInline'

/** Numbered steps. Numbers are rendered explicitly (not via CSS counters) so they
 *  survive any Tailwind build. `text` carries **bold** UI labels and inline links. */
export function DocSteps({ items }: { items: StepItem[] }) {
  return (
    <ol className="list-none p-0 m-0 max-w-[64ch]">
      {items.map((it, i) => (
        <li key={i} className="relative pl-10 pb-[18px]">
          <span className="absolute left-0 top-0 w-[25px] h-[25px] rounded-full bg-primary-strong text-white text-[12.5px] font-bold flex items-center justify-center">
            {i + 1}
          </span>
          {i < items.length - 1 && <span className="absolute left-3 top-[27px] bottom-0 w-px bg-[#e2e8f0]" aria-hidden />}
          <div className="text-[14px] leading-relaxed pt-0.5">{renderInline(it.text)}</div>
          {it.image && <DocImage data={it.image} />}
        </li>
      ))}
    </ol>
  )
}
