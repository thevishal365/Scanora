import { attentionNote, isMissingLabel, isRangeAvailable } from './needsAttention'

function findingDetails(item) {
  const rawName = String(item?.name ?? '').trim()
  const value = String(item?.value ?? '').trim()
  const unit = String(item?.unit ?? '').trim()
  const shownUnit = unit && !isMissingLabel(unit) ? ` ${unit}` : ''
  const details = [rawName ? `${rawName} result` : 'report result']

  if (value) {
    details.push(`value ${value}${shownUnit}`)
  }
  if (isRangeAvailable(item)) {
    details.push(`reference range ${String(item.reference_range).trim()}`)
  }

  return { name: rawName || 'this result', context: details.join('; ') }
}

export function buildFindingQuestion(item, question) {
  const { context } = findingDetails(item)

  if (question) {
    return `About my ${context}: ${question}`
  }

  return `Can you explain my ${context}?`
}

export function findingQuestionSuggestions(item) {
  const { name } = findingDetails(item)
  const note = attentionNote(item)
  const isPlatelets = name.toLowerCase() === 'platelets'
  const findingName = isPlatelets ? 'platelet count' : name
  const direction = note.startsWith('Below')
    ? 'low'
    : note.startsWith('Above')
      ? 'high'
      : null

  return [
    isPlatelets ? 'What are platelets?' : `What is ${name}?`,
    direction
      ? `Why might my ${findingName} be ${direction}?`
      : `Why might my ${findingName} be flagged?`,
    `What does my ${isPlatelets ? 'platelet' : name} result mean?`,
  ]
}
