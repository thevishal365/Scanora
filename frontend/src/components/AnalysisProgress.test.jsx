import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AnalysisProgress from './AnalysisProgress'

afterEach(cleanup)

describe('AnalysisProgress', () => {
  it('announces a compact report-reading status', () => {
    render(<AnalysisProgress />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/Reading your reports/)).toBeTruthy()
    expect(screen.queryByRole('list', { name: /analysis stages/i })).toBeNull()
  })
})
