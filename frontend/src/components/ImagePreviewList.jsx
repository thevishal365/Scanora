import ImagePreview from './ImagePreview'

function ImagePreviewList({ items, onRemove }) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wider text-scanora-muted uppercase font-heading">
          Selected Reports ({items.length})
        </p>
      </div>
      <ul className="space-y-2.5" aria-label="Selected report images">
        {items.map((item) => (
          <ImagePreview key={item.id} item={item} onRemove={onRemove} />
        ))}
      </ul>
    </div>
  )
}

export default ImagePreviewList
