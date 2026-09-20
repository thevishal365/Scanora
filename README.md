# Scanora

> A minimal AI-powered tool for understanding medical report images.

Scanora lets users upload one or multiple medical report images and uses Google Gemini to identify attention-worthy findings, explain them simply, and answer questions about the uploaded reports.

## Features

- Multiple medical report file uploads (up to 10 files and 30 MB total, 10 MB per file)
- JPG, JPEG, PNG, and PDF support
- Multiple files per upload
- Direct Gemini image analysis
- Staged analysis progress without percentages
- Results overview: reviewed, need attention, no attention flag, unable to evaluate
- Attention-worthy findings only
- Detailed attention findings with per-finding "Ask about this" chat prompts
- Reference-range based filtering when ranges are present in the report
- Report-specific AI chat
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
Google Gemini image analysis
        ↓
Attention-worthy findings
        ↓
Scanora result screen
        ↓
Report-specific chat
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
│   │   ├── App.jsx
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
  Handles Google Gemini image analysis and report-grounded chat.

- `analysis_schema.py`
  Defines and validates the structured analysis response.

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

The result is filtered to show only findings that are supported by the uploaded report, such as values outside a reference range or findings explicitly flagged by the report.

Expensive endpoints are rate-limited per client IP (10 analyses and 30 chat messages per 60 seconds); excess requests receive HTTP 429. These are in-process limits for a single backend instance — use gateway-level limiting if replicas are added.

### Report Chat

`POST /api/chat`

Provides a chat experience about the current uploaded report context.

Chat requests carry a short-lived server-signed analysis identity instead of client-supplied report data.

The chat is session-only and is not stored permanently.

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

It does not provide a medical diagnosis or treatment.

The AI should not:

- invent report values or reference ranges
- diagnose medical conditions
- prescribe medication
- recommend changing medication
- present unsupported findings as facts

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

Backend tests cover upload validation (extensions, MIME types, magic bytes, per-file/total/count limits), the `/api/analyze` endpoint, mixed JPG/PNG/PDF requests, rate limiting, chat provenance and error mapping, tolerant analysis-schema validation, source provenance, and prompt-boundary configuration. A Gemini PDF integration test is included and skipped unless `GEMINI_API_KEY` and `GEMINI_MODEL` are set (run it explicitly with the integration marker).

### Frontend

```powershell
cd frontend
npm test
```

Frontend tests use Vitest and cover file-selection validation, including format acceptance, 10 MB exact-boundary checks, magic-byte mismatch rejection, and mixed-format multi-file selections, as well as reference-range and qualitative result parsing, result partitioning and provenance grouping, analysis/chat concurrency guards, staged progress, results-overview counts, chat storage binding, and error-message handling.

## Live Application

[scanora-ai.netlify.app](https://scanora-ai.netlify.app/)

## Project Status

Scanora is a student-built AI medical report understanding project focused on a simple upload, analysis, and report-chat experience.

## License

License information will be added later.
