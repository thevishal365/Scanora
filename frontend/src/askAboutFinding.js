import { isMissingLabel, isRangeAvailable } from './needsAttention'

// Builds a concise, neutral chat question from a displayed finding card.
// Uses only the finding's own displayed fields (name, value, unit) — nothing
// is invented, and the question makes no diagnosis or treatment claim.
// Findings without a usable reference range get a variant that does not
// imply any range exists.
export function buildFindingQuestion(item) {
  const rawName = String(item?.name ?? '').trim()
  const subject = rawName ? `this ${rawName} result` : 'this result'
  const value = String(item?.value ?? '').trim()
  const unit = String(item?.unit ?? '').trim()
  const shownUnit = unit && !isMissingLabel(unit) ? ` ${unit}` : ''
  const valuePart = value ? ` (${value}${shownUnit})` : ''

  if (isRangeAvailable(item)) {
    return `Can you explain ${subject}${valuePart} and the reference range shown in the report?`
  }
  return `Can you explain ${subject}${valuePart} based on what is shown in the report?`
}
