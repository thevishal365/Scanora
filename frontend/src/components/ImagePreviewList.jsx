import { formatFileSize } from '../reportFiles'
import ImagePreview from './ImagePreview'

function ImagePreviewList({ items, onRemove, onClearAll, disabled }) {
  if (!items || items.length === 0) {
    return null
  }

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)

  return (
    <div className="scanora-file-list flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-sm font-semibold text-scanora-text">
          Selected Reports ({items.length})
        </p>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          className="scanora-focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-semibold text-scanora-muted transition-colors duration-180 hover:bg-scanora-error-soft hover:text-scanora-error disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-scanora-muted"
        >
          <span>Clear all</span>
        </button>
      </div>
      <p className="scanora-file-limit text-scanora-faint">
        {formatFileSize(totalBytes)} total
      </p>
      <ul className="flex flex-col gap-2" aria-label="Selected report files">
        {items.map((item) => (
          <ImagePreview key={item.id} item={item} onRemove={onRemove} disabled={disabled} />
        ))}
      </ul>
    </div>
  )
}

export default ImagePreviewList