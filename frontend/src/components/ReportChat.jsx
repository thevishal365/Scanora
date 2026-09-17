import { useEffect, useState } from 'react'
import { messageFromResponse } from '../errors'

export const CHAT_STORAGE_KEY = 'scanora:chat'

function loadStoredMessages() {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) =>
            item &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.text === 'string',
        )
      }
    }
  } catch {
    // Ignore corrupted storage.
  }
  return []
}

function ReportChat({ reportContext }) {
  const [messages, setMessages] = useState(loadStoredMessages)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [failedMessage, setFailedMessage] = useState('')

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Persistence is best-effort.
    }
  }, [messages])

  function markUserMessage(text, updates) {
    setMessages((current) =>
      current.map((item) =>
        item.role === 'user' && item.text === text
          ? { ...item, ...updates }
          : item,
      ),
    )
  }

  function upsertUserMessage(text) {
    setMessages((current) => {
      const existingFailed = current.some(
        (item) => item.role === 'user' && item.text === text && item.failed,
      )
      if (existingFailed) {
        return current.map((item) =>
          item.role === 'user' && item.text === text && item.failed
            ? { ...item, failed: false, sending: true }
            : item,
        )
      }
      return [
        ...current,
        { id: crypto.randomUUID(), role: 'user', text, sending: true },
      ]
    })
  }

  async function sendMessage(override) {
    const text = override ? override.trim() : draft.trim()
    if (!text || isSending) {
      return
    }

    const history = messages.map((item) => ({
      role: item.role,
      content: item.text,
    }))

    setErrorMessage('')
    setIsSending(true)
    setFailedMessage('')
    if (!override) {
      setDraft('')
    }
    upsertUserMessage(text)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_context: reportContext,
          messages: history,
          message: text,
        }),
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        if (!override) {
          setDraft(text)
        }
        markUserMessage(text, { failed: true, sending: false })
        setFailedMessage(text)
        setErrorMessage(
          messageFromResponse(
            response,
            data,
            'Your question could not be answered right now. Please try again.',
          ),
        )
        return
      }

      const answer =
        data && typeof data.answer === 'string' ? data.answer.trim() : ''
      if (!answer) {
        if (!override) {
          setDraft(text)
        }
        markUserMessage(text, { failed: true, sending: false })
        setFailedMessage(text)
        setErrorMessage(
          'Your question could not be answered right now. Please try again.',
        )
        return
      }

      setMessages((current) => {
        const cleared = current.map((item) =>
          item.sending ? { ...item, sending: false } : item,
        )
        return [
          ...cleared,
          { id: crypto.randomUUID(), role: 'assistant', text: answer },
        ]
      })
    } catch {
      if (!override) {
        setDraft(text)
      }
      markUserMessage(text, { failed: true, sending: false })
      setFailedMessage(text)
      setErrorMessage(
        'Scanora could not reach the server. Make sure the backend is running and try again.',
      )
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <section className="mt-6 border-t border-scanora-border-subtle pt-5" aria-labelledby="report-chat-heading">
      <div className="scanora-panel p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-scanora-primary" aria-hidden="true" />
          <h3
            id="report-chat-heading"
            className="font-heading text-base font-semibold text-scanora-text sm:text-lg"
          >
            Ask Questions About Your Report
          </h3>
        </div>

        <p className="mt-1 max-w-xl text-xs leading-relaxed text-scanora-muted sm:text-sm">
          Ask questions regarding any tests or notes visible above. Scanora explains report contents but does not diagnose or recommend treatments.
        </p>

        {messages.length > 0 && (
          <ul className="mt-4 space-y-3" aria-live="polite">
            {messages.map((item) => (
              <li
                key={item.id}
                className={`max-w-[88%] rounded-lg p-3 text-xs leading-relaxed sm:text-sm ${
                  item.role === 'user'
                    ? 'ml-auto border border-scanora-primary/25 bg-scanora-brand-soft text-scanora-ink'
                    : 'mr-auto border border-scanora-border-subtle bg-scanora-surface-muted text-scanora-ink'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wider text-scanora-muted uppercase font-heading">
                    {item.role === 'user' ? 'You' : 'Scanora Assistant'}
                  </span>
                  {item.failed && (
                    <span className="text-[10px] font-semibold text-scanora-error">
                      Not sent
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{item.text}</p>
              </li>
            ))}
          </ul>
        )}

        {isSending && (
          <div role="status" className="mt-3 flex items-center gap-2 text-xs font-medium text-scanora-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-scanora-primary animate-pulse" aria-hidden="true" />
            <span>Consulting report context<span className="analyzing-dots" aria-hidden="true" /></span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="scanora-error mt-3 px-3 py-2 text-xs leading-relaxed">
            <p className="break-words">{errorMessage}</p>
            {failedMessage && (
              <button
                type="button"
                onClick={() => sendMessage(failedMessage)}
                disabled={isSending}
                className="scanora-focus-ring mt-2 inline-flex cursor-pointer items-center rounded-md border border-scanora-error-border bg-scanora-surface px-3 py-1.5 text-xs font-medium text-scanora-error transition-colors duration-180 hover:bg-scanora-surface-muted disabled:opacity-60"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <label htmlFor="report-chat-input" className="sr-only">
          Ask a question about your report findings
        </label>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <textarea
            id="report-chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. What does out-of-range Hematocrit mean?"
            rows={2}
            disabled={isSending}
            className="scanora-focus-ring min-h-[48px] w-full resize-y rounded-lg border border-scanora-border bg-scanora-surface px-3 py-2 text-xs text-scanora-text placeholder:text-scanora-muted disabled:opacity-60 sm:text-sm"
          />

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={isSending || draft.trim() === ''}
            className="scanora-button-primary scanora-focus-ring inline-flex h-[48px] shrink-0 cursor-pointer items-center justify-center gap-2 sm:w-auto"
          >
            <span>Ask</span>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}

export default ReportChat