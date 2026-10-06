import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  it('shows attention findings without normal results, dashboard, summaries, or context', () => {
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
    expect(screen.getByRole('button', { name: 'Ask about this RBC' })).toBeTruthy()
    expect(screen.queryByText('Results overview')).toBeNull()
    expect(screen.queryByText('Long overall summary')).toBeNull()
    expect(screen.queryByText('Repeated key observation')).toBeNull()
    expect(screen.queryByText('Report Context & Notes')).toBeNull()
    expect(screen.queryByText('Long report explanation')).toBeNull()
  })

  it('shows the calm empty state when there are no attention findings', () => {
    renderResults([
      report('source-1', 'CBC', [
        value('Hemoglobin', '14', 'g/dL', '12 - 16'),
      ]),
    ])

    expect(
      screen.getByText(
        'No findings in this report were flagged as needing attention based on the provided reference ranges.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Attention-worthy findings' })).toBeNull()
    expect(screen.queryByRole('region', { name: /ask questions about your report/i })).toBeNull()
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

  it('prefills contextual questions without sending when a finding CTA or suggestion is clicked', () => {
    renderResults([
      report('source-1', 'CBC', [
        value('RBC', '4.17', 'million/cmm', '4.7 - 6.2'),
      ]),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Ask about this RBC' }))
    const composer = screen.getByRole('textbox', {
      name: /ask a question about your report/i,
    })
    expect(composer.value).toBe(
      'Can you explain my RBC result; value 4.17 million/cmm; reference range 4.7 - 6.2?',
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'What is RBC?' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Why might my RBC be low?' }))
    expect(composer.value).toBe(
      'About my RBC result; value 4.17 million/cmm; reference range 4.7 - 6.2: Why might my RBC be low?',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
