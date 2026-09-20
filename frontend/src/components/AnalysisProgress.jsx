import { useEffect, useState } from 'react'
import { ANALYSIS_STAGES, STAGE_ADVANCE_MS } from '../analysisStages'

function AnalysisProgress({ stages = ANALYSIS_STAGES, advanceMs = STAGE_ADVANCE_MS }) {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    if (stageIndex >= stages.length - 1) {
      return undefined
    }
    const timer = setTimeout(() => {
      setStageIndex((index) => Math.min(index + 1, stages.length - 1))
    }, advanceMs)
    return () => clearTimeout(timer)
  }, [stageIndex, stages, advanceMs])

  const current = stages[stageIndex]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Analysis in progress: ${current.label}`}
      className="scanora-panel mt-4 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-scanora-primary animate-pulse" aria-hidden="true" />
        <p className="font-heading text-sm font-semibold text-scanora-text sm:text-base">
          {current.label}
          <span className="analyzing-dots" aria-hidden="true" />
        </p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-scanora-muted sm:text-sm">
        {current.hint} This usually takes a little while — please keep this tab open.
      </p>
      <ol className="mt-3 space-y-1.5" aria-label="Analysis stages">
        {stages.map((stage, index) => {
          const done = index < stageIndex
          const active = index === stageIndex
          return (
            <li
              key={stage.id}
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-2 text-xs sm:text-sm ${
                active ? 'font-medium text-scanora-text' : 'text-scanora-muted'
              }`}
            >
              {done ? (
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-scanora-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    active ? 'bg-scanora-primary animate-pulse' : 'bg-scanora-border-strong'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{stage.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default AnalysisProgress
