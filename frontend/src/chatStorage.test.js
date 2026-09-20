import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CHAT_STORAGE_KEY,
  chatStorageKey,
  clearStoredChat,
} from './components/ReportChat'

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('chat history bound to analysis identity', () => {
  it('namespaces the storage key per analysis', () => {
    expect(chatStorageKey('id-a')).toBe(`${CHAT_STORAGE_KEY}:id-a`)
    expect(chatStorageKey('id-b')).not.toBe(chatStorageKey('id-a'))
  })

  it('falls back to the legacy key without an identity', () => {
    expect(chatStorageKey(null)).toBe(CHAT_STORAGE_KEY)
    expect(chatStorageKey(undefined)).toBe(CHAT_STORAGE_KEY)
    expect(chatStorageKey('')).toBe(CHAT_STORAGE_KEY)
  })

  it('clears only the bound chat plus the legacy key', () => {
    sessionStorage.setItem(chatStorageKey('id-a'), '[{"role":"user"}]')
    sessionStorage.setItem(chatStorageKey('id-b'), '[{"role":"user"}]')
    sessionStorage.setItem(CHAT_STORAGE_KEY, '[{"role":"user"}]')
    clearStoredChat('id-a')
    expect(sessionStorage.getItem(chatStorageKey('id-a'))).toBeNull()
    expect(sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull()
    // Another analysis' history is untouched: no cross-report bleed.
    expect(sessionStorage.getItem(chatStorageKey('id-b'))).not.toBeNull()
  })

  it('clearing without an identity only drops the legacy key', () => {
    sessionStorage.setItem(chatStorageKey('id-a'), '[{"role":"user"}]')
    sessionStorage.setItem(CHAT_STORAGE_KEY, '[{"role":"user"}]')
    clearStoredChat(null)
    expect(sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(chatStorageKey('id-a'))).not.toBeNull()
  })
})
