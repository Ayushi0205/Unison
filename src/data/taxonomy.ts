// Ordered by the contributor journey: find → prepare → work → review → run → pay → engage → help.
export const OWNING_TEAMS = [
  'Sourcing', 'Enablement', 'Production', 'Quality',
  'Operations', 'Payments', 'Community', 'Support', 'Platform',
] as const
export type OwningTeam = typeof OWNING_TEAMS[number]

// Order follows the contributor lifecycle: acquire → join → learn → operate →
// measure → compensate → reward → nudge → engage → resolve → exit → fallback.
// Shared across all dropdowns and filters that iterate TEMPLATE_TYPES.
export const TEMPLATE_TYPES = [
  'Recruitment',
  'Onboarding',
  'Training',
  'Transactional',
  'Quality & Performance',
  'Payment',
  'Incentive',
  'Reminder',
  'Community Update',
  'Escalation',
  'Offboarding',
  'Others',
] as const
export type TemplateType = typeof TEMPLATE_TYPES[number]

// Which teams use each template type. Used to narrow the type dropdown and filter view
// when scoping rules by team. Keys ordered to match TEMPLATE_TYPES.
export const TEMPLATE_TYPE_APPLICABILITY: Record<TemplateType, OwningTeam[]> = {
  'Recruitment': ['Support', 'Sourcing', 'Community', 'Platform'],
  'Onboarding': ['Production', 'Operations', 'Payments', 'Enablement', 'Support', 'Sourcing', 'Community', 'Platform'],
  'Training': ['Production', 'Operations', 'Payments', 'Enablement', 'Support', 'Quality', 'Platform'],
  'Transactional': ['Quality', 'Production', 'Operations', 'Payments', 'Enablement', 'Support', 'Sourcing', 'Community', 'Platform'],
  'Quality & Performance': ['Quality', 'Production', 'Operations', 'Payments', 'Enablement', 'Platform'],
  'Payment': ['Payments', 'Production', 'Operations', 'Enablement', 'Sourcing', 'Quality', 'Platform'],
  'Incentive': ['Payments', 'Production', 'Operations', 'Enablement', 'Platform'],
  'Reminder': ['Sourcing', 'Community', 'Quality', 'Production', 'Operations', 'Payments', 'Enablement', 'Support', 'Platform'],
  'Community Update': ['Community', 'Sourcing', 'Platform'],
  'Escalation': ['Quality', 'Platform'],
  'Offboarding': ['Production', 'Operations', 'Payments', 'Enablement', 'Sourcing', 'Platform'],
  'Others': ['Sourcing', 'Community', 'Quality', 'Production', 'Operations', 'Payments', 'Enablement', 'Support', 'Platform'],
}

export const PARTIAL_SECTIONS = ['Header', 'Body', 'Footer'] as const
export type PartialSection = typeof PARTIAL_SECTIONS[number]

export const PARTIAL_SECTION_DESCRIPTIONS: Record<PartialSection, string> = {
  Header: 'Top of the email. Brand banners or welcome blocks. Only one per template.',
  Body: 'Main content. Multiple body partials can be stacked in a template. Global and team rules both apply.',
  Footer: 'Bottom of the email. Legal text, unsubscribe, branding. Only one per template.',
}

export type ContentType = 'structured' | 'html' | 'text'
export type Lifecycle = 'Draft' | 'Active' | 'Inactive'
export type Role = 'admin' | 'editor' | 'viewer'
