import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00]

function makeJpg(name) {
  return new File([new Uint8Array(JPEG_MAGIC)], name, { type: 'image/jpeg' })
}

let pendingRequests
let taskStatusResponses

function analysisResponse(id, summary) {
  taskStatusResponses.set(id, [
    {
      ok: true,
      json: async () => ({
        status: 'completed',
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
              important_values: [
                {
                  name: `Finding ${id}`,
                  value: '18',
                  unit: 'g/dL',
                  reference_range: '12 - 16',
                },
              ],
              simple_explanation: 'Plain explanation',
            },
          ],
        },
        analysis_id: id,
      }),
    },
  ])
  return {
    ok: true,
    status: 202,
    json: async () => ({ task_id: id, status: 'processing' }),
  }
}

function mockFetch() {
  pendingRequests = []
  taskStatusResponses = new Map()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url, opts) => {
        if (String(url).includes('/api/analyze/status/')) {
          const taskId = String(url).split('/').pop()
          const responses = taskStatusResponses.get(taskId) || []
          return Promise.resolve(
            responses.shift() || {
              ok: false,
              status: 404,
              json: async () => ({ detail: 'Task not found' }),
            },
          )
        }
        return new Promise((resolve, reject) => {
          pendingRequests.push({ url, opts, resolve, reject })
          opts?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.')
            err.name = 'AbortError'
            reject(err)
          })
        })
      },
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

describe('upload landing page', () => {
  it('shows the centered lab report upload hero and trust details', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: 'Scanora home' })).toBeTruthy()
    expect(screen.getByText('Session only')).toBeTruthy()
    expect(screen.getByText('AI Report Analyzer')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Understand Your Reports, Simply.' })).toBeTruthy()
    expect(screen.getByText('Simply.').className).toContain('scanora-accent-italic')
    expect(
      screen.getByText(
        'We help simplify medical information so you can better understand what your reports are telling you.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Upload your reports' })).toBeTruthy()
    expect(screen.queryByText('Start with a document')).toBeNull()
    expect(
      screen.queryByText('Add one or more lab or diagnostic reports to get started.'),
    ).toBeNull()
    expect(screen.getByText('Drag and drop your files here')).toBeTruthy()
    expect(screen.getByText('browse from your device')).toBeTruthy()
    expect(screen.getByText(/JPG, JPEG, PNG, or PDF · 10 MB per file · 30 MB total · Up to 10 files/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Select Files to Analyze' })).toBeTruthy()
    expect(
      screen.getByText(
        'Get a plain-language summary, flagged values, and follow-up Q&A.',
      ),
    ).toBeTruthy()
    for (const reassurance of ['Clear explanations', 'Session-based', 'No account needed']) {
      const badge = screen.getByText(reassurance).closest('li').querySelector('.scanora-check-badge')
      expect(badge.querySelector('circle').getAttribute('fill')).toBe(
        'var(--color-scanora-brand)',
      )
      expect(badge.querySelector('path').getAttribute('stroke')).toBe('#FFFFFF')
    }
    expect(screen.getByRole('button', { name: 'Medical Disclaimer' })).toBeTruthy()
    const microFooter = screen.getByRole('contentinfo')
    expect(microFooter.textContent).toContain('·')
    expect(microFooter.textContent).toContain('Designed by')
    expect(microFooter.querySelector('a').textContent).toBe('Vishal')
  })
})

describe('medical disclaimer modal', () => {
  it('opens from the footer and closes with the confirmation button', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Medical Disclaimer' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement.getAttribute('aria-label')).toBe('Close medical disclaimer')
    expect(
      screen.getByRole('heading', {
        name: 'For educational use — always consult your doctor.',
      }),
    ).toBeTruthy()
    expect(screen.getByText(/Scanora is an educational reading aid/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(dialog.open).toBe(false)
  })

  it('closes on Escape or when the backdrop is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Medical Disclaimer' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog.open).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Medical Disclaimer' }))
    const reopenedDialog = screen.getByRole('dialog')
    fireEvent.click(reopenedDialog)
    expect(reopenedDialog.open).toBe(false)
  })

  it('keeps the disclaimer available from completed results', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-disclaimer', 'Summary'))
    await screen.findByRole('heading', { name: 'Analysis Complete' })

    fireEvent.click(screen.getByRole('button', { name: 'Medical Disclaimer' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.open).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(dialog.open).toBe(false)
  })
})

describe('analysis concurrency guards', () => {
  it('blocks add/remove/clear while analysis is in flight', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()

    // Loading state is active.
    expect(screen.getByRole('button', { name: 'Stop' }).disabled).toBe(false)

    // The active thread keeps the submitted file and a disabled attachment affordance.
    expect(screen.getByText('cbc.jpg')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Attach more reports' }).disabled).toBe(true)

    // The in-flight request still completes normally.
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByRole('heading', { name: 'Analysis Complete' })
    await screen.findByText(/Finding id-1:/)
    expect(screen.queryByText('Session only')).toBeNull()
    expect(screen.getByRole('button', { name: 'New Scan' })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'Select Files to Analyze' }).disabled).toBe(false)
    expect(
      screen.queryByRole('heading', { name: 'Analysis Complete' }),
    ).toBeNull()
    expect(screen.queryByText('Late Summary')).toBeNull()

    // The app is not stuck: a fresh analysis works.
    await addFile(second.container, 'fresh.jpg')
    clickAnalyze()
    pendingRequests[1].resolve(analysisResponse('id-fresh', 'Fresh Summary'))
    await screen.findByText(/Finding id-fresh:/)
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
    expect(screen.getByRole('button', { name: 'Select Files to Analyze' }).disabled).toBe(false)
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
    await screen.findByText(/Finding id-2:/)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a new analysis after start-over shows only the latest results', async () => {
    const { container } = render(<App />)
    await addFile(container, 'first.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-a', 'Summary Alpha'))
    await screen.findByText(/Finding id-a:/)

    fireEvent.click(screen.getByRole('button', { name: 'New Scan' }))
    await addFile(container, 'second.jpg')
    clickAnalyze()
    pendingRequests[1].resolve(analysisResponse('id-b', 'Summary Beta'))
    await screen.findByText(/Finding id-b:/)
    expect(screen.queryByText('Finding id-a')).toBeNull()
  })

  it('clears the completed analysis when more files are attached', async () => {
    const { container } = render(<App />)
    await addFile(container, 'first.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-attach', 'Original Summary'))
    await screen.findByText(/Finding id-attach:/)

    sessionStorage.setItem(
      'scanora:chat:id-attach',
      JSON.stringify([{ role: 'user', text: 'Old question' }]),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Attach more reports' }))
    const fileInputs = container.querySelectorAll('input[type="file"]')
    fireEvent.change(fileInputs[fileInputs.length - 1], {
      target: { files: [makeJpg('second.jpg')] },
    })

    await screen.findByText('second.jpg')
    expect(screen.queryByRole('heading', { name: 'Analysis Complete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New Scan' })).toBeNull()
    expect(sessionStorage.getItem('scanora:session')).toBeNull()
    expect(sessionStorage.getItem('scanora:chat:id-attach')).toBeNull()
    expect(screen.getByText(/Selected files \(2\)/)).toBeTruthy()
  })

  it('keeps completed results and session when an invalid attachment is rejected', async () => {
    const { container } = render(<App />)
    await addFile(container, 'first.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-invalid-attach', 'Original Summary'))
    await screen.findByText(/Finding id-invalid-attach:/)
    const storedSession = sessionStorage.getItem('scanora:session')
    const storedChat = JSON.stringify([{ role: 'user', text: 'Keep this history' }])
    sessionStorage.setItem('scanora:chat:id-invalid-attach', storedChat)

    fireEvent.click(screen.getByRole('button', { name: 'Attach more reports' }))
    const fileInputs = container.querySelectorAll('input[type="file"]')
    fireEvent.change(fileInputs[fileInputs.length - 1], {
      target: {
        files: [
          new File(['not a report'], 'notes.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
        ],
      },
    })

    await screen.findByText(/Word documents are not supported/)
    expect(screen.getByRole('heading', { name: 'Analysis Complete' })).toBeTruthy()
    expect(screen.getByText(/Finding id-invalid-attach:/)).toBeTruthy()
    expect(sessionStorage.getItem('scanora:session')).toBe(storedSession)
    expect(sessionStorage.getItem('scanora:chat:id-invalid-attach')).toBe(storedChat)
  })
})

describe('analysis loading state', () => {
  it('polls the task until the server returns the completed analysis', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    const submission = analysisResponse('id-poll', 'Polled Summary')
    const completed = taskStatusResponses.get('id-poll')[0]
    taskStatusResponses.set('id-poll', [
      { ok: true, json: async () => ({ status: 'processing' }) },
      completed,
    ])

    clickAnalyze()
    pendingRequests[0].resolve(submission)
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByText(/Finding id-poll:/, {}, { timeout: 3000 })
    expect(
      fetch.mock.calls.filter(([url]) =>
        String(url).includes('/api/analyze/status/'),
      ),
    ).toHaveLength(2)
  })

  it('shows the safe error returned by a failed analysis task', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    const submission = analysisResponse('id-failed', 'Unused Summary')
    taskStatusResponses.set('id-failed', [
      {
        ok: true,
        json: async () => ({
          status: 'failed',
          error: 'The analysis service is temporarily unavailable.',
        }),
      },
    ])

    clickAnalyze()
    pendingRequests[0].resolve(submission)
    expect(
      await screen.findByText('The analysis service is temporarily unavailable.'),
    ).toBeTruthy()
  })

  it('shows a status endpoint error and ends loading', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    const submission = analysisResponse('id-expired-task', 'Unused Summary')
    taskStatusResponses.set('id-expired-task', [
      {
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Task not found' }),
      },
    ])

    clickAnalyze()
    pendingRequests[0].resolve(submission)

    expect(await screen.findByText('Task not found')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Analysis Complete' })).toBeNull()
  })

  it('shows staged loading while the analysis runs', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()

    expect(screen.getByText('cbc.jpg')).toBeTruthy()
    expect(
      screen.getByRole('status'),
    ).toBeTruthy()
    expect(screen.queryByText('Session only')).toBeNull()
    expect(screen.getByRole('button', { name: 'New Scan' })).toBeTruthy()
    const attachButton = screen.getByRole('button', { name: 'Attach more reports' })
    expect(attachButton.disabled).toBe(true)
    expect(attachButton.querySelector('svg')).toBeTruthy()
    expect(screen.getByPlaceholderText(/reports are being analyzed/i).disabled).toBe(true)
    expect(screen.getByText(/Reading your reports/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(screen.queryByText('Analysis can be stopped at any time.')).toBeNull()

    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByRole('heading', { name: 'Analysis Complete' })
    expect(screen.getByRole('button', { name: 'Medical Disclaimer' })).toBeTruthy()
    expect(screen.queryByText('Designed by')).toBeNull()
    expect(screen.queryByText('Not a substitute for professional medical evaluation')).toBeNull()
  })

  it('hides loading when the analysis succeeds', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    expect(screen.getByRole('status')).toBeTruthy()

    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByText(/Finding id-1:/)
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
    expect(screen.getByRole('button', { name: 'Select Files to Analyze' }).disabled).toBe(false)
  })

  it('stops an in-flight analysis from the sticky composer', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    const signal = fetch.mock.calls[0][1].signal

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(signal.aborted).toBe(true)
    expect(screen.getByRole('button', { name: 'Analyze Reports' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
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
    expect(
      screen.queryByRole('heading', { name: 'Analysis Complete' }),
    ).toBeNull()
    expect(screen.queryByText('Late Summary')).toBeNull()
  })
})

describe('busy file controls and focus management', () => {
  it('keeps submitted files and the attachment affordance visible during analysis', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()

    expect(screen.getByText('cbc.jpg')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove cbc.jpg' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Attach more reports' }).disabled).toBe(true)
    expect(screen.getByPlaceholderText(/reports are being analyzed/i)).toBeTruthy()

    // Controls work again after the run settles.
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByRole('heading', { name: 'Analysis Complete' })
  })

  it('moves focus to the results heading on success', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByRole('heading', { name: 'Analysis Complete' })
    expect(document.activeElement?.textContent).toMatch(/analysis complete/i)
  })

  it('moves focus to the upload heading on start over', async () => {
    const { container } = render(<App />)
    await addFile(container, 'cbc.jpg')
    clickAnalyze()
    pendingRequests[0].resolve(analysisResponse('id-1', 'Summary One'))
    await screen.findByRole('heading', { name: 'Analysis Complete' })

    fireEvent.click(screen.getByRole('button', { name: 'New Scan' }))
    expect(document.activeElement?.textContent).toMatch(/understand your reports/i)
  })
})
