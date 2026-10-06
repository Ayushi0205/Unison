import type { HelpArticle } from './schema'

export const TEMPLATES: HelpArticle[] = [
  {
    id: 'find-and-filter-templates',
    group: 'templates',
    title: 'Find & filter templates',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      { kind: 'intro', text: "The Templates page lists every team's templates. Filter it down to find the one you need." },
      {
        kind: 'steps',
        items: [
          { text: 'Type in **Search by name or subject** to match on a template’s name or subject line.' },
          { text: 'Narrow the list with the **Team**, **Type**, and **Status** filters.' },
          {
            text: 'Select **More filters** for project, owner, tag, and templates that need an update.',
            image: { src: '/help-assets/templates-more-filters.png', alt: 'The More filters panel', caption: 'The More filters panel opens from the right.' },
          },
          { text: 'Your choices show as chips above the list. Select **Clear all** to reset them.' },
        ],
      },
      {
        kind: 'paragraph',
        text: 'Select a column heading (**Name**, **Team**, or **Updated**) to sort. Use the controls at the bottom to move between pages or change how many rows show.',
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
  {
    id: 'view-a-template',
    group: 'templates',
    title: 'View a template & manage its lifecycle',
    roles: ['admin', 'editor', 'viewer'],
    permission: { roles: ['admin', 'editor'], note: 'viewers can read' },
    blocks: [
      { kind: 'intro', text: 'Open a template to read it and act on it. Everything about a template lives on this page.' },
      {
        kind: 'actionMap',
        data: { src: '/help-assets/template-detail.png', alt: 'A template detail page' },
        markers: [
          { n: 1, x: 42.4, y: 11.9, label: 'Status', desc: 'Draft, Active, or Inactive.' },
          { n: 2, x: 81.1, y: 12.0, label: 'Edit and Duplicate', desc: 'Change the template, or start from a copy.' },
          { n: 3, x: 94.4, y: 12.0, label: 'Activate', desc: 'Publishes the template so it can send. Greyed out, with the reasons on hover, until it is ready.' },
          { n: 4, x: 62.0, y: 18.1, label: 'Preview / HTML', desc: 'See it rendered with sample values, or read the source.' },
          { n: 5, x: 82.4, y: 72.5, label: 'Partials', desc: 'The partials this template uses.' },
          { n: 6, x: 79.1, y: 89.4, label: 'Missing required partial', desc: 'What a rule expects but the template lacks. **View rule** opens it.', tag: 'Warning' },
        ],
      },
      { kind: 'heading', text: 'Duplicate a template' },
      {
        kind: 'steps',
        items: [
          { text: 'Select **Duplicate**.' },
          { text: 'Confirm. A Draft copy is created, named “Copy of …”.' },
        ],
      },
      { kind: 'heading', text: 'Activate a template' },
      {
        kind: 'paragraph',
        text: 'Select **Activate** to publish a Draft or Inactive template. If it is missing a required partial, or uses a partial that is switched off, Activate stays greyed out and lists what to fix first.',
      },
      {
        kind: 'callout',
        variant: 'warning',
        text: 'A template can’t send until it is Active and passes its required-partial rules. See [Why templates need review](/help/why-templates-need-review).',
      },
      { kind: 'heading', text: 'Edit an Active template' },
      {
        kind: 'paragraph',
        text: 'Editing an Active template creates a new Draft. The Active version keeps sending until the Draft is activated.',
      },
      { kind: 'heading', text: 'Deactivate a template' },
      {
        kind: 'paragraph',
        text: 'Admins can select **Deactivate** on an Active template to stop it sending. It moves to Inactive and can be activated again later.',
      },
      {
        kind: 'related',
        links: [
          { label: 'Find & filter templates', to: '/help/find-and-filter-templates' },
          { label: 'Why templates need review', to: '/help/why-templates-need-review' },
          { label: 'Template statuses & lifecycle', to: '/help/template-statuses-and-lifecycle' },
        ],
      },
    ],
  },
]
