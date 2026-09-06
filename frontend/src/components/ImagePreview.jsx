function ImagePreview({ item, onRemove }) {
  return (
    <li className="scanora-panel flex items-center justify-between gap-3 p-3 transition-colors duration-150 hover:border-scanora-border-strong">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={item.previewUrl}
          alt={`Preview of ${item.file.name}`}
          className="h-12 w-12 shrink-0 rounded-md border border-scanora-border object-cover bg-scanora-surface-muted"
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-scanora-text" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="mt-0.5 text-xs font-medium text-scanora-muted">
            {item.sizeLabel}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.file.name}`}
        title={`Remove ${item.file.name}`}
        className="scanora-focus-ring inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-scanora-muted transition-colors duration-180 hover:bg-scanora-surface-muted hover:text-scanora-error"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}

export default ImagePreview
