import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import AnalysisProgress from './AnalysisProgress'
import { ANALYSIS_STAGES, STAGE_ADVANCE_MS } from '../analysisStages'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AnalysisProgress stages', () => {
  it('starts at the first stage with a live progress announcement', () => {
    render(<AnalysisProgress />)
    expect(
      screen.getByRole('status', { name: /analysis in progress: uploading reports/i }),
    ).toBeTruthy()
    expect(screen.getByText('Reading reports')).toBeTruthy()
  })

  it('advances through stages deterministically on a fixed interval', () => {
    render(<AnalysisProgress />)
    // One interval per act flush: each scheduled timer fires exactly once.
    act(() => {
      vi.advanceTimersByTime(STAGE_ADVANCE_MS)
    })
    expect(
      screen.getByRole('status', { name: /analysis in progress: reading reports/i }),
    ).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(STAGE_ADVANCE_MS)
    })
    act(() => {
      vi.advanceTimersByTime(STAGE_ADVANCE_MS)
    })
    expect(
      screen.getByRole('status', { name: /analysis in progress: preparing your summary/i }),
    ).toBeTruthy()
  })

  it('rests on the final stage instead of faking completion', () => {
    render(<AnalysisProgress />)
    for (let step = 0; step < 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(STAGE_ADVANCE_MS)
      })
    }
    expect(
      screen.getByRole('status', { name: /analysis in progress: preparing your summary/i }),
    ).toBeTruthy()
    // No numeric percentages anywhere.
    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('marks past stages done and the current stage active', () => {
    const { container } = render(<AnalysisProgress />)
    act(() => {
      vi.advanceTimersByTime(STAGE_ADVANCE_MS)
    })
    const current = container.querySelector('[aria-current="step"]')
    expect(current?.textContent).toMatch(/reading reports/i)
  })

  it('exposes the stage list in order', () => {
    expect(ANALYSIS_STAGES.map((stage) => stage.id)).toEqual([
      'uploading',
      'reading',
      'analyzing',
      'preparing',
    ])
  })
})
