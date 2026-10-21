import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import AnalysisResultView from './AnalysisResultView'

function value(name, result, unit, referenceRange) {
  return { name, value: result, unit, reference_range: referenceRange }
}

function report(sourceId, reportName, importantValues, summary = 'Report summary') {
  return {
    source_id: sourceId,
    source_label: `${sourceId}.jpg`,
    report_name: reportName,
    summary,
    key_findings: ['Repeated key observation'],
    important_values: importantValues,
    simple_explanation: 'Long report explanation',
  }
}

function renderResults(reports) {
  return render(
    <AnalysisResultView
      analysis={{ overall_summary: 'Long overall summary', reports }}
      analysisId="analysis-id"
      onStartOver={() => {}}
    />,
  )
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

describe('attention-focused results', () => {
  it('shows attention findings and the analysis summaries and explanations', () => {
    renderResults([
      report('source-1', 'CBC', [
        value('RBC', '4.17', 'million/cmm', '4.7 - 6.2'),
        value('Hemoglobin', '14', 'g/dL', '12 - 16'),
      ]),
    ])

    const findings = screen.getByRole('region', { name: 'Attention-worthy findings' })
    expect(within(findings).getByText('RBC')).toBeTruthy()
    expect(within(findings).getByText('4.17 million/cmm')).toBeTruthy()
    expect(within(findings).getByText('Reference: 4.7–6.2 million/cmm')).toBeTruthy()
    expect(within(findings).getByText('Below the provided reference range.')).toBeTruthy()
    expect(within(findings).queryByText('Hemoglobin')).toBeNull()
    const table = within(findings).getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Test / Parameter' })).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Result' })).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Reference Range' })).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Status' })).toBeTruthy()
    expect(within(findings).queryByRole('button')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Overall summary' })).toBeTruthy()
    expect(screen.getByText('Long overall summary')).toBeTruthy()
    expect(screen.getByText('Report summary')).toBeTruthy()
    expect(screen.getByText('Repeated key observation')).toBeTruthy()
    expect(screen.getByText('Long report explanation')).toBeTruthy()
  })

  it('shows the calm empty state when there are no attention findings', () => {
    renderResults([
      report('source-1', 'CBC', [
        value('Hemoglobin', '14', 'g/dL', '12 - 16'),
      ]),
    ])

    expect(
      screen.getByText(
        'No test values were flagged based on the reference ranges visible in the reports. This does not rule out health concerns.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Attention-worthy findings' })).toBeNull()
    expect(screen.getByRole('region', { name: /ask questions about your report/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /ask a question about your report/i })).toBeTruthy()
    expect(screen.getByText('Long overall summary')).toBeTruthy()
    expect(screen.getByText('Repeated key observation')).toBeTruthy()
    expect(screen.getByText('Long report explanation')).toBeTruthy()
  })

  it('keeps duplicate display names separated by source while rendering only attention findings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderResults([
      report('source-1', 'Same Name', [
        value('RBC', '4.17', 'million/cmm', '4.7 - 6.2'),
      ]),
      report('source-2', 'Same Name', [
        value('Platelets', '90', '10^3/uL', '150 - 400'),
      ]),
    ])

    const findings = screen.getByRole('region', { name: 'Attention-worthy findings' })
    expect(within(findings).getAllByText('Same Name')).toHaveLength(2)
    expect(within(findings).getByText('RBC')).toBeTruthy()
    expect(within(findings).getByText('Platelets')).toBeTruthy()
    const keyWarnings = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes('same key'),
    )
    expect(keyWarnings).toHaveLength(0)
  })

  it('keeps the general questions section without per-finding prompt buttons', () => {
    renderResults([
      report('source-1', 'CBC', [
        value('RBC', '4.17', 'million/cmm', '4.7 - 6.2'),
      ]),
    ])

    expect(
      screen.getByRole('region', { name: /ask questions about your report/i }),
    ).toBeTruthy()
    expect(
      screen.getByRole('textbox', { name: /ask a question about your report/i }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /ask about this/i })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
