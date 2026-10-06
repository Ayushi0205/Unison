import type { HelpArticle } from './schema'

export const GETTING_STARTED: HelpArticle[] = [
  {
    id: 'welcome',
    group: 'getting-started',
    title: 'Welcome to Unison',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      {
        kind: 'intro',
        text: 'Unison is where every team keeps the email templates it sends to contributors. Templates are built from reusable blocks called partials, so the messages people receive stay consistent and on-brand.',
      },
      {
        kind: 'paragraph',
        text: 'Pick a topic from the menu on the left. What you see depends on your access — admins manage partials and rules, editors build and manage templates, and everyone can browse and read.',
      },
      {
        kind: 'related',
        links: [
          { label: 'Finding your way around', to: '/help/finding-your-way-around' },
          { label: 'What each role can do', to: '/help/what-each-role-can-do' },
        ],
      },
    ],
  },
  {
    id: 'finding-your-way-around',
    group: 'getting-started',
    title: 'Finding your way around',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      { kind: 'intro', text: 'Three places to work, plus this help. Here is what each one is for.' },
      {
        kind: 'actionMap',
        data: { src: '/help-assets/app-shell.png', alt: 'The portal with the top bar and left sidebar', placeholder: true },
        markers: [
          { n: 1, x: 92, y: 7, label: 'Account menu', desc: 'Your name opens the menu, with **Sign out**.' },
          { n: 2, x: 9, y: 24, label: 'Templates', desc: "Browse every team's templates." },
          { n: 3, x: 9, y: 33, label: 'Partials', desc: 'Browse the reusable blocks.' },
          { n: 4, x: 9, y: 42, label: 'Admin', desc: 'Rules, projects, and new partials.', tag: 'Admin only' },
          { n: 5, x: 20, y: 24, label: 'Needs-review triangle', desc: 'Shows by Templates when a template is missing a required partial.', tag: 'Warning' },
        ],
      },
      { kind: 'paragraph', text: 'Search lives on the Templates and Partials pages, not the top bar.' },
      {
        kind: 'related',
        links: [
          { label: 'What each role can do', to: '/help/what-each-role-can-do' },
          { label: 'Why templates need review', to: '/help/why-templates-need-review' },
        ],
      },
    ],
  },
  {
    id: 'what-each-role-can-do',
    group: 'getting-started',
    title: 'What each role can do',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      { kind: 'intro', text: 'Three roles. Your role decides which actions you see.' },
      {
        kind: 'table',
        headers: ['What you can do', 'Admin', 'Editor', 'Viewer'],
        rows: [
          ['Browse and read templates and partials', 'Yes', 'Yes', 'Yes'],
          ['Duplicate a template', 'Yes', 'Yes', '—'],
          ['Activate a template', 'Yes', 'Yes', '—'],
          ['Deactivate a template', 'Yes', '—', '—'],
          ['Delete a Draft template', 'Any Draft', 'Own Drafts', '—'],
          ['Create and edit a partial', 'Yes', '—', '—'],
          ['Duplicate a partial', 'Yes', 'Yes', '—'],
          ['Activate or deactivate a partial', 'Yes', '—', '—'],
          ['Delete a partial', 'Yes', '—', '—'],
          ['Required partials, projects, and Admin', 'Yes', '—', '—'],
        ],
      },
      { kind: 'callout', variant: 'info', text: 'Roles are set by the platform team. If you need more access, ask your admin.' },
      {
        kind: 'related',
        links: [
          { label: 'Finding your way around', to: '/help/finding-your-way-around' },
          { label: 'Welcome to Unison', to: '/help/welcome' },
        ],
      },
    ],
  },
]
