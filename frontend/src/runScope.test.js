import { describe, expect, it } from 'vitest'
import { canMutateFiles, createRunScope } from './runScope'

describe('createRunScope generations', () => {
  it('issues incrementing ids with live signals', () => {
    const scope = createRunScope()
    const first = scope.begin()
    const second = scope.begin()
    expect(second.id).toBeGreaterThan(first.id)
    expect(first.signal.aborted).toBe(true) // superseded run is aborted
    expect(second.signal.aborted).toBe(false)
  })

  it('treats only the latest id as current', () => {
    const scope = createRunScope()
    const stale = scope.begin()
    const current = scope.begin()
    expect(scope.isCurrent(stale.id)).toBe(false)
    expect(scope.isCurrent(current.id)).toBe(true)
  })

  it('cancel aborts the live signal and invalidates its id', () => {
    const scope = createRunScope()
    const run = scope.begin()
    scope.cancel()
    expect(run.signal.aborted).toBe(true)
    expect(scope.isCurrent(run.id)).toBe(false)
  })

  it('begin after cancel starts a fresh live run', () => {
    const scope = createRunScope()
    const old = scope.begin()
    scope.cancel()
    const next = scope.begin()
    expect(old.signal.aborted).toBe(true)
    expect(next.signal.aborted).toBe(false)
    expect(scope.isCurrent(old.id)).toBe(false)
    expect(scope.isCurrent(next.id)).toBe(true)
  })

  it('cancel with no live run is safe and still invalidates', () => {
    const scope = createRunScope()
    const run = scope.begin()
    scope.cancel()
    expect(() => scope.cancel()).not.toThrow()
    expect(scope.isCurrent(run.id)).toBe(false)
  })
})

describe('stale-response protection pattern', () => {
  it('ignores a stale success after a newer run began', () => {
    const scope = createRunScope()
    const applied = []
    const first = scope.begin()
    scope.begin() // newer analysis supersedes the first
    if (scope.isCurrent(first.id)) {
      applied.push('stale-success')
    }
    expect(applied).toHaveLength(0)
  })

  it('ignores a stale error after cancel', () => {
    const scope = createRunScope()
    const applied = []
    const run = scope.begin()
    scope.cancel() // e.g. startOver while the request was in flight
    if (scope.isCurrent(run.id)) {
      applied.push('stale-error')
    }
    expect(applied).toHaveLength(0)
  })

  it('applies the current run and never an older one', () => {
    const scope = createRunScope()
    const applied = []
    const previous = scope.begin()
    const current = scope.begin()
    if (scope.isCurrent(previous.id)) {
      applied.push('previous')
    }
    if (scope.isCurrent(current.id)) {
      applied.push('current')
    }
    expect(applied).toEqual(['current'])
  })
})

describe('canMutateFiles', () => {
  it('blocks mutation while uploading', () => {
    expect(canMutateFiles('uploading')).toBe(false)
  })

  it('allows mutation in every other status', () => {
    expect(canMutateFiles('idle')).toBe(true)
    expect(canMutateFiles('error')).toBe(true)
    expect(canMutateFiles('success')).toBe(true)
  })
})
