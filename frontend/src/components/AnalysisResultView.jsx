import { useEffect } from 'react'
import { attentionNote, isMissingLabel, partitionValues } from '../needsAttention'
import ReportChat from './ReportChat'

function AnalysisResultView({ analysis, analysisId, onAttachFiles, attachmentErrors }) {
  const attentionFindings = (Array.isArray(analysis?.reports) ? analysis.reports : [])
    .flatMap((report) => partitionValues(report?.important_values).attention)

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
            No findings needing attention were identified from the visible report ranges.
          </p>
        )}
      </section>

      <ReportChat
        key={analysisId ?? 'legacy'}
        analysisId={analysisId}
        onAttachFiles={onAttachFiles}
        attachmentErrors={attachmentErrors}
      />
    </div>
  )
}

export default AnalysisResultView
