import { useEffect, useRef, useState } from 'react'
import {
  attentionKeyFinding,
  attentionNote,
  formatReferenceLine,
  partitionValues,
} from '../needsAttention'
import { groupReportsBySource } from '../reportGroups'
import { buildFindingQuestion } from '../askAboutFinding'
import ReportChat from './ReportChat'

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`
}

function AnalysisResultView({ analysis, analysisId, onStartOver }) {
  const reportGroups = groupReportsBySource(analysis)
    .map((group) => {
      const partitioned = partitionValues(group.report.important_values)
      return {
        ...group,
        values: partitioned.attention,
        unevaluable: partitioned.unable,
        withinRange: partitioned.withinRange,
        keyFindings: group.report.key_findings || [],
        summary: group.report.summary,
        explanation: group.report.simple_explanation,
      }
    })
  const attentionGroups = reportGroups.filter((group) => group.values.length > 0)
  const unevaluableCount = reportGroups.reduce(
    (sum, group) => sum + group.unevaluable.length,
    0,
  )
  const withinCount = reportGroups.reduce(
    (sum, group) => sum + group.withinRange.length,
    0,
  )
  const attentionCount = attentionGroups.reduce(
    (sum, group) => sum + group.values.length,
    0,
  )
  const evaluatedCount = attentionCount + withinCount + unevaluableCount

  // Prefill request for the chat composer: { text, nonce }. Setting it fills
  // the composer without sending anything; the nonce lets the chat apply
  // each click exactly once even if the same question is requested twice.
  const [prefill, setPrefill] = useState(null)
  const prefillNonce = useRef(0)

  function handleAskAbout(item) {
    prefillNonce.current += 1
    setPrefill({ text: buildFindingQuestion(item), nonce: prefillNonce.current })
  }

  const showReportNames = reportGroups.length > 1
  const hasAttention = attentionGroups.length > 0
  const computedFindings = attentionGroups.flatMap((group) =>
    group.values.map(attentionKeyFinding),
  )
  const modelKeyFindings = reportGroups.flatMap((group) => group.keyFindings)
  const displayKeyFindings =
    modelKeyFindings.length > 0 ? modelKeyFindings : computedFindings

  // Move keyboard focus to the results heading when the results screen
  // first appears (mount-only, so ordinary re-renders never steal focus).
  useEffect(() => {
    document.getElementById('report-findings-heading')?.focus()
  }, [])

  return (
    <div className="mt-6 text-left sm:mt-7">
      {/* Header bar */}
      <div className="flex flex-col gap-1 border-b border-scanora-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <span className="scanora-kicker">Analysis Complete</span>
          <h2 id="report-findings-heading" tabIndex={-1} className="mt-1 font-heading text-xl font-semibold leading-tight text-scanora-text outline-none sm:text-2xl">
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

      {/* Results overview: what was evaluated, flagged, and unevaluable */}
      <section
        className="scanora-panel mt-5 p-4 sm:p-5"
        aria-labelledby="results-overview-heading"
      >
        <h3
          id="results-overview-heading"
          className="font-heading text-xs font-semibold tracking-wider text-scanora-text uppercase"
        >
          Results overview
        </h3>
        {evaluatedCount > 0 ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-xs leading-relaxed text-scanora-muted">Results reviewed</dt>
                <dd className="font-heading text-xl font-semibold text-scanora-text tabular-nums">
                  {evaluatedCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs leading-relaxed text-scanora-muted">Need attention</dt>
                <dd className="font-heading text-xl font-semibold text-scanora-attention tabular-nums">
                  {attentionCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs leading-relaxed text-scanora-muted">No attention flag</dt>
                <dd className="font-heading text-xl font-semibold text-scanora-text tabular-nums">
                  {withinCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs leading-relaxed text-scanora-muted">Unable to evaluate</dt>
                <dd className="font-heading text-xl font-semibold text-scanora-text tabular-nums">
                  {unevaluableCount}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-scanora-muted sm:text-sm">
              {pluralize(evaluatedCount, 'result was', 'results were')} reviewed
              from your {reportGroups.length === 1 ? 'report' : 'reports'}.
              Items needing attention are listed below. This is not a medical clearance.
              {unevaluableCount > 0 &&
                ` ${pluralize(unevaluableCount, 'Result', 'Results')} without a usable reference range could not be checked; this does not mean ${unevaluableCount === 1 ? 'it is' : 'they are'} within range.`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-scanora-muted sm:text-sm">
            No individual results were available to evaluate in these reports.
          </p>
        )}
      </section>

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
            ? 'These items were outside the provided reference range or explicitly flagged on your document.'
            : unevaluableCount > 0
              ? 'No out-of-range values were identified among the results that could be evaluated. Some results could not be evaluated because no usable reference range was shown.'
              : 'No out-of-range values were identified among the results that could be evaluated against a visible reference range.'}
        </p>

        {hasAttention ? (
          <>
          <div className="mt-4 space-y-3.5">
            {attentionGroups.map((group) => (
              <div key={group.key} className="scanora-panel overflow-hidden">
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
                      key={`${group.key}-${item.name}-${index}`}
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

                      <button
                        type="button"
                        onClick={() => handleAskAbout(item)}
                        aria-label={`Ask about this ${item.name || 'result'}`}
                        className="scanora-focus-ring mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-scanora-border bg-scanora-surface px-2.5 py-1.5 text-xs font-medium text-scanora-muted transition-colors duration-180 hover:border-scanora-primary hover:text-scanora-primary"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        Ask about this
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {unevaluableCount > 0 && (
            <div className="scanora-panel mt-3.5 p-4 sm:p-5">
              <p className="text-xs leading-relaxed text-scanora-muted sm:text-sm">
                {unevaluableCount} {unevaluableCount === 1 ? 'result' : 'results'} could
                not be evaluated because no usable reference range was shown.{' '}
                {unevaluableCount === 1 ? 'It is' : 'They are'} not shown as within
                range.
              </p>
            </div>
          )}
          </>
        ) : (
          <div className="scanora-success-callout mt-4 p-4 sm:p-5">
            <p className="font-heading text-sm font-semibold text-scanora-success sm:text-base">
              No attention-worthy values identified in the evaluated report data.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-scanora-text sm:text-sm">
              {unevaluableCount > 0
                ? `Results that had a visible reference range were within that range. ${unevaluableCount} ${unevaluableCount === 1 ? 'result' : 'results'} could not be evaluated because no usable reference range was shown; this does not mean ${unevaluableCount === 1 ? 'it was' : 'they were'} within range. This does not constitute clinical clearance; consult your physician for comprehensive evaluation.`
                : 'No out-of-range values were found among the results that could be evaluated against a visible reference range. This does not constitute clinical clearance; consult your physician for comprehensive evaluation.'}
            </p>
          </div>
        )}
      </section>

      {/* Key Findings List */}
      {hasAttention && displayKeyFindings.length > 0 && (
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
            {displayKeyFindings.map((finding, index) => (
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
            <div key={`${group.key}-context`} className="scanora-panel p-4 sm:p-5">
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

      {/* Report Specific Chat (keyed by analysis so history cannot bleed across reports) */}
      <ReportChat key={analysisId ?? 'legacy'} analysisId={analysisId} prefillRequest={prefill} />

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
