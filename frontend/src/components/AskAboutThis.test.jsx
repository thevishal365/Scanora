import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

function renderView() {
  render(
    <AnalysisResultView analysis={analysis} analysisId="tid" onStartOver={() => {}} />,
  )
}

function composer() {
  return screen.getByLabelText(/ask a question about your report/i)
}

let pendingRequests

function mockFetch() {
  pendingRequests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject })
        }),
    ),
  )
}

beforeEach(() => {
  sessionStorage.clear()
  mockFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('"Ask about this" from findings', () => {
  it('prefills the composer and focuses the chat without sending', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this Hemoglobin' }))

    expect(composer().value).toBe(
      'Can you explain my Hemoglobin result; value 18.1 g/dL; reference range 12.0 - 16.0?',
    )
    expect(document.activeElement).toBe(composer())
    // Nothing is sent automatically.
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText(/consulting report context/i)).toBeNull()
  })

  it('builds a neutral question for qualitative findings', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this HBsAg' }))
    expect(composer().value).toBe(
      'Can you explain my HBsAg result; value Reactive?',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not imply a reference range when none is usable', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this Calcium' }))
    const question = composer().value
    expect(question).toBe(
      'Can you explain my Calcium result; value 9.5 H mg/dL?',
    )
    expect(question).not.toMatch(/reference range/i)
  })

  it('gives each finding its own correct prompt', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this Hemoglobin' }))
    expect(composer().value).toMatch(/Hemoglobin result; value 18\.1 g\/dL/)
    // A cleared composer accepts the next finding's prompt.
    fireEvent.change(composer(), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this HBsAg' }))
    expect(composer().value).toMatch(/HBsAg result; value Reactive/)
  })

  it('submits the prefilled question under the current analysis identity', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this Hemoglobin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))

    expect(fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.analysis_id).toBe('tid')
    expect(body.message).toBe(
      'Can you explain my Hemoglobin result; value 18.1 g/dL; reference range 12.0 - 16.0?',
    )
  })

  it('preserves existing chat history when prefilling', () => {
    sessionStorage.setItem(
      'scanora:chat:tid',
      JSON.stringify([
        { id: 'u1', role: 'user', text: 'Earlier question' },
        { id: 'a1', role: 'assistant', text: 'Earlier answer' },
      ]),
    )
    renderView()
    expect(screen.getByText('Earlier question')).toBeTruthy()
    expect(screen.getByText('Earlier answer')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ask about this Hemoglobin' }))
    expect(composer().value).toMatch(/Hemoglobin/)
    expect(screen.getByText('Earlier question')).toBeTruthy()
    expect(screen.getByText('Earlier answer')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('exposes an accessible name on every ask action', () => {
    renderView()
    const buttons = screen.getAllByRole('button', { name: /ask about this/i })
    expect(buttons).toHaveLength(3)
    expect(composer().getAttribute('id')).toBe('report-chat-input')
  })
})
