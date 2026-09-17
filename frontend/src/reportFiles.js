export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf']

const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]

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

function isAllowedType(type) {
  return (
    type === '' ||
    type === 'image/jpeg' ||
    type === 'image/png' ||
    type === 'application/pdf'
  )
}

function rejectionReason(file) {
  const extension = fileExtension(file.name)

  if (extension === '.docx' || extension === '.doc') {
    return 'Word documents are not supported. Please use JPG, JPEG, PNG, or PDF.'
  }
  if (extension === '.txt') {
    return 'Text files are not supported. Please use JPG, JPEG, PNG, or PDF.'
  }
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return 'This file type is not supported. Please use JPG, JPEG, PNG, or PDF.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'This file is too large. Each file must be 10 MB or smaller.'
  }
  if (!isAllowedType(file.type)) {
    return 'The detected file type does not match a supported format.'
  }
  return 'This file could not be added.'
}

function matchesMagic(bytes, magic) {
  if (!bytes || bytes.length < magic.length) {
    return false
  }
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) {
      return false
    }
  }
  return true
}

async function hasMatchingSignature(file, extension) {
  try {
    const buffer = await file.slice(0, 8).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (extension === '.pdf') {
      return matchesMagic(bytes, PDF_MAGIC)
    }
    if (extension === '.png') {
      return matchesMagic(bytes, PNG_MAGIC)
    }
    return matchesMagic(bytes, JPEG_MAGIC)
  } catch {
    return false
  }
}

function magicMismatchReason(extension) {
  if (extension === '.pdf') {
    return 'This file is not a valid PDF document.'
  }
  return 'This file is not a valid JPG, JPEG, or PNG image.'
}

export async function splitReportFiles(fileList) {
  const accepted = []
  const errors = []

  for (const file of fileList) {
    const extension = fileExtension(file.name)

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push({ file: file.name, reason: rejectionReason(file) })
      continue
    }

    if (file.size > MAX_FILE_BYTES) {
      errors.push({ file: file.name, reason: rejectionReason(file) })
      continue
    }

    if (!isAllowedType(file.type)) {
      errors.push({ file: file.name, reason: rejectionReason(file) })
      continue
    }

    const signatureOk = await hasMatchingSignature(file, extension)
    if (!signatureOk) {
      errors.push({ file: file.name, reason: magicMismatchReason(extension) })
      continue
    }

    accepted.push(file)
  }

  return { accepted, errors }
}