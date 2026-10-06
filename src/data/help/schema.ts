import type { Role } from '../taxonomy'

/**
 * Help & Documentation content schema.
 *
 * This is intentionally FRAMEWORK-NEUTRAL, pure data:
 *  - every text field is a plain string (no JSX / React nodes)
 *  - inline links use markdown syntax: "See [Set required-partial rules](/help/set-required-partial-rules)."
 *    Internal links start with "/help/…" (or any app route); external links start with "http".
 *  - screenshot annotations are DATA (percent coordinates), never baked into the image
 *
 * Because it is pure data, the whole `HELP_ARTICLES` array serializes to JSON and can be
 * handed to the production team and rendered by any stack.
 */

export type HelpGroupId =
  | 'getting-started'
  | 'templates'
  | 'partials'
  | 'governance'
  | 'reference'

/** A screenshot with optional highlight-box overlays (drawn by the renderer, not baked in). */
export interface DocImageData {
  /** Path under /public, e.g. "/help-assets/partial-editor-toolbar.png". */
  src: string
  alt: string
  /** Short caption below the image. Supports inline markdown links. */
  caption?: string
  /** Highlight boxes over the image; coordinates are % of the rendered image (0–100). */
  boxes?: { x: number; y: number; w: number; h: number; label?: string }[]
  /** Render at the article's full width instead of the default 460px (for wide crops). */
  wide?: boolean
}

/** One numbered step. `text` supports **bold** (for UI labels) and inline links. */
export interface StepItem {
  text: string
  image?: DocImageData
}

/** A numbered marker on a page "action map" (orientation) image. */
export interface ActionMarker {
  n: number
  /** Marker position, % of the image (0–100). */
  x: number
  y: number
  /** Exact UI label, e.g. "Activate". */
  label: string
  /** One-line description. Supports inline markdown links. */
  desc: string
  /** Optional small tag, e.g. "Admin only", "Draft only". */
  tag?: string
}

/** A node in a simple process/lifecycle diagram. */
export interface DiagramNode {
  label: string
  desc?: string
  /** Terminal/result node renders in the success (green) style. */
  result?: boolean
}

/**
 * A content block. `text` fields are strings and may contain **bold** markers and
 * inline markdown links; the renderer is responsible for interpreting them.
 */
export type DocBlock =
  | { kind: 'intro'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: StepItem[] }
  | { kind: 'image'; data: DocImageData }
  | { kind: 'actionMap'; data: DocImageData; markers: ActionMarker[] }
  | { kind: 'diagram'; nodes: DiagramNode[] }
  | { kind: 'callout'; variant: 'info' | 'admin-only' | 'warning'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'result'; text: string }
  | { kind: 'related'; links: { label: string; to: string }[] }

export interface HelpArticle {
  /** URL slug and stable id, e.g. "create-a-partial". */
  id: string
  group: HelpGroupId
  title: string
  /** Roles allowed to see this article (in the nav and by direct URL). */
  roles: Role[]
  /** Optional "Who can do this" gate shown at the top of task articles. */
  permission?: { roles: Role[]; note?: string }
  blocks: DocBlock[]
}

export interface HelpGroup {
  id: HelpGroupId
  title: string
}
