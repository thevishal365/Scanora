import { MAX_FILE_BYTES } from '../reportFiles'

function UploadArea({
  inputId,
  errorId,
  errorMessage,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilesChosen,
}) {
  const maxSizeLabel = `${MAX_FILE_BYTES / (1024 * 1024)} MB`

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors duration-200 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-scanora-primary ${
          isDragging
            ? 'border-scanora-primary bg-cyan-50'
            : 'border-scanora-border bg-white hover:border-scanora-primary'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          multiple
          className="sr-only"
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={`${inputId}-hint ${errorId}`}
          onChange={(event) => {
            onFilesChosen(event.target.files)
            event.target.value = ''
          }}
        />
        <span className="font-heading text-lg font-semibold text-scanora-text">
          {isDragging ? 'Drop images to add them' : 'Drop images here'}
        </span>
        <span className="mt-2 text-scanora-muted">
          or{' '}
          <span className="font-medium text-scanora-primary underline decoration-scanora-primary/40 underline-offset-2">
            browse files
          </span>
        </span>
        <span id={`${inputId}-hint`} className="mt-4 text-sm text-scanora-muted">
          JPG, JPEG, or PNG · up to {maxSizeLabel} each · multiple files allowed
        </span>
      </label>

      <p
        id={errorId}
        role="alert"
        className="mt-2 text-sm text-red-800"
      >
        {errorMessage}
      </p>
    </div>
  )
}

export default UploadArea
