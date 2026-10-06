import { REQUIRED_PARTIAL_RULES } from './required-partial-rules'
import { PARTIALS } from './partials'
import type { Template, RequiredPartialRule } from './types'

export interface RuleComplianceResult {
  applicableRules: RequiredPartialRule[]
  missingPartialIds: string[]
  missingPartialNames: string[]
}

export function evaluateTemplateCompliance(template: Template): RuleComplianceResult {
  // "Others" is a catch-all template type — by policy, no governance rules apply to it.
  if (template.templateType === 'Others') {
    return { applicableRules: [], missingPartialIds: [], missingPartialNames: [] }
  }
  const applicableRules = REQUIRED_PARTIAL_RULES.filter((r) => {
    if (r.templateType !== template.templateType) return false
    if (r.team !== 'ALL' && r.team !== template.owningTeam) return false
    if (r.programId && r.programId !== template.programId) return false
    return true
  })
  const missingPartialIds = applicableRules
    .map((r) => r.partialId)
    .filter((id) => !template.requiredPartialIds.includes(id))
  const uniqueMissing = Array.from(new Set(missingPartialIds))
  const missingPartialNames = uniqueMissing.map(
    (id) => PARTIALS.find((p) => p.id === id)?.name || id,
  )
  return {
    applicableRules,
    missingPartialIds: uniqueMissing,
    missingPartialNames,
  }
}
