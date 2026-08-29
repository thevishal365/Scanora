import ImagePreview from './ImagePreview'

function ImagePreviewList({ items, onRemove }) {
  if (items.length === 0) {
    return null
  }

  const countLabel =
    items.length === 1 ? '1 report selected' : `${items.length} reports selected`

  return (
    <section className="mt-2" aria-label="Selected reports">
      <h2 className="font-heading text-sm font-semibold text-scanora-text">
        {countLabel}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <ImagePreview key={item.id} item={item} onRemove={onRemove} />
        ))}
      </ul>
    </section>
  )
}

export default ImagePreviewList
