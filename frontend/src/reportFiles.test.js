import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  splitReportFiles,
} from './reportFiles'

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00]
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PDF_BYTES = Array.from('%PDF-', (char) => char.charCodeAt(0))
const TEXT_BYTES = Array.from('hello world', (char) => char.charCodeAt(0))

function makeFile(bytes, name, type) {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('splitReportFiles', () => {
  it('accepts a valid .jpg', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(JPEG_BYTES, 'cbc.jpg', 'image/jpeg'),
    ])
    expect(accepted).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('accepts a valid .jpeg', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(JPEG_BYTES, 'cbc.jpeg', 'image/jpeg'),
    ])
    expect(accepted).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('accepts a valid .png', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(PNG_BYTES, 'cbc.png', 'image/png'),
    ])
    expect(accepted).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('accepts a valid .pdf', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(PDF_BYTES, 'report.pdf', 'application/pdf'),
    ])
    expect(accepted).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('rejects png bytes renamed as .jpg', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(PNG_BYTES, 'fake.jpg', 'image/jpeg'),
    ])
    expect(accepted).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].file).toBe('fake.jpg')
    expect(errors[0].reason).toMatch(/not a valid JPG/)
  })

  it('rejects jpeg bytes renamed as .pdf', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(JPEG_BYTES, 'fake.pdf', 'application/pdf'),
    ])
    expect(accepted).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].file).toBe('fake.pdf')
    expect(errors[0].reason).toMatch(/not a valid PDF/)
  })

  it('rejects text bytes with a .pdf extension', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(TEXT_BYTES, 'fake.pdf', 'application/pdf'),
    ])
    expect(accepted).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].file).toBe('fake.pdf')
    expect(errors[0].reason).toMatch(/not a valid PDF/)
  })

  it('rejects unsupported .docx files', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(TEXT_BYTES, 'notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ])
    expect(accepted).toHaveLength(0)
    expect(errors[0].reason).toMatch(/Word documents are not supported/)
  })

  it('rejects unsupported .txt files', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(TEXT_BYTES, 'notes.txt', 'text/plain'),
    ])
    expect(accepted).toHaveLength(0)
    expect(errors[0].reason).toMatch(/Text files are not supported/)
  })

  it('accepts a file that is exactly 10 MB', async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES)
    bytes.set(PDF_BYTES)
    const file = new File([bytes], 'exact.pdf', { type: 'application/pdf' })
    expect(file.size).toBe(MAX_FILE_BYTES)

    const { accepted, errors } = await splitReportFiles([file])
    expect(accepted).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('rejects a .pdf file that is 10 MB plus one byte', async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES + 1)
    bytes.set(PDF_BYTES)
    const file = new File([bytes], 'too-big.pdf', { type: 'application/pdf' })
    expect(file.size).toBe(MAX_FILE_BYTES + 1)

    const { accepted, errors } = await splitReportFiles([file])
    expect(accepted).toHaveLength(0)
    expect(errors[0].file).toBe('too-big.pdf')
    expect(errors[0].reason).toMatch(/too large/)
  })

  it('rejects a .jpg file that is 10 MB plus one byte', async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES + 1)
    bytes.set(JPEG_BYTES)
    const file = new File([bytes], 'too-big.jpg', { type: 'image/jpeg' })
    expect(file.size).toBe(MAX_FILE_BYTES + 1)

    const { accepted, errors } = await splitReportFiles([file])
    expect(accepted).toHaveLength(0)
    expect(errors[0].file).toBe('too-big.jpg')
    expect(errors[0].reason).toMatch(/too large/)
  })

  it('accepts jpg + png + pdf in the same request', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(JPEG_BYTES, 'a.jpg', 'image/jpeg'),
      makeFile(PNG_BYTES, 'b.png', 'image/png'),
      makeFile(PDF_BYTES, 'c.pdf', 'application/pdf'),
    ])
    expect(accepted).toHaveLength(3)
    expect(errors).toHaveLength(0)
  })

  it('accepts valid files and reports every rejected file with its reason', async () => {
    const { accepted, errors } = await splitReportFiles([
      makeFile(JPEG_BYTES, 'good.jpg', 'image/jpeg'),
      makeFile(TEXT_BYTES, 'bad.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      makeFile(TEXT_BYTES, 'worse.pdf', 'application/pdf'),
    ])
    expect(accepted).toHaveLength(1)
    expect(errors).toHaveLength(2)
    expect(errors[0].file).toBe('bad.docx')
    expect(errors[1].file).toBe('worse.pdf')
  })

  it('continues to expose the allowed formats', () => {
    expect(ALLOWED_EXTENSIONS).toContain('.jpg')
    expect(ALLOWED_EXTENSIONS).toContain('.jpeg')
    expect(ALLOWED_EXTENSIONS).toContain('.png')
    expect(ALLOWED_EXTENSIONS).toContain('.pdf')
  })
})