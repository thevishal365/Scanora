import { useEffect, useRef, useState } from 'react'
import AnalysisResultView from './components/AnalysisResultView'
import AnalysisProgress from './components/AnalysisProgress'
import Disclaimer from './components/Disclaimer'
import ImagePreviewList from './components/ImagePreviewList'
import PageFooter from './components/PageFooter'
import PrivacyNote from './components/PrivacyNote'
import { CHAT_STORAGE_KEY, clearStoredChat } from './components/ReportChat'
import ScanoraBrand from './components/ScanoraBrand'
import UploadArea from './components/UploadArea'
import { messageFromResponse } from './errors'
import { apiUrl } from './api'
import { formatFileSize, splitReportFiles } from './reportFiles'
import { canMutateFiles, createRunScope } from './runScope'

const FILE_INPUT_ID = 'report-images'
const FILE_ERROR_ID = 'report-images-error'
const SESSION_KEY = 'scanora:session'

function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    return saved && typeof saved === 'object' ? saved : null
  } catch {
    return null
  }
}

function App() {
  const [selectedItems, setSelectedItems] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [fileErrors, setFileErrors] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState(() => {
    const saved = readSession()
    return saved && saved.status === 'success' ? 'success' : 'idle'
  })
  const [analysis, setAnalysis] = useState(() => {
    const saved = readSession()
    return saved && saved.analysis ? saved.analysis : null
  })
  const [analysisId, setAnalysisId] = useState(() => {
    const saved = readSession()
    return saved && typeof saved.analysis_id === 'string'
      ? saved.analysis_id
      : null
  })
  const selectedItemsRef = useRef(selectedItems)
  const analysisScopeRef = useRef(null)
  if (analysisScopeRef.current === null) {
    analysisScopeRef.current = createRunScope()
  }
  const isBusy = status === 'uploading'

  useEffect(() => {
    selectedItemsRef.current = selectedItems
  }, [selectedItems])

  useEffect(() => {
    return () => {
      analysisScopeRef.current.cancel()
      selectedItemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    try {
      if (status === 'success' && analysis) {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ analysis, analysis_id: analysisId, status }),
        )
      } else if (status === 'idle') {
        sessionStorage.removeItem(SESSION_KEY)
      }
    } catch {
      // Storage may be unavailable; persistence is best-effort.
    }
  }, [analysis, analysisId, status])

  function clearSelectedFiles(options) {
    // startOver() forces through; every UI affordance is blocked mid-flight.
    if (!options?.force && !canMutateFiles(status)) {
      return
    }
    selectedItems.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl)
    })
    setSelectedItems([])
  }

  async function addFiles(fileList) {
    if (!canMutateFiles(status)) {
      return
    }
    if (!fileList || fileList.length === 0) {
      return
    }

    const alreadySelected = {
      count: selectedItems.length,
      bytes: selectedItems.reduce((sum, item) => sum + item.file.size, 0),
    }
    const { accepted, errors } = await splitReportFiles(fileList, alreadySelected)

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

    setErrorMessage('')
    setFileErrors(errors.map((entry) => `${entry.file}: ${entry.reason}`))
  }

  function removeItem(id) {
    if (!canMutateFiles(status)) {
      return
    }
    setSelectedItems((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) {
        URL.revokeObjectURL(item.previewUrl)
      }
      return current.filter((entry) => entry.id !== id)
    })
    setStatus('idle')
  }

  function clearStoredSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY)
      // Legacy un-namespaced key plus the key bound to this analysis.
      sessionStorage.removeItem(CHAT_STORAGE_KEY)
      clearStoredChat(analysisId)
    } catch {
      // Ignore storage errors during reset.
    }
  }

  function startOver() {
    analysisScopeRef.current.cancel()
    clearStoredSession()
    clearSelectedFiles({ force: true })
    setAnalysis(null)
    setAnalysisId(null)
    setStatus('idle')
    setErrorMessage('')
    setFileErrors([])
    // The upload heading is always mounted, so it can take focus immediately.
    document.getElementById('upload-heading')?.focus()
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

    const run = analysisScopeRef.current.begin()
    const isRunCurrent = () => analysisScopeRef.current.isCurrent(run.id)

    setErrorMessage('')
    setStatus('uploading')

    try {
      const response = await fetch(apiUrl('/api/analyze'), {
        method: 'POST',
        body: formData,
        signal: run.signal,
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      // A superseded or cancelled run must never touch state.
      if (!isRunCurrent()) {
        return
      }

      if (!response.ok) {
        setStatus('error')
        setErrorMessage(
          messageFromResponse(
            response,
            data,
            'Your reports could not be analyzed. Please try again.',
          ),
        )
        return
      }

      if (!data || data.success !== true || !data.analysis || typeof data.analysis_id !== 'string' || !data.analysis_id) {
        setStatus('error')
        setErrorMessage('Your reports could not be analyzed. Please try again.')
        return
      }

      try {
        // Drop any legacy unbound chat history; new chats bind to analysis_id.
        sessionStorage.removeItem(CHAT_STORAGE_KEY)
      } catch {
        // Persistence is best-effort.
      }
      setAnalysis(data.analysis)
      setAnalysisId(data.analysis_id)
      setStatus('success')
    } catch (err) {
      if (!isRunCurrent()) {
        return
      }
      if (err && err.name === 'AbortError') {
        // Cancelled via startOver(), which already reset state to idle.
        return
      }
      setStatus('error')
      setErrorMessage(
        'Scanora could not reach the server. Make sure the backend is running and try again.',
      )
    }
  }

  const showResults = analysis && status === 'success'
  const activeErrors =
    status === 'error' && errorMessage ? [errorMessage] : fileErrors

  return (
    <main className="scanora-page">
      <div className="scanora-content">
        {/* Top brand header bar */}
        <header className="flex items-center justify-between border-b border-scanora-border-subtle pb-3.5">
          <ScanoraBrand />
          <div className="flex items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-scanora-border-subtle bg-scanora-surface px-2.5 py-0.5 text-[11px] font-medium text-scanora-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-scanora-primary" aria-hidden="true" />
              Session Only
            </span>
          </div>
        </header>

        {/* Hero title & editorial lead */}
        <div className="mx-auto mt-6 max-w-xl text-center sm:mt-8">
          <p className="scanora-kicker">Clinical Document Assistant</p>
          <h1 id="upload-heading" tabIndex={-1} className="font-heading mx-auto mt-2 text-2xl font-semibold leading-tight text-scanora-text outline-none sm:text-[28px]">
            Understand Your Reports, Simply.
          </h1>
          {!showResults && (
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-scanora-muted sm:text-sm">
              Upload diagnostic or lab report files. Scanora highlights attention-worthy values and explains findings in clear, non-diagnostic terms.
            </p>
          )}
        </div>

        {/* Main Work Area */}
        {showResults ? (
          <AnalysisResultView
            analysis={analysis}
            analysisId={analysisId}
            onStartOver={startOver}
          />
        ) : (
          <div className="mx-auto mt-5 w-full sm:mt-6">
            <UploadArea
              inputId={FILE_INPUT_ID}
              errorId={FILE_ERROR_ID}
              errors={activeErrors}
              isDragging={isDragging}
              disabled={isBusy}
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

            <ImagePreviewList
              items={selectedItems}
              onRemove={removeItem}
              onClearAll={() => clearSelectedFiles()}
              disabled={isBusy}
            />

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isBusy}
              aria-busy={isBusy}
              className="scanora-button-primary scanora-focus-ring mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2"
            >
              {isBusy ? (
                <>
                  <span>Analyzing your reports</span>
                  <span className="analyzing-dots" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Analyze Reports</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>

            {isBusy && <AnalysisProgress />}

            <PrivacyNote />
          </div>
        )}

        <Disclaimer />
        <PageFooter />
      </div>
    </main>
  )
}

export default App