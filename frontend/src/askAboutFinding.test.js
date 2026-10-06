import { describe, expect, it } from 'vitest'
import {
  buildFindingQuestion,
  findingQuestionSuggestions,
} from './askAboutFinding'

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
      'Can you explain my Vitamin D result; value 12 ng/mL; reference range 20 - 50?',
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
      'Can you explain my HBsAg result; value Reactive?',
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
      'Can you explain my Calcium result; value 9.5 mg/dL?',
    )
    expect(question).not.toMatch(/reference range/i)
  })

  it('omits placeholder units instead of echoing them', () => {
    expect(
      buildFindingQuestion({ name: 'X', value: 'Trace', unit: 'Not shown', reference_range: '' }),
    ).toBe('Can you explain my X result; value Trace?')
    expect(
      buildFindingQuestion({ name: 'X', value: '5', unit: '', reference_range: '' }),
    ).toBe('Can you explain my X result; value 5?')
  })

  it('falls back to "this result" for a blank name', () => {
    expect(
      buildFindingQuestion({ name: '  ', value: '7', unit: '', reference_range: '' }),
    ).toBe('Can you explain my report result; value 7?')
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

describe('finding-specific question suggestions', () => {
  it('asks contextual educational questions for a low RBC result', () => {
    const finding = {
      name: 'RBC',
      value: '4.17',
      unit: 'million/cmm',
      reference_range: '4.7 - 6.2',
    }
    const suggestions = findingQuestionSuggestions(finding)
    expect(suggestions).toEqual([
      'What is RBC?',
      'Why might my RBC be low?',
      'What does my RBC result mean?',
    ])
    expect(buildFindingQuestion(finding, suggestions[1])).toBe(
      'About my RBC result; value 4.17 million/cmm; reference range 4.7 - 6.2: Why might my RBC be low?',
    )
  })

  it('asks contextual educational questions for a high platelet result', () => {
    const finding = {
      name: 'Platelets',
      value: '450',
      unit: '10^3/uL',
      reference_range: '150 - 400',
    }
    expect(findingQuestionSuggestions(finding)).toEqual([
      'What are platelets?',
      'Why might my platelet count be high?',
      'What does my platelet result mean?',
    ])
  })

  it('does not assume a direction when a finding is explicitly flagged', () => {
    expect(
      findingQuestionSuggestions({
        name: 'HBsAg',
        value: 'Reactive',
        unit: '',
        reference_range: 'Not shown',
      }),
    ).toEqual([
      'What is HBsAg?',
      'Why might my HBsAg be flagged?',
      'What does my HBsAg result mean?',
    ])
  })
})
