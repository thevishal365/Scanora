import { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES } from '../reportFiles'

function UploadArea({
  inputId,
  errorId,
  errors,
  isDragging,
  disabled,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilesChosen,
}) {
  const maxSizeLabel = `${MAX_FILE_BYTES / (1024 * 1024)} MB`
  const totalSizeLabel = `${MAX_TOTAL_BYTES / (1024 * 1024)} MB`
  const hasErrors = errors && errors.length > 0

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={inputId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-disabled={disabled ? true : undefined}
        className={`scanora-dropzone group relative flex flex-col items-center justify-center gap-4 border text-center transition-colors duration-180 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-scanora-primary ${
          disabled
            ? 'cursor-default border-dashed border-scanora-border bg-scanora-surface-muted opacity-60'
            : isDragging
              ? 'cursor-pointer border-2 border-dashed border-scanora-primary bg-scanora-surface-muted shadow-xs'
              : 'cursor-pointer border-dashed border-scanora-border bg-scanora-surface hover:border-scanora-border-strong hover:bg-scanora-surface-subtle'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          multiple
          disabled={disabled}
          className="sr-only"
          aria-invalid={hasErrors ? true : undefined}
          aria-describedby={`${inputId}-hint ${errorId}`}
          onChange={(event) => {
            onFilesChosen(event.target.files)
            event.target.value = ''
          }}
        />

        <div
          aria-hidden="true"
          className={`scanora-upload-glyph flex size-14 items-center justify-center rounded-full transition-colors duration-180 ${
            isDragging
              ? 'bg-scanora-primary text-white'
              : 'bg-scanora-surface-muted text-scanora-primary group-hover:bg-scanora-brand-soft'
          }`}
        >
          <svg
            className="size-7"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.75"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 18.5a4.5 4.5 0 01-.58-8.96A6 6 0 0118.6 8.6a5 5 0 01.4 9.9M12 21v-9m0 0-3.5 3.5M12 12l3.5 3.5"
            />
          </svg>
        </div>

        <div className="scanora-dropzone-copy flex flex-col items-center gap-2">
          <span className="scanora-dropzone-title font-heading font-semibold text-scanora-text">
            {disabled
              ? 'Analysis in progress…'
              : isDragging
                ? 'Drop report images or PDFs to attach'
                : 'Drag and drop your files here'}
          </span>
          <span className="scanora-supporting-copy text-scanora-muted">
            or{' '}
            <span className="font-medium text-scanora-primary underline decoration-scanora-primary/40 underline-offset-2 group-hover:decoration-scanora-primary">
              browse from your device
            </span>
          </span>
        </div>

        <span
          id={`${inputId}-hint`}
          className="scanora-dropzone-hint scanora-file-limit text-scanora-faint"
        >
          JPG, JPEG, PNG, or PDF · {maxSizeLabel} per file · {totalSizeLabel} total · Up to {MAX_FILES} files
        </span>
      </label>

      <div
        id={errorId}
        role="alert"
        className={
          hasErrors
            ? 'scanora-error flex flex-col gap-2 px-4 py-4 text-sm leading-relaxed'
            : 'sr-only'
        }
      >
        {errors.map((error, index) => (
          <p key={index} className="break-words">
            {error}
          </p>
        ))}
      </div>
    </div>
  )
}

export default UploadArea