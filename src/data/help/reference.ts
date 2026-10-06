import type { HelpArticle } from './schema'

export const REFERENCE: HelpArticle[] = [
  {
    id: 'glossary',
    group: 'reference',
    title: 'Glossary',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      { kind: 'intro', text: 'Plain-language definitions for the terms used across Unison.' },
      {
        kind: 'table',
        headers: ['Term', 'What it means'],
        rows: [
          ['Template', 'A complete email a team sends: subject, body, and the partials it includes.'],
          ['Partial', 'A reusable block (header, footer, unsubscribe line) used across many templates.'],
          ['Required partial', 'A partial that a rule says must be present on a certain type of template.'],
          ['Compliance', 'Whether a template includes all the partials its rules require.'],
          ['Project', 'A grouping of templates and rules, usually by client or program.'],
          ['Section', 'Where a block sits in an email: Header, Body, or Footer.'],
          ['Owning team', 'The team responsible for a template or partial.'],
          ['Status', 'A template or partial’s state: Draft, Active, or Inactive.'],
          ['Variable', 'A placeholder like {{ user.name }} that fills in with real data when the email sends.'],
        ],
      },
      {
        kind: 'related',
        links: [
          { label: 'Template statuses & lifecycle', to: '/help/template-statuses-and-lifecycle' },
          { label: 'What partials are', to: '/help/what-partials-are' },
        ],
      },
    ],
  },
  {
    id: 'template-statuses-and-lifecycle',
    group: 'reference',
    title: 'Template statuses & lifecycle',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      { kind: 'intro', text: 'A template is always in one of three states. The state decides whether it can send.' },
      {
        kind: 'diagram',
        nodes: [
          { label: 'Draft', desc: 'Being prepared. Never sent.' },
          { label: 'Active', desc: 'Live. Sends when triggered.', result: true },
          { label: 'Inactive', desc: 'Switched off. Won’t send.' },
        ],
      },
      {
        kind: 'table',
        headers: ['Status', 'What it means', 'Can it send?'],
        rows: [
          ['Draft', 'Being prepared, or never activated.', 'No'],
          ['Active', 'Live and ready.', 'Yes'],
          ['Inactive', 'Switched off after being active.', 'No'],
        ],
      },
      {
        kind: 'paragraph',
        text: 'A template can be activated only when it includes every required partial and none of the partials it uses are switched off.',
      },
      {
        kind: 'related',
        links: [
          { label: 'View a template', to: '/help/view-a-template' },
          { label: 'Why templates need review', to: '/help/why-templates-need-review' },
        ],
      },
    ],
  },
]
