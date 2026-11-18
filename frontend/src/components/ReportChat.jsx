import { useEffect, useRef, useState } from 'react'
import { CHAT_EXPIRED_DETAIL, messageFromResponse } from '../errors'
import { apiUrl } from '../api'
import { createRunScope } from '../runScope'
import {
  buildFindingQuestion,
  findingQuestionSuggestions,
} from '../askAboutFinding'

export const CHAT_STORAGE_KEY = 'scanora:chat'

export function chatStorageKey(analysisId) {
  if (analysisId && typeof analysisId === 'string') {
    return `${CHAT_STORAGE_KEY}:${analysisId}`
  }
  return CHAT_STORAGE_KEY
}

export function clearStoredChat(analysisId) {
  try {
    // Legacy un-namespaced key (pre-provenance) plus the bound key.
    sessionStorage.removeItem(CHAT_STORAGE_KEY)
    if (analysisId && typeof analysisId === 'string') {
      sessionStorage.removeItem(chatStorageKey(analysisId))
    }
  } catch {
    // Ignore storage errors during reset.
  }
}

function loadStoredMessages(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey)
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

function ReportChat({
  analysisId,
  prefillRequest,
  onAttachFiles,
  isAnalysisBusy = false,
  onStopAnalysis,
  attachmentErrors = [],
}) {
  const storageKey = chatStorageKey(analysisId)
  const [messages, setMessages] = useState(() => loadStoredMessages(storageKey))
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const [isExpired, setIsExpired] = useState(false)
  const composerRef = useRef(null)
  const attachInputRef = useRef(null)
  const activeMessageRef = useRef('')
  const appliedPrefillNonce = useRef(null)
  const sendScopeRef = useRef(null)
  if (sendScopeRef.current === null) {
    sendScopeRef.current = createRunScope()
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {
      // Persistence is best-effort.
    }
  }, [messages, storageKey])

  useEffect(() => {
    resizeComposer()
  }, [draft])

  // Reset (or a new analysis identity, via parent key) cancels the send.
  useEffect(() => {
    const scope = sendScopeRef.current
    return () => {
      scope.cancel()
    }
  }, [])

  // "Ask about this" prefill: fills the composer without sending anything.
  // Applied once per request nonce so re-renders never clobber a typed
  // draft, and message history / send state are left untouched. A draft the
  // user already typed is preserved; the composer is still focused.
  useEffect(() => {
    if (!prefillRequest || appliedPrefillNonce.current === prefillRequest.nonce) {
      return
    }
    appliedPrefillNonce.current = prefillRequest.nonce
    setDraft((current) => (current.trim() === '' ? prefillRequest.text : current))
    const node = composerRef.current
    if (node) {
      node.focus({ preventScroll: true })
      if (typeof node.scrollIntoView === 'function') {
        const reduceMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      }
    }
  }, [prefillRequest])

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

    if (!analysisId) {
      setErrorMessage(
        'This analysis is from before a recent update. Please analyze your reports again to enable chat.',
      )
      return
    }

    const history = messages.map((item) => ({
      role: item.role,
      content: item.text,
    }))

    const run = sendScopeRef.current.begin()
    const isRunCurrent = () => sendScopeRef.current.isCurrent(run.id)

    activeMessageRef.current = text
    setErrorMessage('')
    setIsSending(true)
    setFailedMessage('')
    if (!override) {
      setDraft('')
    }
    upsertUserMessage(text)

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analysisId,
          messages: history,
          message: text,
        }),
        signal: run.signal,
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      // A superseded or cancelled send must never touch state.
      if (!isRunCurrent()) {
        return
      }

      if (!response.ok) {
        if (!override) {
          setDraft(text)
        }
        markUserMessage(text, { failed: true, sending: false })
        setFailedMessage(text)
        if (data?.detail === CHAT_EXPIRED_DETAIL) {
          // The analysis identity expired: re-analysis is the only recovery,
          // so lock the composer with inline guidance instead of failing sends.
          setIsExpired(true)
        }
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
    } catch (err) {
      if (!isRunCurrent()) {
        return
      }
      if (err && err.name === 'AbortError') {
        // Cancelled via reset/unmount; that flow already owns the state.
        return
      }
      if (!override) {
        setDraft(text)
      }
      markUserMessage(text, { failed: true, sending: false })
      setFailedMessage(text)
      setErrorMessage(
        'Scanora could not reach the server. Make sure the backend is running and try again.',
      )
    } finally {
      if (isRunCurrent()) {
        setIsSending(false)
        activeMessageRef.current = ''
      }
    }
  }

  function stopSending() {
    const text = activeMessageRef.current
    if (!text) {
      return
    }
    sendScopeRef.current.cancel()
    activeMessageRef.current = ''
    setIsSending(false)
    markUserMessage(text, { failed: true, sending: false })
    setFailedMessage(text)
    setErrorMessage('This question was stopped before an answer arrived.')
  }

  function resizeComposer() {
    if (composerRef.current) {
      composerRef.current.style.height = 'auto'
      composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 180)}px`
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  function handleSuggestedQuestion(question) {
    setDraft(buildFindingQuestion(prefillRequest.finding, question))
    composerRef.current?.focus()
  }

  return (
    <section
      className="scanora-chat-section"
      aria-label={isAnalysisBusy ? 'Analysis controls' : undefined}
      aria-labelledby={isAnalysisBusy ? undefined : 'report-chat-heading'}
    >
      {!isAnalysisBusy && (
      <div className="scanora-chat-panel">
        <div className="flex items-center">
          <h3
            id="report-chat-heading"
            className="scanora-section-title font-heading font-semibold text-scanora-text"
          >
            Ask Questions About Your Report
          </h3>
        </div>
        <p className="scanora-supporting-copy max-w-2xl text-scanora-muted">
          Ask questions regarding any tests or notes visible above. Scanora explains report contents but does not diagnose or recommend treatments.
        </p>

        {attachmentErrors.length > 0 && (
          <div className="scanora-error" role="alert">
            <p>Some reports could not be added:</p>
            <ul className="list-disc pl-5">
              {attachmentErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
            </ul>
          </div>
        )}

        {prefillRequest?.finding && (
          <div className="flex flex-col gap-2">
            <p className="scanora-supporting-copy font-medium text-scanora-muted">
              Questions about {prefillRequest.finding.name}
            </p>
            <ul className="scanora-question-suggestions flex flex-wrap gap-2">
              {findingQuestionSuggestions(prefillRequest.finding).map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => handleSuggestedQuestion(question)}
                    className="scanora-focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-full border border-scanora-border bg-scanora-surface px-4 py-2 text-sm text-scanora-muted transition-colors hover:border-scanora-brand hover:text-scanora-brand"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!analysisId && (
          <p className="scanora-supporting-copy text-scanora-muted">
            Chat is unavailable for analyses from before this update. Analyze your reports again to ask questions.
          </p>
        )}

        {isExpired && (
          <p className="scanora-supporting-copy text-scanora-muted">
            This analysis has expired. Analyze your reports again to keep asking questions.
          </p>
        )}

        {messages.length > 0 && (
          <ul className="flex flex-col gap-4" aria-live="polite">
            {messages.map((item) => (
              <li
                key={item.id}
                className={`scanora-chat-message flex flex-col gap-2 max-w-[88%] rounded-lg p-4 text-sm leading-relaxed ${
                  item.role === 'user'
                    ? 'ml-auto border border-scanora-brand/20 bg-scanora-brand-soft text-scanora-ink'
                    : 'mr-auto border border-scanora-border bg-scanora-surface-muted text-scanora-ink'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="scanora-file-limit font-semibold text-scanora-muted">
                    {item.role === 'user' ? 'You' : 'Scanora'}
                  </span>
                  {item.failed && (
                    <span className="text-xs font-semibold text-scanora-error">
                      Not sent
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{item.text}</p>
                {item.role === 'assistant' && (
                  <p className="border-t border-scanora-border-subtle pt-2 text-xs leading-relaxed text-scanora-muted">
                    Educational information only, not a diagnosis or treatment
                    recommendation. Please discuss your result with a qualified
                    healthcare professional.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {isSending && (
          <div role="status" className="flex items-center gap-2 text-xs font-medium text-scanora-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-scanora-primary animate-pulse" aria-hidden="true" />
            <span>Consulting report context<span className="analyzing-dots" aria-hidden="true" /></span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="scanora-error flex flex-col gap-2 px-4 py-4 text-sm leading-relaxed">
            <p className="break-words">{errorMessage}</p>
            {failedMessage && !isExpired && (
              <button
                type="button"
                onClick={() => sendMessage(failedMessage)}
                disabled={isSending}
                className="scanora-focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-md border border-scanora-error-border bg-scanora-surface px-4 py-2 text-sm font-medium text-scanora-error transition-colors duration-180 hover:bg-scanora-surface-muted disabled:opacity-60"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
      )}

      <div className={`scanora-composer-wrap${isAnalysisBusy ? ' scanora-composer-wrap-busy' : ''}`}>
        <div className="scanora-composer">
          {onAttachFiles && (
            <>
              <input
                ref={attachInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  onAttachFiles(event.target.files)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={isSending || isAnalysisBusy}
                className="scanora-attach-button scanora-focus-ring"
                aria-label="Attach more reports"
                title="Attach more reports"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </>
          )}
          <label htmlFor="report-chat-input" className="sr-only">
            Ask a question about your report findings
          </label>
          <textarea
            id="report-chat-input"
            ref={composerRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              resizeComposer()
            }}
            onKeyDown={handleKeyDown}
            placeholder={isAnalysisBusy ? 'Your reports are being analyzed…' : 'Ask a follow-up question about your report...'}
            rows={1}
            disabled={isSending || isAnalysisBusy || !analysisId || isExpired}
            aria-describedby={isAnalysisBusy ? undefined : 'report-chat-hint'}
            className="scanora-composer-input scanora-focus-ring"
          />

          <button
            type="button"
            onClick={() => {
              if (isAnalysisBusy) {
                onStopAnalysis?.()
              } else if (isSending) {
                stopSending()
              } else {
                sendMessage()
              }
            }}
            disabled={!isAnalysisBusy && !isSending && (draft.trim() === '' || !analysisId || isExpired)}
            className="scanora-send-button scanora-focus-ring"
            aria-label={isAnalysisBusy || isSending ? 'Stop' : 'Send question'}
          >
            <svg
              className="scanora-send-icon"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={isAnalysisBusy || isSending ? '0' : '2.5'}
              stroke="currentColor"
              aria-hidden="true"
            >
              {isAnalysisBusy || isSending ? (
                <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              )}
            </svg>
          </button>
        </div>
        {!isAnalysisBusy && (
          <p id="report-chat-hint" className="scanora-file-limit text-scanora-faint">
            Press Enter to send, Shift + Enter for a new line.
          </p>
        )}
      </div>
    </section>
  )
}

export default ReportChat