function PrivacyNote() {
  return (
    <div className="scanora-privacy-note mx-auto flex items-center justify-center gap-2 text-center text-xs leading-normal text-scanora-muted">
      <svg className="shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="4" y="8.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5m-3.5 3v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="min-w-0 md:whitespace-nowrap">
        Your reports are only used for this session and are not saved to an
        account.
      </p>
    </div>
  )
}

export default PrivacyNote