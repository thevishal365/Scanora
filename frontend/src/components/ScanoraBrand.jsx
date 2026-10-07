function ScanoraBrand() {
  return (
    <div className="scanora-brand inline-flex items-center">
      <div className="inline-flex items-center gap-2 font-heading text-lg font-semibold tracking-wider text-scanora-primary uppercase sm:gap-2.5 sm:text-xl">
        <svg
          className="scanora-brand-mark h-7 w-7 shrink-0 sm:h-8 sm:w-8"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <rect x="4" y="3.5" width="18" height="25" rx="4" fill="currentColor" opacity=".12" />
          <path d="M9 8.5h7M9 12h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="20.5" cy="19.5" r="7" fill="#fff" stroke="currentColor" strokeWidth="2.2" />
          <path d="m25.5 24.5 3.2 3.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="20.5" cy="19.5" r="2.4" fill="currentColor" opacity=".18" />
        </svg>
        <span className="leading-none">Scanora</span>
      </div>
    </div>
  )
}

export default ScanoraBrand
