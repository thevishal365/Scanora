import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import AnalysisResultView from './AnalysisResultView'

function flaggedValue(name, value, referenceRange) {
  return { name, value, unit: 'g/dL', reference_range: referenceRange }
}

const analysis = {
  overall_summary: 'Two reports',
  reports: [
    {
      source_id: 'source-1',
      source_label: 'a.jpg',
      report_name: 'Same Name',
      summary: 'First report',
      key_findings: [],
      important_values: [flaggedValue('Hemoglobin', '18.1', '12.0 - 16.0')],
      simple_explanation: 'First explanation',
    },
    {
      source_id: 'source-2',
      source_label: 'b.jpg',
      report_name: 'Same Name',
      summary: 'Second report',
      key_findings: [],
      important_values: [flaggedValue('Glucose', '55', '70 - 100')],
      simple_explanation: 'Second explanation',
    },
  ],
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('duplicate report names stay separate when rendered', () => {
  it('renders one group per source with its own findings and no key collisions', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AnalysisResultView analysis={analysis} analysisId="tid" onStartOver={() => {}} />,
    )

    // Two groups share a display name but render as separate groups in
    // both the findings section and the context section.
    const attention = screen.getByRole('region', { name: /identified values/i })
    expect(within(attention).getAllByText('Same Name')).toHaveLength(2)
    const context = screen.getByRole('region', { name: /report context & notes/i })
    expect(within(context).getAllByText('Same Name')).toHaveLength(2)

    // Each finding stays in its own source group.
    expect(screen.getByText('Hemoglobin')).toBeTruthy()
    expect(screen.getByText('Glucose')).toBeTruthy()
    expect(screen.getByText('First explanation')).toBeTruthy()
    expect(screen.getByText('Second explanation')).toBeTruthy()

    // No React duplicate-key warnings.
    const keyWarnings = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes('same key'),
    )
    expect(keyWarnings).toHaveLength(0)
  })
})

function overviewReport(sourceId, values) {
  return {
    source_id: sourceId,
    source_label: `${sourceId}.jpg`,
    report_name: `Report ${sourceId}`,
    summary: 'Summary',
    key_findings: [],
    important_values: values,
    simple_explanation: 'Explanation',
  }
}

function overviewValue(name, value, referenceRange) {
  return { name, value, unit: '', reference_range: referenceRange }
}

const IN_RANGE = overviewValue('Hemoglobin', '14', '12 - 16')
const HIGH = overviewValue('Hemoglobin', '18', '12 - 16')
const NO_RANGE = overviewValue('Calcium', '9.5', 'Not shown')
const QUALITATIVE = overviewValue('HBsAg', 'Reactive', 'Not shown')

function overviewCounts() {
  const region = screen.getByRole('region', { name: /results overview/i })
  const read = (label) =>
    Number(within(region).getByText(label).closest('div').querySelector('dd').textContent)
  return {
    evaluated: read('Results reviewed'),
    attention: read('Need attention'),
    within: read('No attention flag'),
    unable: read('Unable to evaluate'),
  }
}

function renderOverview(reports) {
  render(
    <AnalysisResultView
      analysis={{ overall_summary: 'Summary', reports }}
      analysisId="tid"
      onStartOver={() => {}}
    />,
  )
}

describe('results overview counts', () => {
  it('shows all results in range with no attention or unable', () => {
    renderOverview([overviewReport('source-1', [IN_RANGE, { ...IN_RANGE, name: 'Glucose', value: '90', reference_range: '70 - 100' }])])
    expect(overviewCounts()).toEqual({ evaluated: 2, attention: 0, within: 2, unable: 0 })
  })

  it('counts attention-worthy results separately', () => {
    renderOverview([overviewReport('source-1', [IN_RANGE, HIGH])])
    expect(overviewCounts()).toEqual({ evaluated: 2, attention: 1, within: 1, unable: 0 })
  })

  it('counts results without a usable range as unable, never within range', () => {
    renderOverview([overviewReport('source-1', [IN_RANGE, NO_RANGE])])
    expect(overviewCounts()).toEqual({ evaluated: 2, attention: 0, within: 1, unable: 1 })
  })

  it('handles mixed attention and unable-to-evaluate results', () => {
    renderOverview([overviewReport('source-1', [IN_RANGE, HIGH, NO_RANGE])])
    expect(overviewCounts()).toEqual({ evaluated: 3, attention: 1, within: 1, unable: 1 })
  })

  it('counts qualitative attention findings without a range', () => {
    renderOverview([overviewReport('source-1', [QUALITATIVE])])
    expect(overviewCounts()).toEqual({ evaluated: 1, attention: 1, within: 0, unable: 0 })
  })

  it('sums across multiple reports', () => {
    renderOverview([
      overviewReport('source-1', [HIGH]),
      overviewReport('source-2', [IN_RANGE, NO_RANGE]),
    ])
    expect(overviewCounts()).toEqual({ evaluated: 3, attention: 1, within: 1, unable: 1 })
  })

  it('counts duplicate test names across reports as separate measurements', () => {
    renderOverview([
      overviewReport('source-1', [HIGH]),
      overviewReport('source-2', [{ ...IN_RANGE }]),
    ])
    // Same test name twice: one above range, one within — both counted.
    expect(overviewCounts()).toEqual({ evaluated: 2, attention: 1, within: 1, unable: 0 })
  })

  it('shows a neutral empty state when there are zero results', () => {
    renderOverview([overviewReport('source-1', [])])
    expect(
      screen.getByText('No individual results were available to evaluate in these reports.'),
    ).toBeTruthy()
    expect(screen.queryByText('Results reviewed')).toBeNull()
  })

  it('labels a qualitative normal result as no flag, not as within range', () => {
    renderOverview([
      overviewReport('source-1', [
        { name: 'HBsAg', value: 'Negative', unit: '', reference_range: 'Not shown' },
      ]),
    ])
    expect(overviewCounts()).toEqual({ evaluated: 1, attention: 0, within: 1, unable: 0 })
    // The bucket must not imply a numeric reference range was involved.
    expect(screen.queryByText('Within the provided reference range')).toBeNull()
  })

  it('shows a neutral empty state when there are no reports', () => {
    renderOverview([])
    expect(
      screen.getByText('No individual results were available to evaluate in these reports.'),
    ).toBeTruthy()
  })

  it('never overlaps buckets: evaluated always equals the sum', () => {
    renderOverview([
      overviewReport('source-1', [IN_RANGE, HIGH, NO_RANGE, QUALITATIVE]),
      overviewReport('source-2', [HIGH, NO_RANGE]),
    ])
    const counts = overviewCounts()
    expect(counts).toEqual({ evaluated: 6, attention: 3, within: 1, unable: 2 })
    expect(counts.attention + counts.within + counts.unable).toBe(counts.evaluated)
  })
})
