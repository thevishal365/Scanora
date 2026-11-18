import { describe, expect, it } from 'vitest'
import { APP_ACTIONS, APP_STATES, appStateReducer } from './appState'

describe('appStateReducer', () => {
  it('moves through analysis, completion, stop, error, and reset transitions', () => {
    let state = appStateReducer(APP_STATES.IDLE, { type: APP_ACTIONS.START_ANALYSIS })
    expect(state).toBe(APP_STATES.ANALYZING)

    state = appStateReducer(state, { type: APP_ACTIONS.FINISH_ANALYSIS })
    expect(state).toBe(APP_STATES.SUCCESS)

    state = appStateReducer(state, { type: APP_ACTIONS.FILES_CHANGED })
    expect(state).toBe(APP_STATES.IDLE)

    state = appStateReducer(state, { type: APP_ACTIONS.START_ANALYSIS })
    expect(state).toBe(APP_STATES.ANALYZING)
    state = appStateReducer(state, { type: APP_ACTIONS.STOP_ANALYSIS })
    expect(state).toBe(APP_STATES.IDLE)

    state = appStateReducer(state, { type: APP_ACTIONS.ANALYSIS_FAILED })
    expect(state).toBe(APP_STATES.ERROR)
    state = appStateReducer(state, { type: APP_ACTIONS.RESET_SCAN })
    expect(state).toBe(APP_STATES.IDLE)
  })

  it('ignores transitions that are not valid for the current state', () => {
    expect(
      appStateReducer(APP_STATES.IDLE, { type: APP_ACTIONS.FINISH_ANALYSIS }),
    ).toBe(APP_STATES.IDLE)
    expect(
      appStateReducer(APP_STATES.SUCCESS, { type: APP_ACTIONS.START_ANALYSIS }),
    ).toBe(APP_STATES.SUCCESS)
    expect(
      appStateReducer(APP_STATES.ERROR, { type: APP_ACTIONS.STOP_ANALYSIS }),
    ).toBe(APP_STATES.ERROR)
  })
})
