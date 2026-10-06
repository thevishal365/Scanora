# Scanora

> A minimal AI-powered tool for understanding medical report images.

Scanora lets users upload one or multiple medical report images and uses Google Gemini to analyze them. The frontend surfaces attention-worthy findings using the existing report-value and reference-range logic, while chat explains the report and answers general educational questions.

## Features

- Multiple medical report file uploads (up to 10 files and 30 MB total, 10 MB per file)
- JPG, JPEG, PNG, and PDF support
- Multiple files per upload
- Direct Gemini analysis of uploaded images and PDFs
- Staged analysis progress without percentages
- Attention-first results with finding values, units, available reference ranges, and relevant context
- Normal/within-range findings are not shown individually in the primary results view; the former results overview/statistics dashboard is no longer the main UI
- Finding-specific "Ask about this" prompts and contextual suggested questions
- Suggested questions fill the composer but are not sent until the user chooses to send
- Frontend attention classification based on available reference ranges and explicit report flags
- Report chat for explaining findings and answering general educational medical questions
- Clear distinction between report-supported facts, general education, and possible explanations not confirmed for the user
- Concise medical safety reminder with every assistant answer
- Calm Clinical Editorial visual design with responsive layouts, shared 48px-minimum action controls, and a circular 48px mobile chat-send button
- Clear, actionable error messages
- Session-only report and chat context
- Start-over reset flow with session recovery through sessionStorage
- No login or signup required
- No database or patient history
- No permanent report storage
- Minimal and responsive interface
- Custom Scanora lens favicon and branding

## How It Works

```text
Medical report images
        ↓
FastAPI backend
        ↓
Google Gemini structured analysis
        ↓
Frontend attention classification (`needsAttention.js`)
        ↓
Attention-worthy findings
        ↓
Scanora result screen
        ↓
Finding-specific questions and report chat
        ↓
Report explanations and general medical education
```

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS

### Backend

- Python
- FastAPI
- Google GenAI SDK
- Google Gemini API

## Project Structure

```text
Scanora/
├── backend/
│   ├── services/
│   │   ├── gemini_service.py
│   │   ├── analysis_schema.py
│   │   └── analysis_token.py
│   ├── main.py
│   ├── report_upload.py
│   ├── requirements.txt
│   ├── tests/
│   └── .venv/
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalysisResultView.jsx
│   │   │   └── ReportChat.jsx
│   │   ├── App.jsx
│   │   ├── askAboutFinding.js
│   │   ├── needsAttention.js
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── .env
├── .env.example
├── .gitignore
└── README.md
```

## Backend

The backend handles file uploads, Gemini analysis, report-specific chat, validation, and temporary request processing.

### Main Services

- `gemini_service.py`
  Handles Google Gemini image analysis, report and general educational chat, and transient-error retries.

- `analysis_schema.py`
  Defines and validates the structured analysis response and chat safety instructions.

- `report_upload.py`
  Handles report-image validation and upload-related errors.

- `main.py`
  Provides the FastAPI API endpoints.

### API Endpoints

```text
POST /api/analyze
POST /api/chat
GET  /api/health
```

### Analyze Reports

`POST /api/analyze`

Accepts one or multiple JPG/JPEG/PNG/PDF files (up to 10 MB each, up to 10 files and 30 MB total per request) and sends them to Gemini for direct analysis.

Gemini returns a structured analysis of information in the uploaded report, including reported values and explicit flags where available.

The backend returns the structured report analysis and preserves each report's source identity. The frontend's existing `needsAttention.js` logic classifies values using the available reference range or explicit report flags. The main results view displays only attention-worthy findings; normal/within-range values and overview statistics are not the primary results experience.

Expensive endpoints are rate-limited per client IP (10 analyses and 30 chat messages per 60 seconds); excess requests receive HTTP 429. These are in-process limits for a single backend instance — use gateway-level limiting if replicas are added.

Transient Gemini errors are retried at most once, so a single analysis or chat action makes at most two Gemini requests. Provider HTTP 503 / `UNAVAILABLE` errors are reported as temporary service unavailability. Quota/rate-limit, authentication, malformed-request, and invalid-model-response errors have distinct handling.

### Report Chat

`POST /api/chat`

Provides a chat experience about the current uploaded report context and general educational medical information. "Ask about this" includes the finding's name, value, unit, and available reference range in the composer; contextual suggestions do the same. Neither the prefilled question nor a suggested question is sent automatically.

Chat distinguishes facts supported by the uploaded report from general education and possible explanations that are not confirmed for the user. It must not diagnose, determine a cause with certainty, prescribe treatment, or present possibilities as confirmed facts. Every assistant answer is accompanied by a concise medical safety reminder.

Chat requests carry a short-lived server-signed analysis identity instead of client-supplied report data.

The existing report provenance, signed analysis identity, chat request, and session-storage architecture remain in place. Chat is session-only and is not stored permanently.

## Configuration

The backend uses environment variables for Gemini configuration.

Required variables:

```text
GEMINI_API_KEY
GEMINI_MODEL
```

Example:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=your_model_name
```

Optional variables:

```text
SCANORA_SESSION_SECRET
VITE_API_BASE_URL
```

`SCANORA_SESSION_SECRET` signs short-lived chat identities. It falls back to a key derived from `GEMINI_API_KEY` when unset, but set it explicitly in production, especially with multiple backend workers. `VITE_API_BASE_URL` sets the FastAPI backend address for production frontend builds; leave it unset for local development so requests use the Vite `/api` proxy.

Do not store secret values directly in the source code.

Do not commit `.env`.

## Privacy

Scanora does not require login or signup.

To analyze your reports, the uploaded files and analysis requests are transmitted to the Scanora backend and processed by the Google Gemini API. No data is permanently stored by Scanora.

In short, your reports travel: browser → Scanora backend → Google Gemini for processing. Scanora itself keeps no database, patient history, or saved-report system.

After analysis:

- **Server-side**: Report files and chat context are used only for the current request and are not permanently stored by Scanora. There is no database, patient history, or saved-report system.
- **Browser-side**: Analysis results and chat history are temporarily stored in the browser's `sessionStorage` so a page refresh can recover the session. This data is scoped to the current tab session and is cleared when the browser session/tab ends.
- **Google-side processing**: Report content and derived analysis are processed by Google Gemini under Google's terms and policies. Scanora does not control how Google processes or retains data submitted to its API, so Scanora makes no claim that uploaded content is never retained anywhere — only that Scanora itself does not permanently store it.

## Medical Safety

Scanora is designed to help users understand and summarize information shown in medical reports.

It provides educational explanations, not a medical diagnosis or treatment recommendation. Assistant answers include a reminder to discuss results with a qualified healthcare professional.

The AI should not:

- invent report values or reference ranges
- diagnose medical conditions
- determine the cause of an abnormal result from the report alone
- prescribe medication
- recommend changing medication
- present general possibilities as confirmed facts or overstate certainty
- confuse report-supported facts with general educational information or unconfirmed possibilities

## Development

### Requirements

- Node.js
- npm
- Python
- A Gemini API key

### Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Install Backend Dependencies

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Start the Backend

```bash
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

### Start the Frontend

```bash
cd frontend
npm run dev
```

The Vite development server runs on the local development address shown by Vite, normally:

```text
http://localhost:5173
```

The FastAPI backend runs on:

```text
http://127.0.0.1:8000
```

## Data Handling

Scanora does not use a database.

It does not permanently save:

- patient information
- uploaded report files
- report history
- chat history

Temporary processing data is cleaned up after requests where applicable.

## Tests

### Backend

```powershell
python -m pytest backend/tests/ -v
```

Backend tests cover upload validation (extensions, MIME types, magic bytes, per-file/total/count limits), the `/api/analyze` endpoint, mixed JPG/PNG/PDF requests, rate limiting, chat provenance and error mapping, tolerant analysis-schema validation, source provenance, retry limits, and prompt-boundary configuration. A Gemini PDF integration test is marked `integration` and skipped when `GEMINI_API_KEY` or `GEMINI_MODEL` is unset. When both are configured, the full backend test command runs it and makes a Gemini request; select it explicitly with `-m integration` when desired.

### Frontend

```powershell
cd frontend
npm test
```

Frontend tests use Vitest and cover file-selection validation, including format acceptance, 10 MB exact-boundary checks, magic-byte mismatch rejection, and mixed-format multi-file selections, as well as reference-range and qualitative result parsing, attention-only results and the no-attention state, finding-specific chat prefill and suggestions, manual sending, per-answer safety reminders, provenance grouping, analysis/chat concurrency guards, staged progress, chat storage binding, and error-message handling.

### Frontend Lint and Production Build

```powershell
cd frontend
npm run lint
npm run build
```

## Live Application

[scanora-ai.netlify.app](https://scanora-ai.netlify.app/)

## Project Status

Scanora is a student-built AI medical report understanding project focused on a simple upload, analysis, and report-chat experience.

## License

License information will be added later.
