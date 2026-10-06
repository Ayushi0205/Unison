import type { HelpArticle, HelpGroup } from './schema'
import { GETTING_STARTED } from './getting-started'
import { TEMPLATES } from './templates'
import { PARTIALS } from './partials'
import { GOVERNANCE } from './governance'
import { REFERENCE } from './reference'

/** Nav groups, in display order. */
export const HELP_GROUPS: HelpGroup[] = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'templates', title: 'Templates' },
  { id: 'partials', title: 'Partials' },
  { id: 'governance', title: 'Governance & compliance' },
  { id: 'reference', title: 'Reference' },
]

/** All articles, in display order. Single source of truth for nav, routing, and search. */
export const HELP_ARTICLES: HelpArticle[] = [
  ...GETTING_STARTED,
  ...TEMPLATES,
  ...PARTIALS,
  ...GOVERNANCE,
  ...REFERENCE,
]

/** Where /help redirects. */
export const FIRST_ARTICLE_ID = 'welcome'

export function getArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id)
}

export type { HelpArticle, HelpGroup } from './schema'
