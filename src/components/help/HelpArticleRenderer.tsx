import type { HelpArticle } from '../../data/help/schema'
import { PermissionGate } from './PermissionGate'
import { DocSteps } from './DocSteps'
import { DocImage } from './DocImage'
import { DocActionMap } from './DocActionMap'
import { DocDiagram } from './DocDiagram'
import { DocCallout } from './DocCallout'
import { DocTable } from './DocTable'
import { RelatedLinks } from './RelatedLinks'
import { ArticleFeedback } from './ArticleFeedback'
import { OnThisPage } from './OnThisPage'
import { slugify } from './slugify'
import { renderInline } from './renderInline'

export function HelpArticleRenderer({ article }: { article: HelpArticle }) {
  const headings = article.blocks.filter((b) => b.kind === 'heading').map((b) => b.text)

  return (
    <article className="max-w-[720px]">
      {article.permission && <PermissionGate roles={article.permission.roles} note={article.permission.note} />}
      <h1 className="text-primary-strong text-[25px] font-semibold tracking-tight mb-3">{article.title}</h1>
      <OnThisPage headings={headings} />
      {article.blocks.map((b, i) => {
        switch (b.kind) {
          case 'intro':
            return (
              <p key={i} className="text-[14.5px] text-[#3d4149] leading-relaxed mb-5 max-w-[62ch]">
                {renderInline(b.text)}
              </p>
            )
          case 'heading':
            return (
              <h2 key={i} id={slugify(b.text)} className="text-primary-strong text-[18px] font-semibold mt-7 mb-2 scroll-mt-20">
                {b.text}
              </h2>
            )
          case 'paragraph':
            return (
              <p key={i} className="text-[14px] text-[#3d4149] leading-relaxed my-3 max-w-[62ch]">
                {renderInline(b.text)}
              </p>
            )
          case 'steps':
            return <DocSteps key={i} items={b.items} />
          case 'image':
            return <DocImage key={i} data={b.data} />
          case 'actionMap':
            return <DocActionMap key={i} data={b.data} markers={b.markers} />
          case 'diagram':
            return <DocDiagram key={i} nodes={b.nodes} />
          case 'callout':
            return <DocCallout key={i} variant={b.variant} text={b.text} />
          case 'table':
            return <DocTable key={i} headers={b.headers} rows={b.rows} />
          case 'result':
            return (
              <div
                key={i}
                className="flex gap-2.5 items-start bg-[#e1f5ee] border border-[#b6e0d0] rounded-lg px-3.5 py-3 text-[13.5px] text-[#085041] max-w-[62ch] mt-1"
              >
                <span aria-hidden>✓</span>
                <div>{renderInline(b.text)}</div>
              </div>
            )
          case 'related':
            return <RelatedLinks key={i} links={b.links} />
          default:
            return null
        }
      })}
      <ArticleFeedback />
    </article>
  )
}
