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

const ABNORMAL_WORDS =
  /\b(abnormal|high|low|positive|critical|flagged|panic|elevated|decreased|increased|reactive|present|detected|trace)\b/i

// Explicitly normal/negative result wording. Checked against the value field
// first so negated phrases ("Non-reactive", "Not detected") can never match
// the abnormal words above through their second half.
const REASSURING_WORDS =
  /\b(negative|normal|absent|not detected|not reactive|non-?reactive|within normal( limits)?)\b/i

const ABNORMAL_MARKERS = /(?:\bH\b|\bL\b|\bHH\b|\bLL\b|\*|↑|↓)/

// Semi-quantitative presence grades (urinalysis-style 1+ to 4+). The leading
// boundary guard keeps plain numbers such as "12+" from matching.
const PRESENCE_GRADE = /(^|[^0-9])[1-4]\+/

const LEADING_OPERATOR = /^(<=|>=|<|>|≤|≥)?\s*(-?\d+(?:\.\d+)?)/

function normalizeOperator(raw) {
  if (raw === '≤') {
    return '<='
  }
  if (raw === '≥') {
    return '>='
  }
  return raw || null
}

// Parses a result value, preserving a leading inequality operator instead of
// silently reducing censored values such as "<0.1" to an exact measurement.
// Returns { number, operator } where operator is '<', '<=', '>', '>=', or
// null for an exact value. Returns null when no leading number exists, so
// qualitative text is never converted into a numeric value.
function parseValue(text) {
  if (text == null) {
    return null
  }

  const match = String(text).trim().match(LEADING_OPERATOR)
  if (!match) {
    return null
  }

  const number = Number(match[2])
  if (!Number.isFinite(number)) {
    return null
  }

  return { number, operator: normalizeOperator(match[1]) }
}

// Parses a reference range into { min, minInclusive, max, maxInclusive } with
// null for a missing side. Two-sided ranges stay inclusive on both ends
// (existing behavior). Single-sided ranges (<, >, <=, >=, ≤, ≥) carry the
// inclusivity of their operator. Anything else — including every
// MISSING_RANGE_LABELS entry such as "Not shown" — yields null and is
// therefore never parseable.
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
      return { min, minInclusive: true, max, maxInclusive: true }
    }
  }

  const single = text.match(/^\s*(<=|>=|<|>|≤|≥)\s*(-?\d+(?:\.\d+)?)/)
  if (single) {
    const bound = Number(single[2])
    if (Number.isFinite(bound)) {
      const operator = normalizeOperator(single[1])
      if (operator === '<' || operator === '<=') {
        return {
          min: null,
          minInclusive: true,
          max: bound,
          maxInclusive: operator === '<=',
        }
      }
      return {
        min: bound,
        minInclusive: operator === '>=',
        max: null,
        maxInclusive: true,
      }
    }
  }

  return null
}

// True only for a definitively normal/negative result: reassuring wording in
// the value with no abnormal signal left once that wording is removed. A
// value containing both (e.g. "Negative Positive") is not treated as normal.
function isExplicitlyNormal(item) {
  const valueText = String(item?.value ?? '')
  if (!REASSURING_WORDS.test(valueText)) {
    return false
  }
  const stripped = valueText.replace(REASSURING_WORDS, ' ')
  return (
    !ABNORMAL_WORDS.test(stripped) &&
    !PRESENCE_GRADE.test(stripped) &&
    !ABNORMAL_MARKERS.test(stripped)
  )
}

function hasExplicitAbnormalFlag(item) {
  if (isExplicitlyNormal(item)) {
    return false
  }

  const valueText = String(item?.value ?? '')
  if (ABNORMAL_MARKERS.test(valueText)) {
    return true
  }
  if (PRESENCE_GRADE.test(valueText)) {
    return true
  }

  const flagText = [item?.value, item?.unit, item?.reference_range]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' ')

  return ABNORMAL_WORDS.test(flagText)
}

// Interval comparison between a (possibly censored) value and a (possibly
// single-sided) range. Exact values against two-sided inclusive ranges
// behave exactly as before.
function definitelyBelow(parsed, range) {
  if (range.min == null || !Number.isFinite(range.min)) {
    return false
  }
  const { number: value, operator } = parsed
  if (operator === '>' || operator === '>=') {
    return false
  }
  if (operator === '<') {
    return value <= range.min
  }
  return value < range.min || (value === range.min && !range.minInclusive)
}

function definitelyAbove(parsed, range) {
  if (range.max == null || !Number.isFinite(range.max)) {
    return false
  }
  const { number: value, operator } = parsed
  if (operator === '<' || operator === '<=') {
    return false
  }
  if (operator === '>') {
    return value >= range.max
  }
  return value > range.max || (value === range.max && !range.maxInclusive)
}

function definitelyWithin(parsed, range) {
  const { number: value, operator } = parsed
  let lowerOk = true
  if (range.min != null && Number.isFinite(range.min)) {
    if (operator === '<' || operator === '<=') {
      lowerOk = false
    } else if (operator === '>') {
      lowerOk = value >= range.min
    } else if (operator === '>=') {
      lowerOk = value > range.min || (value === range.min && range.minInclusive)
    } else {
      lowerOk = value > range.min || (value === range.min && range.minInclusive)
    }
  }
  let upperOk = true
  if (range.max != null && Number.isFinite(range.max)) {
    if (operator === '>' || operator === '>=') {
      upperOk = false
    } else if (operator === '<') {
      upperOk = value <= range.max
    } else if (operator === '<=') {
      upperOk = value < range.max || (value === range.max && range.maxInclusive)
    } else {
      upperOk = value < range.max || (value === range.max && range.maxInclusive)
    }
  }
  return lowerOk && upperOk
}

function evaluateRange(parsed, range) {
  if (definitelyBelow(parsed, range)) {
    return 'below'
  }
  if (definitelyAbove(parsed, range)) {
    return 'above'
  }
  if (definitelyWithin(parsed, range)) {
    return 'within'
  }
  return 'unknown'
}

export function valueNeedsAttention(item) {
  if (!item) {
    return false
  }

  if (hasExplicitAbnormalFlag(item)) {
    return true
  }

  const range = parseReferenceRange(item.reference_range)
  const parsed = parseValue(item.value)

  if (range == null || parsed == null) {
    return false
  }

  const verdict = evaluateRange(parsed, range)
  return verdict === 'above' || verdict === 'below'
}

export function valuesNeedingAttention(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return values.filter(valueNeedsAttention)
}

export function isRangeAvailable(item) {
  return parseReferenceRange(item?.reference_range) != null
}

// True for placeholder labels ("Not shown", "Unclear", blank, …) as opposed
// to real displayed content. Read-only helper; changes no parser semantics.
export function isMissingLabel(text) {
  return MISSING_RANGE_LABELS.has(String(text ?? '').trim().toLowerCase())
}

export function valueUnableToEvaluate(item) {
  if (!item) {
    return false
  }

  // A definitively normal/negative result is evaluated, not missing.
  if (isExplicitlyNormal(item)) {
    return false
  }

  // Explicitly flagged results are evaluable as attention-worthy even
  // without a usable numeric range.
  if (hasExplicitAbnormalFlag(item)) {
    return false
  }

  const range = parseReferenceRange(item.reference_range)
  const parsed = parseValue(item.value)

  if (range == null || parsed == null) {
    return true
  }

  // Censored values that cannot be placed definitively inside or outside
  // the range are reported as unable-to-evaluate rather than guessed.
  return evaluateRange(parsed, range) === 'unknown'
}

export function valuesUnableToEvaluate(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return values.filter(valueUnableToEvaluate)
}

// Splits every value into exactly one bucket: attention-worthy, unable to
// evaluate, or within range (evaluated and not needing attention). Order is
// deliberate — attention is checked first so flagged items can never land in
// another bucket, and `withinRange` is the remainder, which keeps
// attention + withinRange + unable === every value with no double-counting.
// Each occurrence counts separately: the same test name in two reports is
// two distinct measurements.
export function partitionValues(values) {
  const attention = []
  const unable = []
  const withinRange = []
  if (!Array.isArray(values)) {
    return { attention, unable, withinRange }
  }
  for (const item of values) {
    if (valueNeedsAttention(item)) {
      attention.push(item)
    } else if (valueUnableToEvaluate(item)) {
      unable.push(item)
    } else {
      withinRange.push(item)
    }
  }
  return { attention, unable, withinRange }
}

export function formatReferenceLine(item) {
  const range = String(item?.reference_range ?? '').trim()
  const unit = String(item?.unit ?? '').trim()

  if (!range || MISSING_RANGE_LABELS.has(range.toLowerCase())) {
    return null
  }

  // Never present an unparseable string as a reference interval.
  if (parseReferenceRange(range) == null) {
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
  const parsed = parseValue(item?.value)

  if (range && parsed) {
    const verdict = evaluateRange(parsed, range)
    if (verdict === 'above') {
      return 'Above the provided reference range.'
    }
    if (verdict === 'below') {
      return 'Below the provided reference range.'
    }
  }

  return 'Explicitly flagged in the report.'
}

export function attentionKeyFinding(item) {
  const range = parseReferenceRange(item?.reference_range)
  const parsed = parseValue(item?.value)
  const name = String(item?.name ?? 'This result').trim() || 'This result'

  if (range && parsed) {
    const verdict = evaluateRange(parsed, range)
    if (verdict === 'above') {
      return `${name} is above the reference range.`
    }
    if (verdict === 'below') {
      return `${name} is below the reference range.`
    }
  }

  return `${name} was explicitly flagged in the report.`
}
