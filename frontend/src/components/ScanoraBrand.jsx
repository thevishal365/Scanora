const LENS_ICON_SRC = '/favicon.svg?v=lens2'

function ScanoraBrand() {
  return (
    <div className="inline-flex w-fit max-w-[18.75rem] items-center justify-center rounded-lg border border-scanora-border bg-scanora-card px-5 py-2.5">
      <p className="inline-flex items-center justify-center gap-2 overflow-visible font-heading text-xl font-semibold leading-none tracking-[0.12em] text-scanora-primary uppercase sm:gap-2.5 sm:text-2xl">
        <img
          src={LENS_ICON_SRC}
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
        />
        Scanora
      </p>
    </div>
  )
}

export default ScanoraBrand
