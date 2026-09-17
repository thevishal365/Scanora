export const STATUS_MESSAGES = {
  400: 'The upload could not be processed. Please try again.',
  413: 'Each file must be 10 MB or smaller.',
  429: 'Scanora has reached the current Gemini request limit. Please wait a minute and try again.',
  500: 'Your reports could not be analyzed. Please try again.',
  502: 'The analysis service could not be reached. Please try again.',
  503: 'Scanora is not configured to analyze reports yet.',
  504: 'Analyzing your reports took too long. Please try again.',
}

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