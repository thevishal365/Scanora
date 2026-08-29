function PageFooter() {
  return (
    <footer className="mt-5 flex justify-center">
      <p className="inline-flex w-fit max-w-full items-center rounded-lg border border-scanora-border bg-scanora-card px-4 py-1.5 text-center text-xs leading-relaxed font-normal text-scanora-muted">
        Built by -{' '}
        <a
          href="https://x.com/thevishal365"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 cursor-pointer items-center text-scanora-muted underline decoration-scanora-border underline-offset-2 transition-colors duration-200 hover:text-scanora-primary hover:decoration-scanora-primary/40 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scanora-primary"
        >
          Vishal
        </a>
      </p>
    </footer>
  )
}

export default PageFooter
