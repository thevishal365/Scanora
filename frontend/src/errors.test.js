import { describe, expect, it } from 'vitest'
import { STATUS_MESSAGES, messageFromResponse } from './errors'

describe('messageFromResponse', () => {
  it('prefers the server-provided detail when present', () => {
    expect(
      messageFromResponse({ status: 500 }, { detail: 'Server says hi.' }, 'Fallback'),
    ).toBe('Server says hi.')
  })

  it('falls back per status when the server sends no usable detail', () => {
    expect(messageFromResponse({ status: 500 }, null, 'Fallback')).toBe(
      STATUS_MESSAGES[500],
    )
    expect(messageFromResponse({ status: 500 }, {}, 'Fallback')).toBe(
      STATUS_MESSAGES[500],
    )
    expect(messageFromResponse({ status: 500 }, { detail: '   ' }, 'Fallback')).toBe(
      STATUS_MESSAGES[500],
    )
  })

  it('uses the caller fallback for unknown statuses', () => {
    expect(messageFromResponse({ status: 418 }, null, 'Fallback')).toBe('Fallback')
    expect(messageFromResponse(null, null, 'Fallback')).toBe('Fallback')
  })

  it('describes rate limits as temporary for any 429', () => {
    expect(messageFromResponse({ status: 429 }, null, 'Fallback')).toMatch(
      /wait a moment/,
    )
  })

  it('keeps the 413 fallback generic across all upload caps', () => {
    // 413 can mean per-file, count, or total size — the fallback must not
    // claim a specific one when the server detail is missing.
    expect(messageFromResponse({ status: 413 }, null, 'Fallback')).toMatch(
      /upload limit was exceeded/,
    )
    expect(messageFromResponse({ status: 413 }, null, 'Fallback')).not.toMatch(
      /10 MB/,
    )
  })
})
