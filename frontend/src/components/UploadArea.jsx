import { MAX_FILE_BYTES } from '../reportFiles'

function UploadArea({
  inputId,
  errorId,
  errors,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilesChosen,
}) {
  const maxSizeLabel = `${MAX_FILE_BYTES / (1024 * 1024)} MB`
  const hasErrors = errors && errors.length > 0

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex min-h-[176px] cursor-pointer flex-col items-center justify-center rounded-lg border px-5 py-6 text-center transition-all duration-180 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-scanora-primary sm:min-h-[190px] sm:py-7 ${
          isDragging
            ? 'border-2 border-dashed border-scanora-primary bg-scanora-surface-muted shadow-xs'
            : 'border-dashed border-scanora-border bg-scanora-surface hover:border-scanora-border-strong hover:bg-scanora-surface-subtle'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          multiple
          className="sr-only"
          aria-invalid={hasErrors ? true : undefined}
          aria-describedby={`${inputId}-hint ${errorId}`}
          onChange={(event) => {
            onFilesChosen(event.target.files)
            event.target.value = ''
          }}
        />

        {/* Clinical Document Lens Glyphs */}
        <div
          aria-hidden="true"
          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-180 sm:h-11 sm:w-11 ${
            isDragging
              ? 'bg-scanora-primary text-white'
              : 'bg-scanora-surface-muted text-scanora-primary group-hover:bg-scanora-brand-soft'
          }`}
        >
          <svg
            className="h-5 w-5 sm:h-5 sm:w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.75"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
            <circle cx="14" cy="14" r="3.5" strokeWidth="1.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5L19 19" strokeWidth="1.75" />
          </svg>
        </div>

        <span className="font-heading text-base font-semibold text-scanora-text sm:text-[17px]">
          {isDragging ? 'Drop report images or PDFs to attach' : 'Drop report images or PDFs here'}
        </span>

        <span className="mt-1 text-xs text-scanora-muted sm:text-sm">
          or{' '}
          <span className="font-medium text-scanora-primary underline decoration-scanora-primary/40 underline-offset-2 group-hover:decoration-scanora-primary">
            browse from your device
          </span>
        </span>

        <span
          id={`${inputId}-hint`}
          className="mt-3 text-[11px] leading-normal text-scanora-faint sm:text-xs"
        >
          JPG, JPEG, PNG, or PDF • Up to {maxSizeLabel} per file • Multiple files supported
        </span>
      </label>

      <div
        id={errorId}
        role="alert"
        className={
          hasErrors
            ? 'scanora-error mt-2.5 space-y-1 px-3 py-2 text-xs leading-relaxed sm:text-sm'
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