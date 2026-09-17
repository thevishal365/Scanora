import { formatFileSize } from '../reportFiles'
import ImagePreview from './ImagePreview'

function ImagePreviewList({ items, onRemove, onClearAll }) {
  if (!items || items.length === 0) {
    return null
  }

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wider text-scanora-muted uppercase font-heading">
          Selected Reports ({items.length})
        </p>
        <button
          type="button"
          onClick={onClearAll}
          className="scanora-focus-ring inline-flex h-9 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-scanora-muted transition-colors duration-180 hover:bg-scanora-surface-muted hover:text-scanora-error"
        >
          <span>Clear all</span>
        </button>
      </div>
      <p className="mb-2 text-[11px] text-scanora-faint">
        {formatFileSize(totalBytes)} total
      </p>
      <ul className="space-y-2.5" aria-label="Selected report files">
        {items.map((item) => (
          <ImagePreview key={item.id} item={item} onRemove={onRemove} />
        ))}
      </ul>
    </div>
  )
}

export default ImagePreviewList