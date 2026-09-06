const LENS_ICON_SRC = '/favicon.svg?v=lens2'

function ScanoraBrand() {
  return (
    <div className="inline-flex items-center">
      <div className="inline-flex items-center gap-2 font-heading text-lg font-semibold tracking-wider text-scanora-primary uppercase sm:gap-2.5 sm:text-xl">
        <img
          src={LENS_ICON_SRC}
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
        />
        <span className="leading-none">Scanora</span>
      </div>
    </div>
  )
}

export default ScanoraBrand
