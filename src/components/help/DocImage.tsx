import type { DocImageData } from '../../data/help/schema'
import { renderInline } from './renderInline'

export function DocImage({ data }: { data: DocImageData }) {
  return (
    <figure className="my-4 max-w-[460px]">
      {data.placeholder ? (
        <div className="border-[1.5px] border-dashed border-[#c9bcd8] rounded-lg text-[#7a5da0] text-xs text-center px-4 py-8 bg-[repeating-linear-gradient(45deg,#faf7fd,#faf7fd_8px,#f4eefb_8px,#f4eefb_16px)]">
          📷 Screenshot pending — {data.alt}
        </div>
      ) : (
        <div className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <img src={data.src} alt={data.alt} className="block w-full" />
          {data.boxes?.map((b, i) => (
            <span
              key={i}
              className="absolute border-2 border-primary-strong rounded-md shadow-[0_0_0_3px_rgba(75,40,109,0.15)] pointer-events-none"
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
            >
              {b.label && (
                <span className="absolute -top-6 left-0 whitespace-nowrap bg-primary-strong text-white text-[11px] font-semibold rounded px-2 py-0.5">
                  {b.label}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      {data.caption && <figcaption className="text-xs text-gray-500 mt-2">{renderInline(data.caption)}</figcaption>}
    </figure>
  )
}
