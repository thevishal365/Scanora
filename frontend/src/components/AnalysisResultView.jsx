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
      summary: report.summary,
      explanation: report.simple_explanation,
    }))
  const attentionGroups = reportGroups.filter((group) => group.values.length > 0)

  const showReportNames = reportGroups.length > 1
  const hasAttention = attentionGroups.length > 0
  const keyFindings = attentionGroups.flatMap((group) =>
    group.values.map(attentionKeyFinding),
  )

  return (
    <div className="mt-6 text-left sm:mt-7">
      {/* Header bar */}
      <div className="flex flex-col gap-1 border-b border-scanora-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <span className="scanora-kicker">Analysis Complete</span>
          <h2 className="mt-1 font-heading text-xl font-semibold leading-tight text-scanora-text sm:text-2xl">
            Report Findings
          </h2>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-scanora-muted sm:text-right">
          Grounded solely in data visible on the uploaded document images.
        </p>
      </div>

      {/* In brief overall summary */}
      {analysis.overall_summary && (
        <section
          className="scanora-panel mt-5 p-4 sm:p-5"
          aria-labelledby="overall-summary-heading"
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-scanora-primary" aria-hidden="true" />
            <h3
              id="overall-summary-heading"
              className="font-heading text-xs font-semibold tracking-wider text-scanora-text uppercase"
            >
              Executive Summary
            </h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-scanora-text sm:text-[15px]">
            {analysis.overall_summary}
          </p>
        </section>
      )}

      {/* Needs Attention or No Issues section */}
      <section className="mt-6" aria-labelledby="attention-section-heading">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {hasAttention ? (
              <span className="scanora-pill-attention">
                <span className="h-1.5 w-1.5 rounded-full bg-scanora-attention" aria-hidden="true" />
                Needs Attention
              </span>
            ) : (
              <span className="scanora-pill-success">
                <span className="h-1.5 w-1.5 rounded-full bg-scanora-success" aria-hidden="true" />
                Evaluated
              </span>
            )}
            <h3
              id="attention-section-heading"
              className="font-heading text-base font-semibold text-scanora-text sm:text-lg"
            >
              {hasAttention ? 'Identified Values' : 'No Flags Found'}
            </h3>
          </div>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-scanora-muted sm:text-sm">
          {hasAttention
            ? 'These items were outside standard laboratory reference intervals or explicitly flagged on your document.'
            : 'No supported attention-worthy values were identified in the report data we could evaluate.'}
        </p>

        {hasAttention ? (
          <div className="mt-4 space-y-3.5">
            {attentionGroups.map((group) => (
              <div key={group.name} className="scanora-panel overflow-hidden">
                {showReportNames && (
                  <div className="border-b border-scanora-border-subtle bg-scanora-surface-muted px-4 py-2 sm:px-5">
                    <p className="font-heading text-xs font-semibold tracking-wider text-scanora-text uppercase">
                      {group.name}
                    </p>
                  </div>
                )}
                <ul className="divide-y divide-scanora-border-subtle">
                  {group.values.map((item, index) => (
                    <li
                      key={`${group.name}-${item.name}-${index}`}
                      className="border-l-[3px] border-scanora-attention bg-scanora-attention-soft/30 p-4 transition-colors sm:p-5"
                    >
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                        <span className="font-heading text-sm font-semibold text-scanora-text sm:text-base">
                          {item.name}
                        </span>
                        <span className="font-heading text-base font-bold text-scanora-attention tabular-nums sm:text-lg">
                          {item.value}
                          {item.unit ? ` ${item.unit}` : ''}
                        </span>
                      </div>

                      {formatReferenceLine(item) && (
                        <p className="mt-1 text-xs font-medium text-scanora-muted">
                          {formatReferenceLine(item)}
                        </p>
                      )}

                      <p className="mt-2 text-xs leading-relaxed text-scanora-text sm:text-sm">
                        {attentionNote(item)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="scanora-success-callout mt-4 p-4 sm:p-5">
            <p className="font-heading text-sm font-semibold text-scanora-success sm:text-base">
              No attention-worthy values identified in the evaluated report data.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-scanora-text sm:text-sm">
              All clearly visible lab findings were within their respective listed reference ranges. This does not constitute clinical clearance; consult your physician for comprehensive evaluation.
            </p>
          </div>
        )}
      </section>

      {/* Key Findings List */}
      {hasAttention && keyFindings.length > 0 && (
        <section
          className="mt-6 border-t border-scanora-border-subtle pt-5"
          aria-labelledby="key-findings-heading"
        >
          <h3
            id="key-findings-heading"
            className="font-heading text-base font-semibold text-scanora-text sm:text-lg"
          >
            Key Observations
          </h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-scanora-text sm:text-sm">
            {keyFindings.map((finding, index) => (
              <li key={`${finding}-${index}`} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-scanora-primary"
                />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Report Context & Notes */}
      <section
        className="mt-6 border-t border-scanora-border-subtle pt-5"
        aria-labelledby="report-context-heading"
      >
        <h3
          id="report-context-heading"
          className="font-heading text-base font-semibold text-scanora-text sm:text-lg"
        >
          Report Context & Notes
        </h3>
        <div className="mt-3 space-y-3">
          {reportGroups.map((group) => (
            <div key={`${group.name}-context`} className="scanora-panel p-4 sm:p-5">
              <p className="font-heading text-xs font-semibold tracking-wider text-scanora-text uppercase">
                {showReportNames ? group.name : 'Document Context'}
              </p>
              {group.summary && (
                <p className="mt-1.5 text-xs leading-relaxed text-scanora-text sm:text-sm">
                  {group.summary}
                </p>
              )}
              {group.explanation && (
                <p className="mt-2.5 border-t border-scanora-border-subtle pt-2.5 text-xs leading-relaxed text-scanora-muted">
                  {group.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Report Specific Chat */}
      <ReportChat reportContext={analysis} />

      {/* Reset Flow Button */}
      <div className="mt-7">
        <button
          type="button"
          onClick={onStartOver}
          className="scanora-button-secondary scanora-focus-ring flex w-full cursor-pointer items-center justify-center gap-2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Analyze More Reports
        </button>
      </div>
    </div>
  )
}

export default AnalysisResultView
