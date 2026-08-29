export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png']

export function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtension(name) {
  const dot = name.lastIndexOf('.')
  if (dot < 0) {
    return ''
  }
  return name.slice(dot).toLowerCase()
}

function rejectionMessage(file) {
  const extension = fileExtension(file.name)

  if (extension === '.pdf') {
    return 'PDF files are not supported. Please upload JPG, JPEG, or PNG images.'
  }
  if (extension === '.docx' || extension === '.doc') {
    return 'Word documents are not supported. Please upload JPG, JPEG, or PNG images.'
  }
  if (extension === '.txt') {
    return 'Text files are not supported. Please upload JPG, JPEG, or PNG images.'
  }
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `${file.name} is not a supported format. Please use JPG, JPEG, or PNG.`
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is too large. Each image must be 10 MB or smaller.`
  }
  return `${file.name} could not be added.`
}

export function splitReportFiles(fileList) {
  const accepted = []
  const errors = []

  for (const file of fileList) {
    const extension = fileExtension(file.name)
    const typeLooksOk =
      file.type === '' ||
      file.type === 'image/jpeg' ||
      file.type === 'image/png'

    if (
      ALLOWED_EXTENSIONS.includes(extension) &&
      typeLooksOk &&
      file.size <= MAX_FILE_BYTES
    ) {
      accepted.push(file)
    } else {
      errors.push(rejectionMessage(file))
    }
  }

  return { accepted, errors }
}
