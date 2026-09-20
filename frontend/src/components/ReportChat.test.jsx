import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import ReportChat from './ReportChat'
import { CHAT_EXPIRED_DETAIL } from '../errors'

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

function answerResponse(answer) {
  return { ok: true, json: async () => ({ answer }) }
}

async function sendMessage(text) {
  fireEvent.change(
    screen.getByPlaceholderText(/out-of-range hematocrit/i),
    { target: { value: text } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  await screen.findByText(text)
}

beforeEach(() => {
  sessionStorage.clear()
  mockFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('chat send concurrency', () => {
  it('shows the answer on success (existing flow still works)', async () => {
    render(<ReportChat analysisId="a1" />)
    await sendMessage('What is this?')
    pendingRequests[0].resolve(answerResponse('It is explained.'))
    await screen.findByText('It is explained.')
  })

  it('a late response after reset cannot update the chat', async () => {
    const first = render(<ReportChat analysisId="a1" />)
    await sendMessage('First question')

    const signal = fetch.mock.calls[0][1].signal
    expect(JSON.parse(fetch.mock.calls[0][1].body).analysis_id).toBe('a1')

    // Reset (identity gone): the in-flight send is cancelled.
    first.unmount()
    expect(signal.aborted).toBe(true)

    // The late answer from the previous analysis resolves afterwards.
    await act(async () => {
      pendingRequests[0].resolve(answerResponse('STALE ANSWER'))
    })

    // A new chat for the current analysis is unaffected.
    render(<ReportChat analysisId="a2" />)
    expect(screen.queryByText('STALE ANSWER')).toBeNull()
    expect(screen.queryByText('First question')).toBeNull()

    await sendMessage('Second question')
    pendingRequests[1].resolve(answerResponse('FRESH ANSWER'))
    await screen.findByText('FRESH ANSWER')
    expect(screen.queryByText('STALE ANSWER')).toBeNull()
  })

  it('a late error after reset does not surface', async () => {
    const first = render(<ReportChat analysisId="a1" />)
    await sendMessage('First question')
    first.unmount()

    await act(async () => {
      pendingRequests[0].reject(new Error('network down'))
    })

    render(<ReportChat analysisId="a2" />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('First question')).toBeNull()
  })

  it('a failed send can still be retried (not stuck)', async () => {
    render(<ReportChat analysisId="a1" />)
    await sendMessage('Retry me')
    pendingRequests[0].reject(new Error('network down'))
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    pendingRequests[1].resolve(answerResponse('Recovered answer'))
    await screen.findByText('Recovered answer')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('composer prefill, expiry, and hints', () => {
  function composer() {
    return screen.getByPlaceholderText(/out-of-range hematocrit/i)
  }

  it('preserves a typed draft when ask-about-this arrives', () => {
    const { rerender } = render(<ReportChat analysisId="a1" prefillRequest={null} />)
    fireEvent.change(composer(), { target: { value: 'My own question' } })
    rerender(
      <ReportChat
        analysisId="a1"
        prefillRequest={{ text: 'Prefilled question?', nonce: 1 }}
      />,
    )
    expect(composer().value).toBe('My own question')
    expect(document.activeElement).toBe(composer())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('still prefills an empty composer', () => {
    const { rerender } = render(<ReportChat analysisId="a1" prefillRequest={null} />)
    rerender(
      <ReportChat
        analysisId="a1"
        prefillRequest={{ text: 'Prefilled question?', nonce: 1 }}
      />,
    )
    expect(composer().value).toBe('Prefilled question?')
  })

  it('disables the composer with guidance when the analysis expired', async () => {
    render(<ReportChat analysisId="a1" />)
    await sendMessage('Hello?')
    pendingRequests[0].resolve({
      ok: false,
      status: 400,
      json: async () => ({ detail: CHAT_EXPIRED_DETAIL }),
    })
    await screen.findByText('This analysis has expired. Analyze your reports again to keep asking questions.')
    expect(composer().disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Ask' }).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('shows the Enter-to-send hint associated with the composer', () => {
    render(<ReportChat analysisId="a1" />)
    expect(screen.getByText(/press enter to send/i)).toBeTruthy()
    expect(composer().getAttribute('aria-describedby')).toBe('report-chat-hint')
  })
})
