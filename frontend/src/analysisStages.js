// Estimated stages for the Gemini analysis wait. These are time-based
// progress cues, not measured percentages: the backend exposes no progress
// events for a single analysis request, so the final stage persists calmly
// until the request settles. Never add numeric percentages here.
export const ANALYSIS_STAGES = [
  {
    id: 'uploading',
    label: 'Uploading reports',
    hint: 'Sending your files securely for analysis.',
  },
  {
    id: 'reading',
    label: 'Reading reports',
    hint: 'Extracting values and reference ranges.',
  },
  {
    id: 'analyzing',
    label: 'Analyzing findings',
    hint: 'Checking values against their reference ranges.',
  },
  {
    id: 'preparing',
    label: 'Preparing your summary',
    hint: 'Writing a plain-language summary of the findings.',
  },
]

export const STAGE_ADVANCE_MS = 5000
