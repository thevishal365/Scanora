function ImagePreview({ item, onRemove, disabled }) {
  return (
    <li className="scanora-file-chip" title={`${item.file.name} · ${item.sizeLabel}`}>
      <span>{item.file.name}</span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={disabled}
        aria-label={`Remove ${item.file.name}`}
        className="scanora-focus-ring"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}

export default ImagePreview
