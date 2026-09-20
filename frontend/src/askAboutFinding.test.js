import { describe, expect, it } from 'vitest'
import { buildFindingQuestion } from './askAboutFinding'

describe('buildFindingQuestion', () => {
  it('builds the reference-range question from displayed fields only', () => {
    expect(
      buildFindingQuestion({
        name: 'Vitamin D',
        value: '12',
        unit: 'ng/mL',
        reference_range: '20 - 50',
      }),
    ).toBe(
      'Can you explain this Vitamin D result (12 ng/mL) and the reference range shown in the report?',
    )
  })

  it('asks a neutral question for qualitative findings without inventing interpretation', () => {
    expect(
      buildFindingQuestion({
        name: 'HBsAg',
        value: 'Reactive',
        unit: 'Not shown',
        reference_range: 'Not shown',
      }),
    ).toBe(
      'Can you explain this HBsAg result (Reactive) based on what is shown in the report?',
    )
  })

  it('does not imply a range exists when none is usable', () => {
    const question = buildFindingQuestion({
      name: 'Calcium',
      value: '9.5',
      unit: 'mg/dL',
      reference_range: 'Not shown',
    })
    expect(question).toBe(
      'Can you explain this Calcium result (9.5 mg/dL) based on what is shown in the report?',
    )
    expect(question).not.toMatch(/reference range/i)
  })

  it('omits placeholder units instead of echoing them', () => {
    expect(
      buildFindingQuestion({ name: 'X', value: 'Trace', unit: 'Not shown', reference_range: '' }),
    ).toBe('Can you explain this X result (Trace) based on what is shown in the report?')
    expect(
      buildFindingQuestion({ name: 'X', value: '5', unit: '', reference_range: '' }),
    ).toBe('Can you explain this X result (5) based on what is shown in the report?')
  })

  it('falls back to "this result" for a blank name', () => {
    expect(
      buildFindingQuestion({ name: '  ', value: '7', unit: '', reference_range: '' }),
    ).toBe(
      'Can you explain this result (7) based on what is shown in the report?',
    )
  })

  it('never makes diagnosis or treatment claims', () => {
    const questions = [
      buildFindingQuestion({ name: 'A', value: '1', unit: 'u', reference_range: '0 - 2' }),
      buildFindingQuestion({ name: 'B', value: 'Positive', unit: '', reference_range: '' }),
      buildFindingQuestion({}),
    ]
    for (const question of questions) {
      expect(question).not.toMatch(/diagnos|treat|medicat|prescrib|disease|should I/i)
    }
  })
})
