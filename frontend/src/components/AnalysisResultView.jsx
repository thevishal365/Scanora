import {
  attentionKeyFinding,
  attentionNote,
  formatReferenceLine,
  valuesNeedingAttention,
} from '../needsAttention'
import ReportChat from './ReportChat'

function AnalysisResultView({ analysis, onStartOver }) {
  const reportGroups = (analysis.reports || [])
    .map((report, index) => ({
      name: report.report_name || `Report ${index + 1}`,
      values: valuesNeedingAttention(report.important_values),
    }))
    .filter((group) => group.values.length > 0)

  const showReportNames = reportGroups.length > 1
  const hasAttention = reportGroups.length > 0
  const keyFindings = reportGroups.flatMap((group) =>
    group.values.map(attentionKeyFinding),
  )

  return (
    <div className="mt-6 text-left">
      <h2 className="font-heading text-lg font-semibold text-scanora-text">
        Report Analysis
      </h2>

      <section className="mt-8" aria-labelledby="needs-attention-heading">
        <h3
          id="needs-attention-heading"
          className="font-heading text-base font-semibold text-scanora-text"
        >
          <span aria-hidden="true">⚠ </span>
          Needs Attention
        </h3>

        {hasAttention ? (
          <div className="mt-5 space-y-8">
            {reportGroups.map((group) => (
              <div key={group.name}>
                {showReportNames && (
                  <p className="mb-4 text-sm font-medium text-scanora-text">
                    {group.name}
                  </p>
                )}
                <ul className="space-y-6">
                  {group.values.map((item, index) => (
                    <li key={`${group.name}-${item.name}-${index}`}>
                      <p className="font-heading font-semibold text-scanora-text">
                        {item.name}
                      </p>
                      <p className="mt-1 text-scanora-text">
                        {item.value}
                        {item.unit ? ` ${item.unit}` : ''}
                      </p>
                      {formatReferenceLine(item) && (
                        <p className="mt-1 text-sm text-scanora-muted">
                          {formatReferenceLine(item)}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-scanora-muted">
                        {attentionNote(item)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <p className="font-heading font-semibold text-scanora-text">
              <span aria-hidden="true">✓ </span>
              No issues identified
            </p>
            <p className="mt-2 text-sm text-scanora-muted">
              No findings were identified as outside the reference ranges or
              explicitly flagged in the uploaded report.
            </p>
          </div>
        )}
      </section>

      {hasAttention && (
        <section className="mt-10" aria-labelledby="key-findings-heading">
          <h3
            id="key-findings-heading"
            className="font-heading text-base font-semibold text-scanora-text"
          >
            Key Findings
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-scanora-muted">
            {keyFindings.map((finding, index) => (
              <li key={`${finding}-${index}`}>{finding}</li>
            ))}
          </ul>
        </section>
      )}

      <ReportChat reportContext={analysis} />

      <button
        type="button"
        onClick={onStartOver}
        className="mt-10 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg border border-scanora-border bg-white px-4 font-heading text-base font-semibold text-scanora-text transition-colors duration-200 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scanora-primary"
      >
        Analyze more reports
      </button>
    </div>
  )
}

export default AnalysisResultView
