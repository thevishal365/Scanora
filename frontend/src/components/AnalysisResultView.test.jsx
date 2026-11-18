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
  it('shows concise attention findings without report metadata or tables', () => {
    renderResults([
      report('source-1', 'Patient: Alex Chen — CBC', [
        value('RBC', '4.17', 'million/cmm', '4.7 - 6.2'),
        value('Hemoglobin', '14', 'g/dL', '12 - 16'),
      ]),
    ])

    expect(screen.getByRole('heading', { name: 'Analysis Complete' })).toBeTruthy()
    const findings = screen.getByRole('list', { name: 'Key findings needing attention' })
    expect(
      within(findings).getByText(
        'RBC: 4.17 million/cmm — Below the provided reference range.',
      ),
    ).toBeTruthy()
    expect(within(findings).queryByText(/Hemoglobin/)).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/Alex Chen|CBC|Long overall summary|Report summary/)).toBeNull()
    expect(screen.queryByText('Repeated key observation')).toBeNull()
    expect(screen.queryByText('Long report explanation')).toBeNull()
    expect(screen.getByRole('region', { name: /ask questions about your report/i })).toBeTruthy()
    const chatHeading = screen.getByRole('heading', {
      name: 'Ask Questions About Your Report',
    })
    expect(chatHeading.tagName).toBe('H3')
    expect(chatHeading.previousElementSibling).toBeNull()
  })

  it('shows a concise empty state when there are no attention findings', () => {
    renderResults([
      report('source-1', 'CBC', [
        value('Hemoglobin', '14', 'g/dL', '12 - 16'),
      ]),
    ])

    expect(
      screen.getByText('No findings needing attention were identified from the visible report ranges.'),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Analysis Complete' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Key findings needing attention' })).toBeNull()
    expect(screen.queryByText('Long overall summary')).toBeNull()
    expect(screen.getByRole('region', { name: /ask questions about your report/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /ask a question about your report/i })).toBeTruthy()
    expect(screen.queryByText('Repeated key observation')).toBeNull()
    expect(screen.queryByText('Long report explanation')).toBeNull()
  })

  it('omits patient and report names across findings from multiple reports', () => {
    renderResults([
      report('source-1', 'Patient: Alex Chen — CBC', [
        value('RBC', '4.17', 'million/cmm', '4.7 - 6.2'),
      ]),
      report('source-2', 'Patient: Sam Patel — CMP', [
        value('Platelets', '90', '10^3/uL', '150 - 400'),
      ]),
    ])

    const findings = screen.getByRole('list', { name: 'Key findings needing attention' })
    expect(within(findings).getByText(/RBC: 4.17 million\/cmm/)).toBeTruthy()
    expect(within(findings).getByText(/Platelets: 90 10\^3\/uL/)).toBeTruthy()
    expect(screen.queryByText(/Alex Chen|Sam Patel|CBC|CMP/)).toBeNull()
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
