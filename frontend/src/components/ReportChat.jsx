import { useState } from 'react'

function ReportChat({ reportContext }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function messageFromResponse(data, fallback) {
    if (data && typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail
    }
    return fallback
  }

  async function sendMessage() {
    const text = draft.trim()
    if (!text || isSending) {
      return
    }

    const history = messages.map((item) => ({
      role: item.role,
      content: item.text,
    }))

    setDraft('')
    setErrorMessage('')
    setIsSending(true)
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text },
    ])

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
        if ([502, 503, 504].includes(response.status)) {
          setErrorMessage(
            messageFromResponse(
              data,
              'Scanora could not reach the server. Make sure the backend is running and try again.',
            ),
          )
          return
        }
        setErrorMessage(
          messageFromResponse(
            data,
            'Your question could not be answered right now. Please try again.',
          ),
        )
        return
      }

      const answer = data && typeof data.answer === 'string' ? data.answer.trim() : ''
      if (!answer) {
        setErrorMessage('Your question could not be answered right now. Please try again.')
        return
      }

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: answer },
      ])
    } catch {
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
    <section className="mt-10 border-t border-scanora-border pt-8" aria-labelledby="report-chat-heading">
      <h3
        id="report-chat-heading"
        className="font-heading text-base font-semibold text-scanora-text"
      >
        Ask about your report
      </h3>
      <p className="mt-2 text-sm text-scanora-muted">
        Ask questions about the information in your uploaded report.
      </p>

      {messages.length > 0 && (
        <ul className="mt-5 space-y-3" aria-live="polite">
          {messages.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                item.role === 'user'
                  ? 'ml-8 bg-scanora-primary text-white'
                  : 'mr-8 border border-scanora-border bg-white text-scanora-text'
              }`}
            >
              <p className="sr-only">{item.role === 'user' ? 'You' : 'Scanora'}</p>
              <p className="whitespace-pre-wrap">{item.text}</p>
            </li>
          ))}
        </ul>
      )}

      {isSending && (
        <p role="status" className="mt-3 text-sm text-scanora-muted">
          Thinking...
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {errorMessage}
        </p>
      )}

      <label htmlFor="report-chat-input" className="sr-only">
        Ask a question about your report
      </label>
      <textarea
        id="report-chat-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your report..."
        rows={3}
        disabled={isSending}
        className="mt-4 w-full resize-y rounded-lg border border-scanora-border bg-white px-3 py-2 text-base text-scanora-text placeholder:text-scanora-muted focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scanora-primary disabled:opacity-70"
      />

      <button
        type="button"
        onClick={sendMessage}
        disabled={isSending || draft.trim() === ''}
        className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-scanora-primary px-4 font-heading text-sm font-semibold text-white transition-colors duration-200 hover:bg-cyan-700 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scanora-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-scanora-primary"
      >
        Send
      </button>
    </section>
  )
}

export default ReportChat
