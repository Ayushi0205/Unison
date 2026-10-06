import type { HelpArticle } from './schema'

export const GOVERNANCE: HelpArticle[] = [
  {
    id: 'why-templates-need-review',
    group: 'governance',
    title: 'Why templates need review: required partials & compliance',
    roles: ['admin', 'editor', 'viewer'],
    blocks: [
      {
        kind: 'intro',
        text: 'Some templates must include certain partials before they can send — a legal footer, an unsubscribe line. This is how the portal makes sure those blocks are always there, not just available.',
      },
      {
        kind: 'paragraph',
        text: 'When a template is missing a partial that a rule requires, an orange triangle shows next to it, and the template lists the missing block with a link to the rule. Until it is added, the template can’t be activated.',
      },
      {
        kind: 'image',
        data: { src: '/help-assets/template-missing-partial.png', alt: 'A template flagged as missing a required partial', placeholder: true, caption: 'A template flagged as missing a required partial.' },
      },
      {
        kind: 'callout',
        variant: 'admin-only',
        text: 'Admins decide which partials are required, and for which template types. See [Set required-partial rules](/help/set-required-partial-rules).',
      },
      {
        kind: 'related',
        links: [
          { label: 'View a template', to: '/help/view-a-template' },
          { label: 'Set required-partial rules', to: '/help/set-required-partial-rules' },
          { label: 'What partials are', to: '/help/what-partials-are' },
        ],
      },
    ],
  },
  {
    id: 'set-required-partial-rules',
    group: 'governance',
    title: 'Set required-partial rules',
    roles: ['admin'],
    permission: { roles: ['admin'] },
    blocks: [
      {
        kind: 'intro',
        text: 'A rule makes a partial required for a template type — for one team, or for every team. When someone creates a matching template, the required partial is expected on it.',
      },
      { kind: 'heading', text: 'Add a rule' },
      {
        kind: 'steps',
        items: [
          { text: 'Go to **Admin → Required partials** and select **+ Add rule**.' },
          { text: 'Choose the **Team** — a single team, or All teams for a global rule.' },
          { text: 'Choose the **Template type** the rule applies to.' },
          {
            text: 'Select one or more **Partials** to require. You can pick several at once.',
            image: { src: '/help-assets/add-rule-panel.png', alt: 'The Add rule panel', placeholder: true, boxes: [{ x: 6, y: 55, w: 88, h: 30, label: 'Pick partials to require' }], caption: 'Choose the partials to require in the Add rule panel.' },
          },
          { text: 'Select **Save rule**.' },
        ],
      },
      {
        kind: 'callout',
        variant: 'warning',
        text: 'Header and Footer each allow only one required partial per team and type. A team-specific rule replaces the global one for that team.',
      },
      { kind: 'heading', text: 'Edit or remove a rule' },
      {
        kind: 'steps',
        items: [
          { text: 'On the Required partials page, open a rule’s **···** menu.' },
          { text: 'Select **Edit rule** to change it, or **Remove** to drop the requirement.' },
        ],
      },
      {
        kind: 'related',
        links: [
          { label: 'Why templates need review', to: '/help/why-templates-need-review' },
          { label: 'What partials are', to: '/help/what-partials-are' },
        ],
      },
    ],
  },
  {
    id: 'manage-projects',
    group: 'governance',
    title: 'Manage projects',
    roles: ['admin'],
    permission: { roles: ['admin'] },
    blocks: [
      {
        kind: 'intro',
        text: 'Projects group templates and rules, usually by client or program. Use them to filter the library and scope your work.',
      },
      { kind: 'heading', text: 'Add a project' },
      {
        kind: 'steps',
        items: [
          { text: 'Go to **Admin → Projects** and select **+ New project**.' },
          { text: 'Enter a **Name** and a **Customer**.' },
          { text: 'Select **Add project**.' },
        ],
      },
      { kind: 'paragraph', text: 'To change a project later, open its **···** menu and select **Edit**.' },
      {
        kind: 'callout',
        variant: 'info',
        text: 'A project can’t be deleted while templates still belong to it. Move or remove those templates first.',
      },
      {
        kind: 'related',
        links: [
          { label: 'Admin overview', to: '/help/admin-overview' },
          { label: 'Find & filter templates', to: '/help/find-and-filter-templates' },
        ],
      },
    ],
  },
  {
    id: 'admin-overview',
    group: 'governance',
    title: 'Admin overview',
    roles: ['admin'],
    blocks: [
      { kind: 'intro', text: 'The Admin area is where rules and shared blocks are set. It has three things.' },
      {
        kind: 'actionMap',
        data: { src: '/help-assets/admin-cards.png', alt: 'The Admin overview cards', placeholder: true },
        markers: [
          { n: 1, x: 20, y: 45, label: 'Required partials', desc: 'Set which partials each template type must include.' },
          { n: 2, x: 50, y: 45, label: 'Projects', desc: 'Group templates and rules by client or program.' },
          { n: 3, x: 80, y: 45, label: 'New partial', desc: 'Create a reusable block for teams to use.' },
        ],
      },
      {
        kind: 'related',
        links: [
          { label: 'Set required-partial rules', to: '/help/set-required-partial-rules' },
          { label: 'Manage projects', to: '/help/manage-projects' },
        ],
      },
    ],
  },
]
