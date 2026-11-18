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

describe('attention findings list', () => {
  it('renders every attention value as a concise bullet without reference columns', () => {
    render(
      <AnalysisResultView analysis={analysis} analysisId="tid" onStartOver={() => {}} />,
    )

    const findings = screen.getByRole('list', { name: 'Key findings needing attention' })
    expect(
      within(findings).getByText(
        'Hemoglobin: 18.1 g/dL — Above the provided reference range.',
      ),
    ).toBeTruthy()
    expect(
      within(findings).getByText('HBsAg: Reactive — Explicitly flagged in the report.'),
    ).toBeTruthy()
    expect(
      within(findings).getByText(
        'Calcium: 9.5 H mg/dL — Explicitly flagged in the report.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/not shown/i)).toBeNull()
  })
})
