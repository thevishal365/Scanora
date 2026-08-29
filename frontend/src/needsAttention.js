const MISSING_RANGE_LABELS = new Set([
  'not provided',
  'not shown',
  'unclear',
  'n/a',
  'na',
  '-',
  '—',
  '',
])

const ABNORMAL_FLAG =
  /\b(abnormal|high|low|positive|critical|flagged|panic|elevated|decreased|increased)\b/i

function parseNumber(text) {
  if (text == null) {
    return null
  }

  const match = String(text).trim().match(/-?\d+(?:\.\d+)?/)
  if (!match) {
    return null
  }

  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

function parseReferenceRange(rangeText) {
  if (rangeText == null) {
    return null
  }

  const text = String(rangeText).trim()
  if (MISSING_RANGE_LABELS.has(text.toLowerCase())) {
    return null
  }

  const between = text.match(
    /(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i,
  )
  if (between) {
    const min = Number(between[1])
    const max = Number(between[2])
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min, max }
    }
  }

  return null
}

function hasExplicitAbnormalFlag(item) {
  const valueText = String(item?.value ?? '')
  if (/(?:\bH\b|\bL\b|\bHH\b|\bLL\b|\*|↑|↓)/.test(valueText)) {
    return true
  }

  const flagText = [item?.value, item?.unit, item?.reference_range]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' ')

  return ABNORMAL_FLAG.test(flagText)
}

export function valueNeedsAttention(item) {
  if (!item) {
    return false
  }

  if (hasExplicitAbnormalFlag(item)) {
    return true
  }

  const range = parseReferenceRange(item.reference_range)
  const value = parseNumber(item.value)

  if (range == null || value == null) {
    return false
  }

  return value < range.min || value > range.max
}

export function valuesNeedingAttention(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return values.filter(valueNeedsAttention)
}

export function formatReferenceLine(item) {
  const range = String(item?.reference_range ?? '').trim()
  const unit = String(item?.unit ?? '').trim()

  if (!range || MISSING_RANGE_LABELS.has(range.toLowerCase())) {
    return null
  }

  const compactRange = range.replace(/\s*-\s*/g, '–')
  if (unit && !compactRange.includes(unit)) {
    return `Reference: ${compactRange} ${unit}`
  }

  return `Reference: ${compactRange}`
}

export function attentionNote(item) {
  const range = parseReferenceRange(item?.reference_range)
  const value = parseNumber(item?.value)

  if (range && value != null) {
    if (value > range.max) {
      return 'Above the provided reference range.'
    }
    if (value < range.min) {
      return 'Below the provided reference range.'
    }
  }

  return 'Explicitly flagged in the report.'
}

export function attentionKeyFinding(item) {
  const range = parseReferenceRange(item?.reference_range)
  const value = parseNumber(item?.value)
  const name = String(item?.name ?? 'This result').trim() || 'This result'

  if (range && value != null) {
    if (value > range.max) {
      return `${name} is above the reference range.`
    }
    if (value < range.min) {
      return `${name} is below the reference range.`
    }
  }

  return `${name} was explicitly flagged in the report.`
}
