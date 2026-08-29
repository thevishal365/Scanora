function ImagePreview({ item, onRemove }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-scanora-border bg-white px-3 py-3">
      <img
        src={item.previewUrl}
        alt={item.file.name}
        className="h-14 w-14 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-scanora-text">{item.file.name}</p>
        <p className="text-sm text-scanora-muted">{item.sizeLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.file.name}`}
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-scanora-muted transition-colors duration-200 hover:bg-cyan-50 hover:text-scanora-text focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scanora-primary"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ×
        </span>
      </button>
    </li>
  )
}

export default ImagePreview
