import { useEffect } from 'react'
import { attentionNote, isMissingLabel, partitionValues } from '../needsAttention'
import PageFooter from './PageFooter'
import ReportChat from './ReportChat'

function AnalysisResultView({
  analysis,
  analysisId,
  onAttachFiles,
  attachmentErrors,
  onOpenDisclaimer,
}) {
  const reportValues = (Array.isArray(analysis?.reports) ? analysis.reports : [])
    .flatMap((report) =>
      Array.isArray(report?.important_values) ? report.important_values : [],
    )
  const { attention: attentionFindings, unable: unableFindings } =
    partitionValues(reportValues)

  useEffect(() => {
    document.getElementById('report-findings-heading')?.focus()
  }, [])

  return (
    <div className="scanora-results flex flex-col gap-6 text-left">
      <section
        className="scanora-analysis-complete"
        aria-labelledby="report-findings-heading"
      >
        <div className="scanora-results-heading">
          <h2
            id="report-findings-heading"
            tabIndex={-1}
            className="scanora-results-title font-heading font-semibold text-scanora-text outline-none"
          >
            Analysis Complete
          </h2>
        </div>

        {attentionFindings.length > 0 ? (
          <ul
            className="scanora-findings-list"
            aria-label="Key findings needing attention"
          >
            {attentionFindings.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {`${item.name}: ${item.value}${item.unit && !isMissingLabel(item.unit) ? ` ${item.unit}` : ''} — ${attentionNote(item)}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="scanora-no-findings">
            {unableFindings.length > 0
              ? 'No findings needing attention were identified among the values that could be evaluated.'
              : 'No findings needing attention were identified from the visible report ranges.'}
          </p>
        )}
        {unableFindings.length > 0 && (
          <p className="scanora-no-findings">
            Some report values could not be evaluated from the visible result and reference range information. They are not treated as normal.
          </p>
        )}
      </section>

      <ReportChat
        key={analysisId ?? 'legacy'}
        analysisId={analysisId}
        onAttachFiles={onAttachFiles}
        attachmentErrors={attachmentErrors}
      />
      <PageFooter onOpenDisclaimer={onOpenDisclaimer} showAttribution={false} />
    </div>
  )
}

export default AnalysisResultView
