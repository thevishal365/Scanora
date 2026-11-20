function PageFooter({ onOpenDisclaimer, showAttribution = true }) {
  return (
    <footer className="scanora-footer">
      <button
        type="button"
        className="scanora-footer-disclaimer scanora-focus-ring"
        aria-haspopup="dialog"
        aria-controls="medical-disclaimer-dialog"
        onClick={onOpenDisclaimer}
      >
        Medical Disclaimer
      </button>
      {showAttribution && (
        <span className="scanora-footer-attribution">
          <span className="scanora-footer-separator" aria-hidden="true">·</span>
          <span className="scanora-footer-author">
            Designed by
            <a
              href="https://x.com/thevishal365"
              target="_blank"
              rel="noopener noreferrer"
              className="scanora-focus-ring"
            >
              Vishal
            </a>
          </span>
        </span>
      )}
    </footer>
  )
}

export default PageFooter
