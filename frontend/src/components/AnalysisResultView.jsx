import { Fragment, useEffect } from 'react'
import {
  attentionNote,
  formatReferenceLine,
  isMissingLabel,
  partitionValues,
} from '../needsAttention'
import { groupReportsBySource } from '../reportGroups'
import ReportChat from './ReportChat'

function AnalysisResultView({ analysis, analysisId, onStartOver }) {
  const attentionGroups = groupReportsBySource(analysis)
    .map((group) => ({
      ...group,
      values: partitionValues(group.report.important_values).attention,
    }))
    .filter((group) => group.values.length > 0)
  const hasAttention = attentionGroups.length > 0

  useEffect(() => {
    document.getElementById('report-findings-heading')?.focus()
  }, [])

  return (
    <div className="scanora-results mt-6 text-left sm:mt-7">
      <div className="scanora-results-heading border-b border-scanora-border-subtle pb-4">
        <span className="scanora-kicker">Analysis Complete</span>
        <h2
          id="report-findings-heading"
          tabIndex={-1}
          className="mt-1 font-heading text-xl font-semibold leading-tight text-scanora-text outline-none sm:text-2xl"
        >
          Findings that may need your attention
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-scanora-muted">
          Here are the results from your report that may need your attention.
        </p>
      </div>

      {hasAttention ? (
        <>
          <section className="mt-5" aria-label="Attention-worthy findings">
            <div className="scanora-finding-table scanora-panel overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-scanora-border-subtle bg-scanora-surface-muted">
                    <th
                      scope="col"
                      className="px-3 py-2 font-heading text-xs font-semibold tracking-wider text-scanora-muted uppercase sm:px-4"
                    >
                      Test / Parameter
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 font-heading text-xs font-semibold tracking-wider text-scanora-muted uppercase sm:px-4"
                    >
                      Result
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 font-heading text-xs font-semibold tracking-wider text-scanora-muted uppercase sm:px-4"
                    >
                      Reference Range
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 font-heading text-xs font-semibold tracking-wider text-scanora-muted uppercase sm:px-4"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attentionGroups.map((group) => (
                    <Fragment key={group.key}>
                      {attentionGroups.length > 1 && (
                        <tr>
                          <th
                            scope="colgroup"
                            colSpan={4}
                            className="border-b border-scanora-border-subtle bg-scanora-surface-subtle px-3 py-1.5 font-heading text-xs font-semibold tracking-wider text-scanora-muted uppercase sm:px-4"
                          >
                            {group.name}
                          </th>
                        </tr>
                      )}
                      {group.values.map((item, index) => (
                        <tr
                          key={`${group.key}-${item.name}-${index}`}
                          className="border-b border-scanora-border-subtle last:border-b-0"
                        >
                          <td className="px-3 py-2 font-heading font-semibold text-sm text-scanora-text uppercase sm:px-4">
                            {item.name}
                          </td>
                          <td className="scanora-finding-value px-3 py-2 font-heading font-semibold whitespace-nowrap text-sm text-scanora-text tabular-nums sm:px-4 sm:text-base">
                            {item.value}
                            {item.unit && !isMissingLabel(item.unit)
                              ? ` ${item.unit}`
                              : ''}
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap text-scanora-muted sm:px-4 sm:text-sm">
                            {formatReferenceLine(item)}
                          </td>
                          <td className="px-3 py-2 text-xs leading-relaxed text-scanora-attention sm:px-4 sm:text-sm">
                            {attentionNote(item)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <ReportChat
            key={analysisId ?? 'legacy'}
            analysisId={analysisId}
          />
        </>
      ) : (
        <p className="scanora-success-callout mt-5 p-4 text-sm leading-relaxed sm:p-5">
          No findings in this report were flagged as needing attention based on
          the provided reference ranges.
        </p>
      )}

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
