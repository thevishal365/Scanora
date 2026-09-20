// Stable multi-file provenance grouping (M4).
//
// Every report carries a server-issued source_id that identifies the uploaded
// file it was extracted from. Groups are keyed by that source_id — never by
// the Gemini-generated report_name, which is descriptive metadata only and
// may repeat across reports. The internal source_id is used for identity and
// React keys; it is never rendered. The server-provided source_label
// (sanitized upload filename) is used only as a display fallback.
export function groupReportsBySource(analysis) {
  const reports = Array.isArray(analysis?.reports) ? analysis.reports : []
  const seenKeys = new Set()

  return reports.map((report, index) => {
    const rawId =
      report && typeof report.source_id === 'string'
        ? report.source_id.trim()
        : ''
    // Legacy analyses (stored before source IDs existed) get a positional
    // fallback; collision-suffixing below still guarantees unique keys.
    let key = rawId || `legacy-${index + 1}`
    while (seenKeys.has(key)) {
      key = `${key}#${index + 1}`
    }
    seenKeys.add(key)

    const name =
      report?.report_name || report?.source_label || `Report ${index + 1}`

    return {
      key,
      sourceId: rawId || null,
      name,
      report,
      index,
    }
  })
}
