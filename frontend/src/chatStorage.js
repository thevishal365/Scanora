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
