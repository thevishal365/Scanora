// Minimal generation/abort scope for in-flight async requests (M6).
//
// A scope hands out incrementing generation IDs, each paired with an
// AbortSignal. Consumers apply a settled response only when its ID is still
// current. Starting a new run (begin) or resetting (cancel) invalidates every
// previous ID and aborts its signal, so late success/error callbacks from a
// cancelled or superseded request can never resurrect old state.
export function createRunScope() {
  let current = 0
  let controller = null

  function abortLive() {
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  return {
    begin() {
      abortLive()
      current += 1
      controller = new AbortController()
      return { id: current, signal: controller.signal }
    },
    cancel() {
      abortLive()
      current += 1
    },
    isCurrent(id) {
      return id === current
    },
  }
}

// File selection may only change while no analysis request is in flight.
// Single source of truth for every add/remove/clear guard.
export function canMutateFiles(status) {
  return status !== 'uploading'
}
