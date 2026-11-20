import { useEffect, useReducer, useRef, useState } from 'react'
import AnalysisResultView from './components/AnalysisResultView'
import AnalysisProgress from './components/AnalysisProgress'
import ImagePreviewList from './components/ImagePreviewList'
import PageFooter from './components/PageFooter'
import ReportChat from './components/ReportChat'
import { CHAT_STORAGE_KEY, clearStoredChat } from './chatStorage'
import ScanoraBrand from './components/ScanoraBrand'
import UploadArea from './components/UploadArea'
import { messageFromResponse } from './errors'
import { apiUrl, getAnalysisStatus } from './api'
import { formatFileSize, splitReportFiles } from './reportFiles'
import { canMutateFiles, createRunScope } from './runScope'
import { APP_ACTIONS, APP_STATES, appStateReducer } from './appState'

const FILE_INPUT_ID = 'report-images'
const FILE_ERROR_ID = 'report-images-error'
const SESSION_KEY = 'scanora:session'
const ANALYSIS_POLL_INTERVAL_MS = 1000

function waitForNextPoll() {
  return new Promise((resolve) => setTimeout(resolve, ANALYSIS_POLL_INTERVAL_MS))
}

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
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false)
  const [fileErrors, setFileErrors] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [appState, dispatch] = useReducer(
    appStateReducer,
    null,
    () => {
      const saved = readSession()
      return saved && saved.status === APP_STATES.SUCCESS
        ? APP_STATES.SUCCESS
        : APP_STATES.IDLE
    },
  )
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
  const analysisScopeRef = useRef(null)
  const disclaimerDialogRef = useRef(null)
  const shouldFocusUploadRef = useRef(false)
  if (analysisScopeRef.current === null) {
    analysisScopeRef.current = createRunScope()
  }
  const isAnalyzing = appState === APP_STATES.ANALYZING

  useEffect(() => {
    if (shouldFocusUploadRef.current && appState === APP_STATES.IDLE) {
      document.getElementById('upload-heading')?.focus()
      shouldFocusUploadRef.current = false
    }
  }, [appState])

  useEffect(() => {
    const dialog = disclaimerDialogRef.current
    if (!dialog) {
      return
    }

    if (showDisclaimerModal && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
      dialog.querySelector('.scanora-disclaimer-close')?.focus()
    } else if (!showDisclaimerModal && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [showDisclaimerModal])

  useEffect(() => {
    return () => {
      analysisScopeRef.current.cancel()
    }
  }, [])

  useEffect(() => {
    try {
      if (appState === APP_STATES.SUCCESS && analysis) {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ analysis, analysis_id: analysisId, status: appState }),
        )
      } else if (appState === APP_STATES.IDLE) {
        sessionStorage.removeItem(SESSION_KEY)
      }
    } catch {
      // Storage may be unavailable; persistence is best-effort.
    }
  }, [analysis, analysisId, appState])

  function clearSelectedFiles(options) {
    // startOver() forces through; every UI affordance is blocked mid-flight.
    if (!options?.force && !canMutateFiles(appState)) {
      return
    }
    setSelectedItems([])
  }

  async function addFiles(fileList) {
    if (!canMutateFiles(appState)) {
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
        sizeLabel: formatFileSize(file.size),
      }))
      setSelectedItems((current) => [...current, ...newItems])
      if (appState === APP_STATES.SUCCESS) {
        clearStoredSession()
        setAnalysis(null)
        setAnalysisId(null)
      }
      dispatch({ type: APP_ACTIONS.FILES_CHANGED })
    }

    setErrorMessage('')
    setFileErrors(errors.map((entry) => `${entry.file}: ${entry.reason}`))
  }

  function removeItem(id) {
    if (!canMutateFiles(appState)) {
      return
    }
    setSelectedItems((current) => {
      return current.filter((entry) => entry.id !== id)
    })
    dispatch({ type: APP_ACTIONS.FILES_CHANGED })
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
    dispatch({ type: APP_ACTIONS.RESET_SCAN })
    setErrorMessage('')
    setFileErrors([])
    shouldFocusUploadRef.current = true
  }

  function stopAnalysis() {
    analysisScopeRef.current.cancel()
    dispatch({ type: APP_ACTIONS.STOP_ANALYSIS })
    setErrorMessage('')
  }

  async function handleAnalyze() {
    if (isAnalyzing) {
      return
    }

    if (selectedItems.length === 0) {
      dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
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
    dispatch({ type: APP_ACTIONS.START_ANALYSIS })

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
        dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
        setErrorMessage(
          messageFromResponse(
            response,
            data,
            'Your reports could not be analyzed. Please try again.',
          ),
        )
        return
      }

      if (
        !data ||
        data.status !== 'processing' ||
        typeof data.task_id !== 'string' ||
        !data.task_id
      ) {
        dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
        setErrorMessage('Your reports could not be analyzed. Please try again.')
        return
      }

      let result = null
      while (isRunCurrent()) {
        const statusResponse = await getAnalysisStatus(data.task_id, run.signal)
        let task = null
        try {
          task = await statusResponse.json()
        } catch {
          task = null
        }

        if (!isRunCurrent()) {
          return
        }
        if (!statusResponse.ok) {
          dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
          setErrorMessage(
            messageFromResponse(
              statusResponse,
              task,
              'Your reports could not be analyzed. Please try again.',
            ),
          )
          return
        }
        if (task?.status === 'processing') {
          await waitForNextPoll()
          continue
        }
        if (task?.status === 'failed') {
          dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
          setErrorMessage(
            typeof task.error === 'string'
              ? task.error
              : 'Your reports could not be analyzed. Please try again.',
          )
          return
        }
        if (
          task?.status !== 'completed' ||
          task.success !== true ||
          !task.analysis ||
          typeof task.analysis_id !== 'string' ||
          !task.analysis_id
        ) {
          dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
          setErrorMessage('Your reports could not be analyzed. Please try again.')
          return
        }
        result = task
        break
      }

      if (!isRunCurrent() || !result) {
        return
      }

      try {
        // Drop any legacy unbound chat history; new chats bind to analysis_id.
        sessionStorage.removeItem(CHAT_STORAGE_KEY)
      } catch {
        // Persistence is best-effort.
      }
      setAnalysis(result.analysis)
      setAnalysisId(result.analysis_id)
      dispatch({ type: APP_ACTIONS.FINISH_ANALYSIS })
    } catch (err) {
      if (!isRunCurrent()) {
        return
      }
      if (err && err.name === 'AbortError') {
        // Cancelled via startOver(), which already reset state to idle.
        return
      }
      dispatch({ type: APP_ACTIONS.ANALYSIS_FAILED })
      setErrorMessage(
        'Scanora could not reach the server. Make sure the backend is running and try again.',
      )
    }
  }

  const activeErrors =
    appState === APP_STATES.ERROR && errorMessage ? [errorMessage] : fileErrors
  const activeSession =
    isAnalyzing || (appState === APP_STATES.SUCCESS && Boolean(analysis))
  const submittedFiles = selectedItems.length
    ? selectedItems.map((item) => item.file.name)
    : analysis?.reports?.map((report) => report.source_label).filter(Boolean) || []

  return (
    <main
      className={`scanora-page ${activeSession ? 'scanora-page-active' : 'scanora-page-landing'}`}
    >
      <header className="scanora-header">
        <div className="scanora-header-inner">
          <ScanoraBrand />
          <div className="scanora-header-actions">
            {!activeSession && (
              <span className="scanora-session-badge">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="5.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 4.8V8l2.1 1.3" />
                </svg>
                Session only
              </span>
            )}
            {activeSession && (
              <button
                type="button"
                onClick={startOver}
                className="scanora-new-scan scanora-focus-ring"
              >
                New Scan
              </button>
            )}
          </div>
        </div>
      </header>

      {activeSession ? (
        <section className="scanora-thread" aria-label="Report analysis conversation">
          {submittedFiles.length > 0 && (
            <div className="scanora-user-turn">
              <span className="scanora-turn-label">Your reports</span>
              <ul>
                {submittedFiles.map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          {isAnalyzing ? (
            <>
              <AnalysisProgress />
              <ReportChat
                key="analysis-pending"
                isAnalysisBusy
                onAttachFiles={addFiles}
                onStopAnalysis={stopAnalysis}
              />
            </>
          ) : (
            <>
              <AnalysisResultView
                analysis={analysis}
                analysisId={analysisId}
                onAttachFiles={addFiles}
                attachmentErrors={fileErrors}
                onOpenDisclaimer={() => setShowDisclaimerModal(true)}
              />
            </>
          )}
        </section>
      ) : (
        <section className="scanora-landing">
          <div className="scanora-hero">
            <p className="scanora-hero-badge">
              <span className="scanora-hero-indicator" aria-hidden="true" />
              AI Report Analyzer
            </p>
            <h1 id="upload-heading" tabIndex={-1} className="scanora-page-title">
              Understand Your Reports, <span className="scanora-accent-italic">Simply.</span>
            </h1>
            <p className="scanora-hero-copy">
              We help simplify medical information so you can better understand what your reports are telling you.
            </p>

            <ul className="scanora-reassurance" aria-label="Scanora benefits">
              <li>
                <span className="scanora-check-badge">
                  <svg className="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="6" fill="var(--color-scanora-brand)" />
                    <path d="M3.5 6l1.75 1.75L8.5 4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Clear explanations
              </li>
              <li>
                <span className="scanora-check-badge">
                  <svg className="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="6" fill="var(--color-scanora-brand)" />
                    <path d="M3.5 6l1.75 1.75L8.5 4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Session-based
              </li>
              <li>
                <span className="scanora-check-badge">
                  <svg className="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="6" fill="var(--color-scanora-brand)" />
                    <path d="M3.5 6l1.75 1.75L8.5 4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                No account needed
              </li>
            </ul>

            <section className="scanora-upload-card" aria-label="Upload your reports">
              <UploadArea
                inputId={FILE_INPUT_ID}
                errorId={FILE_ERROR_ID}
                errors={activeErrors}
                isDragging={isDragging}
                disabled={isAnalyzing}
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
                disabled={isAnalyzing}
              />

              <button
                type="button"
                onClick={() => {
                  if (selectedItems.length === 0) {
                    document.getElementById(FILE_INPUT_ID)?.click()
                    return
                  }
                  handleAnalyze()
                }}
                disabled={isAnalyzing}
                aria-busy={isAnalyzing}
                className="scanora-upload-submit scanora-focus-ring"
              >
                {selectedItems.length === 0 ? 'Select Files to Analyze' : 'Analyze Reports'}
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M3.5 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="scanora-upload-next">
                Get a plain-language summary, flagged values, and follow-up Q&amp;A.
              </p>
            </section>
          </div>
          <PageFooter onOpenDisclaimer={() => setShowDisclaimerModal(true)} />
        </section>
      )}
      <dialog
        ref={disclaimerDialogRef}
        id="medical-disclaimer-dialog"
        className="scanora-disclaimer-dialog"
        aria-labelledby="medical-disclaimer-title"
        aria-describedby="medical-disclaimer-copy"
        aria-modal="true"
        onCancel={() => setShowDisclaimerModal(false)}
        onClose={() => setShowDisclaimerModal(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setShowDisclaimerModal(false)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setShowDisclaimerModal(false)
          }
        }}
      >
        <section className="scanora-disclaimer-card">
          <div className="scanora-disclaimer-header">
            <span className="scanora-disclaimer-eyebrow">Medical Disclaimer</span>
            <button
              type="button"
              className="scanora-disclaimer-close scanora-focus-ring"
              aria-label="Close medical disclaimer"
              onClick={() => setShowDisclaimerModal(false)}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h2 id="medical-disclaimer-title" className="scanora-disclaimer-title">
            For educational use — always consult your doctor.
          </h2>
          <p id="medical-disclaimer-copy" className="scanora-disclaimer-copy">
            Scanora is an educational reading aid designed to help explain lab reports and
            biomarker values in plain language. It does not provide medical diagnoses,
            treatment plans, or professional medical evaluations. For health decisions or
            concerns about your results, please consult a qualified physician.
          </p>
          <button
            type="button"
            className="scanora-disclaimer-confirm scanora-focus-ring"
            onClick={() => setShowDisclaimerModal(false)}
          >
            Got it
          </button>
        </section>
      </dialog>
    </main>
  )
}

export default App