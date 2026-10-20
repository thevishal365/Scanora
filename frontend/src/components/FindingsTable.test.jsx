import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import AnalysisResultView from './AnalysisResultView'

function attentionValue(name, value, unit, referenceRange) {
  return { name, value, unit, reference_range: referenceRange }
}

const analysis = {
  overall_summary: 'Summary',
  reports: [
    {
      source_id: 'source-1',
      source_label: 'a.jpg',
      report_name: 'CBC',
      summary: 'Summary',
      key_findings: [],
      important_values: [
        attentionValue('Hemoglobin', '18.1', 'g/dL', '12.0 - 16.0'),
        attentionValue('HBsAg', 'Reactive', 'Not shown', 'Not shown'),
        // Flagged by the lab marker, but no usable reference range printed.
        attentionValue('Calcium', '9.5 H', 'mg/dL', 'Not shown'),
      ],
      simple_explanation: 'Explanation',
    },
  ],
}

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('findings table', () => {
  it('renders every attention value as one compact row with its status', () => {
    render(
      <AnalysisResultView analysis={analysis} analysisId="tid" onStartOver={() => {}} />,
    )

    const table = within(
      screen.getByRole('region', { name: 'Attention-worthy findings' }),
    ).getByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: 'Test / Parameter' }),
    ).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Result' })).toBeTruthy()
    expect(
      within(table).getByRole('columnheader', { name: 'Reference Range' }),
    ).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Status' })).toBeTruthy()

    expect(
      within(table).getByRole('row', {
        name: /Hemoglobin 18\.1 g\/dL Reference: 12\.0–16\.0 g\/dL Above the provided reference range\./i,
      }),
    ).toBeTruthy()
    expect(
      within(table).getByRole('row', {
        name: /HBsAg Reactive Explicitly flagged in the report\./i,
      }),
    ).toBeTruthy()
    expect(
      within(table).getByRole('row', {
        name: /Calcium 9\.5 H mg\/dL Explicitly flagged in the report\./i,
      }),
    ).toBeTruthy()

    // Placeholder labels are never presented as data.
    expect(within(table).queryByText(/not shown/i)).toBeNull()
    // No per-finding ask actions remain.
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
  })
})
