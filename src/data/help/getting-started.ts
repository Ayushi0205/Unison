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
      { kind: 'intro', text: 'Four places to work, plus this help. Here is what each one is for.' },
      {
        kind: 'actionMap',
        data: { src: '/help-assets/app-shell.png', alt: 'Unison with the top bar and left sidebar' },
        markers: [
          { n: 1, x: 2.6, y: 11.2, label: 'Overview', desc: 'Coverage, drafts, and what needs attention across teams.' },
          { n: 2, x: 2.6, y: 16.2, label: 'Templates', desc: "Browse every team's templates." },
          { n: 3, x: 2.6, y: 21.2, label: 'Partials', desc: 'Browse the reusable blocks.' },
          { n: 4, x: 2.6, y: 26.2, label: 'Admin', desc: 'Required partials, projects, and new partials.', tag: 'Admin only' },
          { n: 5, x: 15.2, y: 16.2, label: 'Needs-review triangle', desc: 'Shows by Templates when a template is missing a required partial.', tag: 'Warning' },
          { n: 6, x: 21.0, y: 3.4, label: 'Demo', desc: 'Switch role, or reset the sample data.' },
          { n: 7, x: 93.9, y: 3.4, label: 'Account', desc: 'Your name, email, and role.' },
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
          ['Create and edit a template', 'Yes', 'Yes', '—'],
          ['Duplicate a template', 'Yes', 'Yes', '—'],
          ['Activate a template', 'Yes', 'Yes', '—'],
          ['Deactivate a template', 'Yes', '—', '—'],
          ['Create and edit a partial', 'Yes', '—', '—'],
          ['Duplicate a partial', 'Yes', 'Yes', '—'],
          ['Deactivate a partial', 'Yes', '—', '—'],
          ['Required partials, projects, and Admin', 'Yes', '—', '—'],
        ],
      },
      { kind: 'callout', variant: 'info', text: 'Roles are set by your workspace admin. In this demo, switch roles from the **Demo** menu in the top bar.' },
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
