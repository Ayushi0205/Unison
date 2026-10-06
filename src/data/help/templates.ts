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
            image: { src: '/help-assets/templates-more-filters.png', alt: 'The More filters panel', placeholder: true, caption: 'The More filters panel opens from the right.' },
          },
          { text: 'Your choices show as chips above the list. Select **Clear all** to reset them.' },
        ],
      },
      {
        kind: 'paragraph',
        text: 'Select a column heading — **Name**, **Team**, or **Updated** — to sort. Use the controls at the bottom to move between pages or change how many rows show.',
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
        data: { src: '/help-assets/template-detail.png', alt: 'A template detail page', placeholder: true },
        markers: [
          { n: 1, x: 40, y: 12, label: 'Status', desc: 'Draft, Active, or Inactive.' },
          { n: 2, x: 77, y: 12, label: 'Activate', desc: 'Publishes the template so it can send. Greyed out until the required partials are added.' },
          { n: 3, x: 90, y: 12, label: '··· menu', desc: 'Edit, Duplicate, and Delete.', tag: 'Delete = Draft only' },
          { n: 4, x: 70, y: 58, label: 'Partials used', desc: 'Any missing required partial shows here, with a link to the rule.' },
          { n: 5, x: 70, y: 85, label: 'Activity', desc: 'Who changed the template, and when.' },
        ],
      },
      { kind: 'heading', text: 'Duplicate a template' },
      {
        kind: 'steps',
        items: [
          { text: 'Open the **···** menu and select **Duplicate template**.' },
          { text: 'Confirm. A copy opens, named “Copy of …”.' },
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
      { kind: 'heading', text: 'Deactivate a template' },
      {
        kind: 'paragraph',
        text: 'Admins can select **Deactivate** on an Active template to stop it sending. It moves to Inactive and can be activated again later.',
      },
      { kind: 'heading', text: 'Delete a template' },
      {
        kind: 'steps',
        items: [
          { text: 'Open the **···** menu and select **Delete template**.' },
          { text: 'Confirm. This can’t be undone.' },
        ],
      },
      {
        kind: 'callout',
        variant: 'info',
        text: 'Only Draft templates can be deleted — one that was never activated. Editors can delete their own Drafts; admins can delete any Draft.',
      },
      {
        kind: 'image',
        data: { src: '/help-assets/template-detail-delete-design.png', alt: 'The delete-template confirmation', placeholder: true, caption: 'Design preview — a live screenshot will replace this.' },
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
