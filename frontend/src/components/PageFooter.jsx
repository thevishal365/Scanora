function PageFooter() {
  return (
    <footer className="scanora-footer mt-5 flex items-center justify-between pb-2 text-[11px] text-scanora-faint">
      <p className="scanora-footer-credit">Powered by Gemini</p>
      <p className="scanora-footer-author inline-flex items-center text-right">
        Designed by{' '}
        <a
          href="https://x.com/thevishal365"
          target="_blank"
          rel="noopener noreferrer"
          className="scanora-focus-ring ml-1 inline-flex cursor-pointer items-center text-scanora-muted underline decoration-scanora-border underline-offset-2 transition-colors duration-180 hover:text-scanora-primary hover:decoration-scanora-primary/40"
        >
          Vishal
        </a>
      </p>
    </footer>
  )
}

export default PageFooter
