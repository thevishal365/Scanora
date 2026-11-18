import { formatFileSize } from '../reportFiles'
import ImagePreview from './ImagePreview'

function ImagePreviewList({ items, onRemove, onClearAll, disabled }) {
  if (!items || items.length === 0) {
    return null
  }

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)

  return (
    <div className="scanora-file-list">
      <div className="flex items-center justify-between gap-2">
        <p className="scanora-file-list-label">
          Selected files ({items.length}) · {formatFileSize(totalBytes)} total
        </p>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          className="scanora-clear-files scanora-focus-ring"
        >
          Clear
        </button>
      </div>
      <ul className="scanora-file-chips" aria-label="Selected report files">
        {items.map((item) => (
          <ImagePreview key={item.id} item={item} onRemove={onRemove} disabled={disabled} />
        ))}
      </ul>
    </div>
  )
}

export default ImagePreviewList