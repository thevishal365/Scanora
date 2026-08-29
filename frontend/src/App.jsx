import { useEffect, useRef, useState } from 'react'
import AnalysisResultView from './components/AnalysisResultView'
import Disclaimer from './components/Disclaimer'
import ImagePreviewList from './components/ImagePreviewList'
import PageFooter from './components/PageFooter'
import PrivacyNote from './components/PrivacyNote'
import ScanoraBrand from './components/ScanoraBrand'
import UploadArea from './components/UploadArea'
import { formatFileSize, splitReportFiles } from './reportFiles'

const FILE_INPUT_ID = 'report-images'
const FILE_ERROR_ID = 'report-images-error'

function App() {
  const [selectedItems, setSelectedItems] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState('idle')
  const [analysis, setAnalysis] = useState(null)
  const selectedItemsRef = useRef(selectedItems)
  const isBusy = status === 'uploading'

  selectedItemsRef.current = selectedItems

  useEffect(() => {
    return () => {
      selectedItemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [])

  function clearSelectedFiles() {
    selectedItemsRef.current.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl)
    })
    setSelectedItems([])
  }

  function addFiles(fileList) {
    if (!fileList || fileList.length === 0) {
      return
    }

    const { accepted, errors } = splitReportFiles(fileList)

    if (accepted.length > 0) {
      const newItems = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        sizeLabel: formatFileSize(file.size),
      }))
      setSelectedItems((current) => [...current, ...newItems])
      setStatus('idle')
    }

    setErrorMessage(errors[0] || '')
  }

  function removeItem(id) {
    setSelectedItems((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) {
        URL.revokeObjectURL(item.previewUrl)
      }
      return current.filter((entry) => entry.id !== id)
    })
    setStatus('idle')
  }

  function startOver() {
    clearSelectedFiles()
    setAnalysis(null)
    setStatus('idle')
    setErrorMessage('')
  }

  function messageFromResponse(data, fallback) {
    if (data && typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail
    }
    return fallback
  }

  async function handleAnalyze() {
    if (isBusy) {
      return
    }

    if (selectedItems.length === 0) {
      setStatus('error')
      setErrorMessage('Choose at least one report image before analyzing.')
      return
    }

    const formData = new FormData()
    selectedItems.forEach((item) => {
      formData.append('files', item.file)
    })

    setErrorMessage('')
    setStatus('uploading')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        setStatus('error')
        if (response.status === 413) {
          setErrorMessage('Each image must be 10 MB or smaller.')
          return
        }
        if ([429, 502, 503, 504].includes(response.status)) {
          setErrorMessage(
            messageFromResponse(
              data,
              'Scanora could not finish analyzing these reports. Please try again.',
            ),
          )
          return
        }
        setErrorMessage(
          messageFromResponse(
            data,
            'Your reports could not be analyzed. Please try again.',
          ),
        )
        return
      }

      if (!data || data.success !== true || !data.analysis) {
        setStatus('error')
        setErrorMessage('Your reports could not be analyzed. Please try again.')
        return
      }

      setAnalysis(data.analysis)
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage(
        'Scanora could not reach the server. Make sure the backend is running and try again.',
      )
    }
  }

  const showResults = analysis && status === 'success'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-6 sm:px-6 sm:pt-10 sm:pb-8">
      <header className="flex justify-center">
        <ScanoraBrand />
      </header>
      <h1 className="font-heading mx-auto mt-6 max-w-lg text-center text-2xl font-semibold tracking-tight text-scanora-text sm:text-3xl">
        Understand Your Reports, Simply.
      </h1>
      {!showResults && (
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed font-normal text-scanora-muted sm:text-base">
          Upload your medical reports to understand them in simpler language.
        </p>
      )}

      {showResults ? (
        <AnalysisResultView analysis={analysis} onStartOver={startOver} />
      ) : (
        <div className="mx-auto mt-8 w-full max-w-xl">
          <UploadArea
            inputId={FILE_INPUT_ID}
            errorId={FILE_ERROR_ID}
            errorMessage={errorMessage}
            isDragging={isDragging}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              addFiles(event.dataTransfer.files)
            }}
            onFilesChosen={addFiles}
          />

          <ImagePreviewList items={selectedItems} onRemove={removeItem} />

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isBusy}
            aria-busy={isBusy}
            className="mt-5 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-scanora-primary px-4 font-heading text-base font-semibold text-white transition-colors duration-200 hover:bg-cyan-700 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scanora-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-scanora-primary"
          >
            {isBusy ? (
              <>
                Analyzing your reports
                <span className="analyzing-dots" aria-hidden="true" />
              </>
            ) : (
              'Analyze Reports'
            )}
          </button>

          <PrivacyNote />
        </div>
      )}

      <Disclaimer />
      <PageFooter />
    </main>
  )
}

export default App
