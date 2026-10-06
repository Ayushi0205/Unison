import type { RequiredPartialRule } from './types'
import { loadCollection, replaceAll } from './demo-store'

const SEED_RULES: RequiredPartialRule[] = [
  // Global rules (team: 'ALL') - apply to every team
  { id: 'rule-1', team: 'ALL', templateType: 'Onboarding', partialId: 'partial-legal-footer' },
  { id: 'rule-2', team: 'ALL', templateType: 'Onboarding', partialId: 'partial-unsubscribe' },
  { id: 'rule-3', team: 'ALL', templateType: 'Onboarding', partialId: 'partial-brand-header' },
  { id: 'rule-4', team: 'ALL', templateType: 'Recruitment', partialId: 'partial-legal-footer' },
  { id: 'rule-5', team: 'ALL', templateType: 'Recruitment', partialId: 'partial-unsubscribe' },
  { id: 'rule-6', team: 'ALL', templateType: 'Community Update', partialId: 'partial-gdpr-consent' },
  { id: 'rule-7', team: 'ALL', templateType: 'Community Update', partialId: 'partial-brand-header' },
  { id: 'rule-8', team: 'ALL', templateType: 'Transactional', partialId: 'partial-unsubscribe' },

  // Team-specific rules
  { id: 'rule-9', team: 'Enablement', templateType: 'Onboarding', partialId: 'partial-onboarding-welcome' },
  { id: 'rule-10', team: 'Enablement', templateType: 'Training', partialId: 'partial-training-cta' },
  { id: 'rule-11', team: 'Payments', templateType: 'Payment', partialId: 'partial-pay-schedule' },
  { id: 'rule-12', team: 'Payments', templateType: 'Payment', partialId: 'partial-payments-support' },
  { id: 'rule-13', team: 'Quality', templateType: 'Escalation', partialId: 'partial-escalation-banner' },
  { id: 'rule-14', team: 'Community', templateType: 'Community Update', partialId: 'partial-expert-profile' },
  { id: 'rule-15', team: 'Sourcing', templateType: 'Recruitment', partialId: 'partial-onboarding-welcome' },
]

export const REQUIRED_PARTIAL_RULES: RequiredPartialRule[] = loadCollection('rules', SEED_RULES)

export function saveRules(next: RequiredPartialRule[]): void {
  replaceAll('rules', REQUIRED_PARTIAL_RULES, next)
}
