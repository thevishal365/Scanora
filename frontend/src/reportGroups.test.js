import { describe, expect, it } from 'vitest'
import { groupReportsBySource } from './reportGroups'

function makeReport(overrides = {}) {
  return {
    source_id: 'source-1',
    source_label: 'cbc.jpg',
    report_name: 'CBC',
    summary: 'Summary',
    key_findings: ['Finding'],
    important_values: [
      {
        name: 'Hemoglobin',
        value: '13.2',
        unit: 'g/dL',
        reference_range: '12.0 - 16.0',
      },
    ],
    simple_explanation: 'Explanation',
    ...overrides,
  }
}

function makeAnalysis(reports) {
  return { overall_summary: 'Summary', reports }
}

describe('groupReportsBySource', () => {
  it('keys groups by source_id and keeps findings with their report', () => {
    const first = makeReport({ source_id: 'source-1', report_name: 'CBC' })
    const second = makeReport({ source_id: 'source-2', report_name: 'Lipid' })
    const groups = groupReportsBySource(makeAnalysis([first, second]))

    expect(groups.map((group) => group.key)).toEqual(['source-1', 'source-2'])
    expect(groups[0].sourceId).toBe('source-1')
    expect(groups[0].report).toBe(first)
    expect(groups[0].report.important_values[0].name).toBe('Hemoglobin')
    expect(groups[1].report).toBe(second)
  })

  it('keeps duplicate report names as separate groups with unique keys', () => {
    const first = makeReport({
      source_id: 'source-1',
      report_name: 'Same Name',
      important_values: [{ name: 'Value A', value: '1', unit: '', reference_range: '' }],
    })
    const second = makeReport({
      source_id: 'source-2',
      report_name: 'Same Name',
      important_values: [{ name: 'Value B', value: '2', unit: '', reference_range: '' }],
    })
    const groups = groupReportsBySource(makeAnalysis([first, second]))

    expect(groups).toHaveLength(2)
    expect(new Set(groups.map((group) => group.key)).size).toBe(2)
    expect(groups.map((group) => group.name)).toEqual(['Same Name', 'Same Name'])
    // Attribution follows the source, not the shared display name.
    expect(groups[0].report.important_values[0].name).toBe('Value A')
    expect(groups[1].report.important_values[0].name).toBe('Value B')
  })

  it('falls back to the display filename and then a positional name', () => {
    const groups = groupReportsBySource(
      makeAnalysis([
        makeReport({ source_id: 'source-1', report_name: '', source_label: 'scan.png' }),
        makeReport({ source_id: 'source-2', report_name: '', source_label: '' }),
      ]),
    )
    expect(groups.map((group) => group.name)).toEqual(['scan.png', 'Report 2'])
  })

  it('gives legacy reports without source IDs unique keys', () => {
    const groups = groupReportsBySource(
      makeAnalysis([
        makeReport({ source_id: undefined, report_name: 'Old' }),
        makeReport({ source_id: '', report_name: 'Older' }),
      ]),
    )
    expect(groups.map((group) => group.sourceId)).toEqual([null, null])
    expect(new Set(groups.map((group) => group.key)).size).toBe(2)
    expect(groups.map((group) => group.name)).toEqual(['Old', 'Older'])
  })

  it('defensively uniquifies even duplicated source IDs', () => {
    const groups = groupReportsBySource(
      makeAnalysis([
        makeReport({ source_id: 'source-1' }),
        makeReport({ source_id: 'source-1' }),
      ]),
    )
    expect(new Set(groups.map((group) => group.key)).size).toBe(2)
  })

  it('handles missing or malformed analyses safely', () => {
    expect(groupReportsBySource(null)).toEqual([])
    expect(groupReportsBySource({})).toEqual([])
    expect(groupReportsBySource({ reports: null })).toEqual([])
  })
})
