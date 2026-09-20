import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00]

function makeJpg(name) {
  return new File([new Uint8Array(JPEG_MAGIC)], name, { type: 'image/jpeg' })
}

function analysisResponse(id, summary) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      analysis: {
        overall_summary: summary,
        reports: [
          {
            source_id: 'source-1',
            source_label: 'cbc.jpg',
            report_name: 'CBC',
            summary: 'Report summary',
            key_findings: [],
            important_values: [],
            simple_explanation: 'Plain explanation',
          },
        ],
      },
      analysis_id: id,
    }),
  }
}

let pendingRequests

function mockFetch() {
  pendingRequests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url, opts) =>
        new Promise((resolve, reject) => {
          pendingRequests.push({ url, opts, resolve, reject })
          opts?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    ),
  )
}

function fileInput(container) {
  return container.querySelector('input[type="file"]')
}

async function addFile(container, name) {
  fireEvent.change(fileInput(container), { target: { files: [makeJpg(name)] } })
  await screen.findByText(name)
}

function clickAnalyze() {
  fireEvent.click(screen.getByRole('button', { name: /analyze reports/i }))
}

beforeEach(() => {
  sessionStorage.clear()
  mockFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('analysis concurrency guards', () => {
  it('blocks add/remove/clear while analysis is in flight', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()

    // Loading state is active.
    expect(
      screen.getByRole('button', { name: /analyzing your reports/i }).disabled,
    ).toBe(true)

    // Remove is blocked: the file stays selected.
    fireEvent.click(screen.getByRole('button', { name: 'Remove cbc.jpg' }))
    expect(screen.getByText('Selected Reports (1)')).toBeTruthy()
    expect(screen.getByText('cbc.jpg')).toBeTruthy()

    // Clear-all is blocked.
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByText('Selected Reports (1)')).toBeTruthy()

    // Adding more files is blocked (no status flip, no new file).
    fireEvent.change(fileInput(container), { target: { files: [makeJpg('extra.jpg')] } })
    expect(screen.getByText('Selected Reports (1)')).toBeTruthy()
    expect(screen.queryByText('extra.jpg')).toBeNull()
    expect(
      screen.getByRole('button', { name: /analyzing your reports/i }).disabled,
    ).toBe(true)

    // The in-flight request still completes normally.
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText('Report Findings')
    await screen.findByText('Summary One')
  })

  it('aborts the request on unmount and ignores the late success', async () => {
    const first = render(<App />)
    await addFile(first.container, 'cbc.jpg')
    clickAnalyze()

    const signal = fetch.mock.calls[0][1].signal
    first.unmount()
    expect(signal.aborted).toBe(true)

    // Late success after reset must not resurrect anything.
    pendingRequests[0].resolve(analysisResponse('id-late', 'Late Summary'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    const second = render(<App />)
    expect(second.container.querySelector('input[type="file"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /analyze reports/i }).disabled).toBe(false)
    expect(screen.queryByText('Report Findings')).toBeNull()
    expect(screen.queryByText('Late Summary')).toBeNull()

    // The app is not stuck: a fresh analysis works.
    await addFile(second.container, 'fresh.jpg')
    clickAnalyze()
    pendingRequests[1].resolve(analysisResponse('id-fresh', 'Fresh Summary'))
    await screen.findByText('Fresh Summary')
  })

  it('ignores a late error after unmount', async () => {
    const first = render(<App />)
    await addFile(first.container, 'cbc.jpg')
    clickAnalyze()
    first.unmount()

    pendingRequests[0].reject(new Error('network down'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    render(<App />)
    expect(screen.queryByText(/could not reach the server/i)).toBeNull()
    expect(screen.getByRole('button', { name: /analyze reports/i }).disabled).toBe(false)
  })

  it('an error does not stick: the next analysis can succeed', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    pendingRequests[0].resolve({ ok: false, status: 500, json: async () => ({}) })
    await screen.findByRole('alert')

    // Retry with a fresh run: previous failure cannot overwrite it.
    clickAnalyze()
    pendingRequests[1].resolve(analysisResponse('id-2', 'Recovered Summary'))
    await screen.findByText('Recovered Summary')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a new analysis after start-over shows only the latest results', async () => {
    const { container } = render(<App />)
    await addFile(container, 'first.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-a', 'Summary Alpha'))
    await screen.findByText('Summary Alpha')

    fireEvent.click(screen.getByRole('button', { name: /analyze more reports/i }))
    await addFile(container, 'second.jpg')
    clickAnalyze()
    pendingRequests[1].resolve(analysisResponse('id-b', 'Summary Beta'))
    await screen.findByText('Summary Beta')
    expect(screen.queryByText('Summary Alpha')).toBeNull()
  })
})

describe('analysis loading state', () => {
  it('shows staged loading while the analysis runs', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()

    expect(
      screen.getByRole('status', { name: /analysis in progress: uploading reports/i }),
    ).toBeTruthy()
    expect(screen.getByText('Reading reports')).toBeTruthy()

    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText('Report Findings')
  })

  it('hides loading when the analysis succeeds', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    expect(screen.getByRole('status')).toBeTruthy()

    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText('Summary One')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('hides loading when the analysis fails', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    expect(screen.getByRole('status')).toBeTruthy()

    pendingRequests[0].resolve({ ok: false, status: 500, json: async () => ({}) })
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('cancellation leaves no stale loading state behind', async () => {
    const first = render(<App />)
    await addFile(first.container, 'cbc.jpg')
    clickAnalyze()
    expect(screen.getByRole('status')).toBeTruthy()
    first.unmount()

    render(<App />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: /analyze reports/i }).disabled).toBe(false)
  })

  it('a stale response cannot resurrect loading or results', async () => {
    const first = render(<App />)
    await addFile(first.container, 'cbc.jpg')
    clickAnalyze()
    first.unmount()

    pendingRequests[0].resolve(analysisResponse('id-late', 'Late Summary'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    const second = render(<App />)
    expect(second.container.querySelector('input[type="file"]')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Report Findings')).toBeNull()
    expect(screen.queryByText('Late Summary')).toBeNull()
  })
})

describe('busy file controls and focus management', () => {
  it('disables file controls and the dropzone while analysis is running', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()

    expect(screen.getByRole('button', { name: 'Remove cbc.jpg' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /clear all/i }).disabled).toBe(true)
    expect(fileInput(container).disabled).toBe(true)
    const label = container.querySelector('label[for="report-images"]')
    expect(label.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText(/analysis in progress/i)).toBeTruthy()

    // Controls work again after the run settles.
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText('Report Findings')
  })

  it('moves focus to the results heading on success', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText('Report Findings')
    expect(document.activeElement?.textContent).toMatch(/report findings/i)
  })

  it('moves focus to the upload heading on start over', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText('Report Findings')

    fireEvent.click(screen.getByRole('button', { name: /analyze more reports/i }))
    expect(document.activeElement?.textContent).toMatch(/understand your reports/i)
  })
})
