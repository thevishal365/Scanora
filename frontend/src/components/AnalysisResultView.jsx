import { useEffect, useRef, useState } from 'react'
import {
  attentionNote,
  formatReferenceLine,
  partitionValues,
} from '../needsAttention'
import { groupReportsBySource } from '../reportGroups'
import { buildFindingQuestion } from '../askAboutFinding'
import ReportChat from './ReportChat'

function AnalysisResultView({ analysis, analysisId, onStartOver }) {
  const attentionGroups = groupReportsBySource(analysis)
    .map((group) => ({
      ...group,
      values: partitionValues(group.report.important_values).attention,
    }))
    .filter((group) => group.values.length > 0)
  const hasAttention = attentionGroups.length > 0

  const [prefill, setPrefill] = useState(null)
  const prefillNonce = useRef(0)

  function handleAskAbout(item) {
    prefillNonce.current += 1
    setPrefill({
      text: buildFindingQuestion(item),
      finding: item,
      nonce: prefillNonce.current,
    })
  }

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
          <section
            className="mt-5 space-y-3"
            aria-label="Attention-worthy findings"
          >
            {attentionGroups.map((group) => (
              <div key={group.key} className="space-y-3">
                {attentionGroups.length > 1 && (
                  <p className="font-heading text-xs font-semibold tracking-wider text-scanora-muted uppercase">
                    {group.name}
                  </p>
                )}
                {group.values.map((item, index) => (
                  <article
                    key={`${group.key}-${item.name}-${index}`}
                    className="scanora-finding-card scanora-panel border-l-4 border-l-scanora-attention p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h3 className="font-heading text-sm font-semibold text-scanora-text uppercase sm:text-base">
                        {item.name}
                      </h3>
                      <p className="scanora-finding-value font-heading text-base font-semibold text-scanora-text tabular-nums sm:text-lg">
                        {item.value}
                        {item.unit ? ` ${item.unit}` : ''}
                      </p>
                    </div>

                    {formatReferenceLine(item) && (
                      <p className="mt-1 text-xs text-scanora-muted sm:text-sm">
                        {formatReferenceLine(item)}
                      </p>
                    )}

                    <p className="mt-2 text-xs leading-relaxed text-scanora-muted sm:text-sm">
                      {attentionNote(item)}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleAskAbout(item)}
                      aria-label={`Ask about this ${item.name || 'result'}`}
                      className="scanora-focus-ring mt-3 inline-flex h-10 cursor-pointer items-center rounded-md bg-scanora-primary px-4 text-xs font-semibold text-white transition-colors duration-180 hover:bg-scanora-brand-hover"
                    >
                      Ask about this
                    </button>
                  </article>
                ))}
              </div>
            ))}
          </section>

          <ReportChat
            key={analysisId ?? 'legacy'}
            analysisId={analysisId}
            prefillRequest={prefill}
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
