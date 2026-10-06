import type { HelpArticle } from './schema'

export const PARTIALS: HelpArticle[] = [
  {
    id: 'what-partials-are',
    group: 'partials',
    title: 'What partials are',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      {
        kind: 'intro',
        text: 'A partial is a block you build once and reuse across templates — a header, a footer, an unsubscribe line, a support-contact block.',
      },
      {
        kind: 'paragraph',
        text: 'Change a partial in one place and every template that uses it updates on the next send. That is what keeps the emails contributors receive consistent, without anyone re-editing each template.',
      },
      {
        kind: 'paragraph',
        text: 'For example, one Legal Footer partial sits in dozens of templates. Update the address in the footer once, and every one of those templates carries the new address the next time it sends.',
      },
      {
        kind: 'callout',
        variant: 'info',
        text: 'Making a partial required for certain templates is a separate, admin-only feature built on top of this — see [Why templates need review](/help/why-templates-need-review). Required rules enforce consistency; the reuse itself is what a partial is for.',
      },
      {
        kind: 'related',
        links: [
          { label: 'Create, edit & manage a partial', to: '/help/create-edit-manage-a-partial' },
          { label: 'Why templates need review', to: '/help/why-templates-need-review' },
        ],
      },
    ],
  },
  {
    id: 'find-and-view-a-partial',
    group: 'partials',
    title: 'Find & view a partial',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      { kind: 'intro', text: "The Partials page lists every reusable block. Open one to see where it's used before you change it." },
      {
        kind: 'actionMap',
        data: { src: '/help-assets/partial-detail.png', alt: 'A partial detail page', placeholder: true },
        markers: [
          { n: 1, x: 40, y: 12, label: 'Status', desc: 'Active or Inactive.' },
          { n: 2, x: 30, y: 26, label: 'Preview / Source', desc: 'See it rendered, or read the raw markup.' },
          { n: 3, x: 70, y: 40, label: 'Variables', desc: 'The values it fills in at send time.' },
          { n: 4, x: 70, y: 62, label: 'Used in templates', desc: 'Every template that includes this partial.' },
          { n: 5, x: 70, y: 85, label: 'Activity', desc: 'Who changed it, and when.' },
        ],
      },
      {
        kind: 'paragraph',
        text: "The list shows each partial's team, section, status, and how many templates use it. Search by name or content, or filter by team, section, and status.",
      },
      {
        kind: 'related',
        links: [
          { label: 'What partials are', to: '/help/what-partials-are' },
          { label: 'Create, edit & manage a partial', to: '/help/create-edit-manage-a-partial' },
        ],
      },
    ],
  },
  {
    id: 'create-edit-manage-a-partial',
    group: 'partials',
    title: 'Create, edit & manage a partial',
    roles: ['admin'],
    permission: { roles: ['admin'] },
    blocks: [
      {
        kind: 'intro',
        text: 'A partial is a block you build once and reuse across templates — a footer, an unsubscribe line, a support-contact block. Change it in one place and every template that uses it updates on the next send.',
      },
      { kind: 'heading', text: 'Create a partial' },
      {
        kind: 'steps',
        items: [
          { text: 'On the **Partials** page, select **+ New partial**.' },
          { text: 'Choose the **Section** — Header, Body, or Footer. A template holds one Header, one Footer, and any number of Body blocks.' },
          { text: 'Choose the **Authoring Team** that owns the block.' },
          {
            text: 'Write the content. To include a value that fills in when the email is sent, select **Insert variable** — it appears as a chip, {{ user.name }}.',
            image: { src: '/help-assets/partial-editor-toolbar.png', alt: 'The partial editor toolbar', placeholder: true, boxes: [{ x: 68, y: 12, w: 26, h: 60, label: 'Insert variable' }], caption: 'Only the Insert variable control is highlighted — the text carries the rest.' },
          },
          { text: 'Check the preview on the right, then select **Save**.' },
        ],
      },
      { kind: 'result', text: 'Saved as Active. The partial is ready to add to any template in the matching section.' },
      { kind: 'heading', text: 'Edit a partial' },
      {
        kind: 'steps',
        items: [
          { text: 'Open the partial and select **Edit**.' },
          { text: 'Make your changes and select **Save**.' },
        ],
      },
      {
        kind: 'paragraph',
        text: "Editing changes the partial everywhere it is used, on the next send. The templates that use it are listed on the partial's page, so you can see the reach before you save.",
      },
      { kind: 'heading', text: 'Duplicate a partial' },
      {
        kind: 'paragraph',
        text: 'Select **Duplicate** to start from a copy. Editors can duplicate a partial too, even though creating and editing are admin-only.',
      },
      { kind: 'heading', text: 'Deactivate a partial' },
      {
        kind: 'paragraph',
        text: 'Select **Deactivate** to take a partial out of use. It is blocked while a template still uses the partial or a rule still requires it — the button shows how many templates to resolve first.',
      },
      { kind: 'heading', text: 'Delete a partial' },
      {
        kind: 'diagram',
        nodes: [
          { label: 'Remove from templates & rules' },
          { label: 'Deactivate' },
          { label: 'Delete', result: true },
        ],
      },
      {
        kind: 'paragraph',
        text: 'A partial can only be deleted once it is Deactivated. Remove it from any templates and rules, deactivate it, then delete.',
      },
      {
        kind: 'related',
        links: [
          { label: 'What partials are', to: '/help/what-partials-are' },
          { label: 'Set required-partial rules', to: '/help/set-required-partial-rules' },
          { label: 'Template statuses & lifecycle', to: '/help/template-statuses-and-lifecycle' },
        ],
      },
    ],
  },
]
