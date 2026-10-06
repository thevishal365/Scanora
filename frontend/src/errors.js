export const STATUS_MESSAGES = {
  400: 'The upload could not be processed. Please try again.',
  413: 'An upload limit was exceeded. Check the file requirements and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Your reports could not be analyzed. Please try again.',
  502: 'The analysis service could not be reached. Please try again.',
  503: 'The analysis service is temporarily unavailable. Please try again in a little while.',
  504: 'Analyzing your reports took too long. Please try again.',
}

// Exact server detail for an expired analysis identity. Mirrors backend
// HUMAN_ERRORS["chat_expired"]; matched by string to detect expiry without
// changing the API.
export const CHAT_EXPIRED_DETAIL =
  'Your previous analysis has expired. Please analyze your reports again.'

export function messageFromResponse(response, data, fallback) {
  if (data && typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail
  }
  const status =
    response && typeof response.status === 'number' ? response.status : null
  if (status && STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status]
  }
  return fallback
}