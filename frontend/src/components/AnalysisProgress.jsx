function AnalysisProgress() {
  return (
    <div className="scanora-thinking" role="status" aria-live="polite">
      <span className="scanora-thinking-mark" aria-hidden="true" />
      <span>Reading your reports<span className="analyzing-dots" aria-hidden="true" /></span>
    </div>
  )
}

export default AnalysisProgress
