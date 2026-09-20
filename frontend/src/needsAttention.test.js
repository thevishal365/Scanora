import { describe, expect, it } from 'vitest'
import {
  attentionKeyFinding,
  attentionNote,
  formatReferenceLine,
  isRangeAvailable,
  partitionValues,
  valueNeedsAttention,
  valueUnableToEvaluate,
  valuesNeedingAttention,
  valuesUnableToEvaluate,
} from './needsAttention'

const IN_RANGE = {
  name: 'Hemoglobin',
  value: '13.2',
  unit: 'g/dL',
  reference_range: '12.0 - 16.0',
}

const HIGH = { ...IN_RANGE, value: '18.1' }
const LOW = { ...IN_RANGE, value: '9.4' }
const MISSING_RANGE = { ...IN_RANGE, reference_range: 'Not shown' }
const UNCLEAR_RANGE = { ...IN_RANGE, reference_range: 'Unclear' }
const NULL_RANGE = { ...IN_RANGE, reference_range: null }
const NON_NUMERIC = {
  name: 'Urine protein',
  value: 'Trace',
  unit: 'Not shown',
  reference_range: 'Not shown',
}
const FLAGGED_NO_RANGE = { ...MISSING_RANGE, value: '13.2 H' }

describe('missing reference ranges are never treated as within range', () => {
  it('does not flag a missing-range value as needing attention', () => {
    expect(valueNeedsAttention(MISSING_RANGE)).toBe(false)
    expect(valueNeedsAttention(UNCLEAR_RANGE)).toBe(false)
    expect(valueNeedsAttention(NULL_RANGE)).toBe(false)
  })

  it('marks missing-range values as unable to evaluate', () => {
    expect(valueUnableToEvaluate(MISSING_RANGE)).toBe(true)
    expect(valueUnableToEvaluate(UNCLEAR_RANGE)).toBe(true)
    expect(valueUnableToEvaluate(NULL_RANGE)).toBe(true)
  })

  it('flags a qualitative presence result as attention, not unable', () => {
    // M3: "Trace" is a detectable presence signal, so it is evaluable as
    // attention-worthy rather than missing information.
    expect(valueNeedsAttention(NON_NUMERIC)).toBe(true)
    expect(valueUnableToEvaluate(NON_NUMERIC)).toBe(false)
  })

  it('hides the reference line when no usable range exists', () => {
    expect(formatReferenceLine(MISSING_RANGE)).toBeNull()
    expect(formatReferenceLine(NULL_RANGE)).toBeNull()
    expect(formatReferenceLine(IN_RANGE)).toContain('12.0')
  })

  it('reports range availability', () => {
    expect(isRangeAvailable(IN_RANGE)).toBe(true)
    expect(isRangeAvailable(MISSING_RANGE)).toBe(false)
  })
})

describe('evaluable results keep their behavior', () => {
  it('flags out-of-range values in both directions', () => {
    expect(valueNeedsAttention(HIGH)).toBe(true)
    expect(valueNeedsAttention(LOW)).toBe(true)
    expect(valueUnableToEvaluate(HIGH)).toBe(false)
    expect(valueUnableToEvaluate(LOW)).toBe(false)
  })

  it('does not flag in-range values', () => {
    expect(valueNeedsAttention(IN_RANGE)).toBe(false)
    expect(valueUnableToEvaluate(IN_RANGE)).toBe(false)
  })

  it('treats explicitly flagged values as attention, not unable', () => {
    expect(valueNeedsAttention(FLAGGED_NO_RANGE)).toBe(true)
    expect(valueUnableToEvaluate(FLAGGED_NO_RANGE)).toBe(false)
  })

  it('partitions a mixed list without overlap', () => {
    const values = [IN_RANGE, HIGH, MISSING_RANGE, NON_NUMERIC, FLAGGED_NO_RANGE]
    const attention = valuesNeedingAttention(values)
    const unable = valuesUnableToEvaluate(values)
    // HIGH, NON_NUMERIC (trace), FLAGGED_NO_RANGE flag; only the
    // range-less numeric MISSING_RANGE is unable to evaluate.
    expect(attention).toHaveLength(3)
    expect(unable).toHaveLength(1)
    expect(unable[0]).toBe(MISSING_RANGE)
    const overlap = attention.filter((item) => unable.includes(item))
    expect(overlap).toHaveLength(0)
  })

  it('handles non-array input safely', () => {
    expect(valuesNeedingAttention(null)).toEqual([])
    expect(valuesUnableToEvaluate(undefined)).toEqual([])
    expect(valueUnableToEvaluate(null)).toBe(false)
  })
})

function lab(value, referenceRange, name = 'Test') {
  return { name, value, unit: '', reference_range: referenceRange }
}

describe('1. two-sided reference ranges', () => {
  it('supports dash, en-dash, and "to" separators', () => {
    expect(valueNeedsAttention(lab('18', '12 - 16'))).toBe(true)
    expect(valueNeedsAttention(lab('18', '12 – 16'))).toBe(true)
    expect(valueNeedsAttention(lab('18', '12 to 16'))).toBe(true)
    expect(valueNeedsAttention(lab('14', '12 to 16'))).toBe(false)
  })

  it('handles decimals and negative bounds inclusively', () => {
    expect(valueNeedsAttention(lab('-6', '-5 - 5'))).toBe(true)
    expect(valueNeedsAttention(lab('-5', '-5 - 5'))).toBe(false)
    expect(valueNeedsAttention(lab('0.25', '0.20 - 0.30'))).toBe(false)
    expect(valueNeedsAttention(lab('0.31', '0.20 - 0.30'))).toBe(true)
  })
})

describe('2. single-sided reference ranges', () => {
  it.each([
    ['<5', '3', false],
    ['<5', '7', true],
    ['<=5', '5', false],
    ['<=5', '6', true],
    ['≤5', '5', false],
    ['≤5', '6', true],
    ['>5', '7', false],
    ['>5', '3', true],
    ['>=5', '5', false],
    ['>=5', '4', true],
    ['≥5', '5', false],
    ['≥5', '4', true],
  ])('range %s with value %s flags %s', (range, value, expected) => {
    expect(valueNeedsAttention(lab(value, range))).toBe(expected)
  })

  it('tolerates spacing and trailing units in the range', () => {
    expect(valueNeedsAttention(lab('3', '< 5 mg/dL'))).toBe(false)
    expect(valueNeedsAttention(lab('7', '> 5'))).toBe(false)
    expect(valueNeedsAttention(lab('3', '> 5'))).toBe(true)
  })

  it('marks single-sided ranges as available with a reference line', () => {
    expect(isRangeAvailable(lab('3', '<5'))).toBe(true)
    expect(formatReferenceLine(lab('3', '<5'))).toContain('<5')
  })
})

describe('3. equality boundaries', () => {
  it('treats two-sided bounds as inclusive', () => {
    expect(valueNeedsAttention(lab('12.0', '12.0 - 16.0'))).toBe(false)
    expect(valueNeedsAttention(lab('16.0', '12.0 - 16.0'))).toBe(false)
    expect(valueUnableToEvaluate(lab('12.0', '12.0 - 16.0'))).toBe(false)
  })

  it('distinguishes inclusive from exclusive single-sided bounds', () => {
    expect(valueNeedsAttention(lab('5', '>=5'))).toBe(false)
    expect(valueNeedsAttention(lab('5', '>5'))).toBe(true)
    expect(valueNeedsAttention(lab('5', '<=5'))).toBe(false)
    expect(valueNeedsAttention(lab('5', '<5'))).toBe(true)
    expect(valueNeedsAttention(lab('5', '≥5'))).toBe(false)
    expect(valueNeedsAttention(lab('5', '≤5'))).toBe(false)
  })

  it('evaluates censored values sitting exactly on a bound', () => {
    // "<5" against 5–10 is entirely below the range: attention.
    expect(valueNeedsAttention(lab('<5', '5 - 10'))).toBe(true)
    // ">10" against 5–10 touches only the inclusive bound: attention.
    expect(valueNeedsAttention(lab('>10', '5 - 10'))).toBe(true)
  })
})

describe('4. inequality value expressions', () => {
  it('never treats a censored value as an exact measurement', () => {
    // "<0.1" against 0.0–0.5 could be below the range or inside it:
    // honestly unable to evaluate, never a quiet "within range".
    const item = lab('<0.1', '0.0 - 0.5')
    expect(valueNeedsAttention(item)).toBe(false)
    expect(valueUnableToEvaluate(item)).toBe(true)
  })

  it('flags censored values that are entirely outside the range', () => {
    expect(valueNeedsAttention(lab('<0.1', '0.2 - 0.5'))).toBe(true)
    expect(valueNeedsAttention(lab('>12', '5 - 10'))).toBe(true)
    expect(valueUnableToEvaluate(lab('<0.1', '0.2 - 0.5'))).toBe(false)
  })

  it('recognizes censored values entirely inside a one-sided range', () => {
    const lower = lab('>12', '>=5')
    expect(valueNeedsAttention(lower)).toBe(false)
    expect(valueUnableToEvaluate(lower)).toBe(false)
    const upper = lab('<3', '<5')
    expect(valueNeedsAttention(upper)).toBe(false)
    expect(valueUnableToEvaluate(upper)).toBe(false)
  })

  it('marks unplaceable censored values as unable to evaluate', () => {
    // ">=5" against 5–10 could be inside or above: unknown.
    const item = lab('>=5', '5 - 10')
    expect(valueNeedsAttention(item)).toBe(false)
    expect(valueUnableToEvaluate(item)).toBe(true)
  })
})

describe('5. malformed ranges', () => {
  it.each(['see note', 'varies', '5', '5-', 'abc', '<', '>', '≤'])(
    'treats %s as unavailable, never parseable',
    (range) => {
      const item = lab('7', range)
      expect(isRangeAvailable(item)).toBe(false)
      expect(valueNeedsAttention(item)).toBe(false)
      expect(valueUnableToEvaluate(item)).toBe(true)
      expect(formatReferenceLine(item)).toBeNull()
    },
  )
})

describe('6. missing ranges', () => {
  it.each(['Not shown', 'Unclear', 'N/A', '-', '', null, 'not provided'])(
    'treats %s as unable to evaluate',
    (range) => {
      const item = lab('13.2', range)
      expect(valueNeedsAttention(item)).toBe(false)
      expect(valueUnableToEvaluate(item)).toBe(true)
      expect(isRangeAvailable(item)).toBe(false)
    },
  )
})

describe('7. qualitative attention signals', () => {
  it.each(['Reactive', 'Present', 'Detected', 'Trace', 'trace', '2+', '3+', '1+'])(
    'flags %s as attention-worthy without inventing numbers',
    (value) => {
      const item = lab(value, 'Not shown')
      expect(valueNeedsAttention(item)).toBe(true)
      expect(valueUnableToEvaluate(item)).toBe(false)
    },
  )

  it('keeps existing explicit flags working', () => {
    expect(valueNeedsAttention(lab('13.2 H', 'Not shown'))).toBe(true)
    expect(valueNeedsAttention(lab('High', 'Not shown'))).toBe(true)
    expect(valueNeedsAttention(lab('Abnormal', 'Not shown'))).toBe(true)
  })

  it('uses the flagged fallback note for qualitative findings', () => {
    expect(attentionNote(lab('Reactive', 'Not shown'))).toBe(
      'Explicitly flagged in the report.',
    )
    expect(attentionKeyFinding({ name: 'HBsAg', value: 'Reactive', unit: '', reference_range: 'Not shown' })).toBe(
      'HBsAg was explicitly flagged in the report.',
    )
  })
})

describe('8. explicitly negative and normal values', () => {
  it.each([
    'Negative',
    'NEGATIVE',
    'Normal',
    'Absent',
    'Not detected',
    'Not reactive',
    'Non-reactive',
    'Nonreactive',
    'Within normal limits',
  ])('never flags %s, and treats it as evaluated', (value) => {
    const item = lab(value, 'Not shown')
    expect(valueNeedsAttention(item)).toBe(false)
    expect(valueUnableToEvaluate(item)).toBe(false)
  })

  it('still flags a positive result against a negative reference', () => {
    const item = lab('Positive', 'Negative')
    expect(valueNeedsAttention(item)).toBe(true)
    expect(valueUnableToEvaluate(item)).toBe(false)
  })

  it('does not let a negated phrase flag through its second half', () => {
    // The hyphen in "Non-reactive" creates a word boundary before
    // "reactive"; the reassuring-value guard must win regardless.
    expect(valueNeedsAttention(lab('Non-reactive', '12 - 16'))).toBe(false)
  })
})

describe('9. "Not shown" is never parseable', () => {
  it('keeps high numeric values with no range out of attention', () => {
    const item = lab('99', 'Not shown')
    expect(valueNeedsAttention(item)).toBe(false)
    expect(valueUnableToEvaluate(item)).toBe(true)
    expect(isRangeAvailable(item)).toBe(false)
    expect(formatReferenceLine(item)).toBeNull()
  })
})

describe('directional notes for single-sided findings', () => {
  it('describes above/below against single-sided ranges', () => {
    expect(attentionNote(lab('7', '<5'))).toBe('Above the provided reference range.')
    expect(attentionNote(lab('3', '>5'))).toBe('Below the provided reference range.')
    expect(attentionKeyFinding({ name: 'Glucose', value: '7', unit: '', reference_range: '<5' })).toBe(
      'Glucose is above the reference range.',
    )
  })
})

describe('input safety is preserved', () => {
  it('handles non-array input safely', () => {
    expect(valuesNeedingAttention(null)).toEqual([])
    expect(valuesUnableToEvaluate(undefined)).toEqual([])
    expect(valueUnableToEvaluate(null)).toBe(false)
  })
})

describe('partitionValues counts every value exactly once', () => {
  it('splits a mixed list with no overlap and no gaps', () => {
    const inRange = lab('14', '12 - 16', 'A')
    const high = lab('18', '12 - 16', 'B')
    const noRange = lab('13.2', 'Not shown', 'C')
    const qualitative = lab('Reactive', 'Not shown', 'D')
    const normal = lab('Negative', 'Not shown', 'E')
    const malformed = lab('7', 'see note', 'F')
    const duplicateHigh = lab('18', '12 - 16', 'B')
    const values = [inRange, high, noRange, qualitative, normal, malformed, duplicateHigh]

    const { attention, unable, withinRange } = partitionValues(values)
    expect(attention).toEqual([high, qualitative, duplicateHigh])
    expect(unable).toEqual([noRange, malformed])
    expect(withinRange).toEqual([inRange, normal])
    // Sum invariant: every value lands in exactly one bucket.
    expect(attention.length + unable.length + withinRange.length).toBe(values.length)
  })

  it('returns empty buckets for non-array input', () => {
    expect(partitionValues(null)).toEqual({ attention: [], unable: [], withinRange: [] })
    expect(partitionValues(undefined)).toEqual({ attention: [], unable: [], withinRange: [] })
  })
})
