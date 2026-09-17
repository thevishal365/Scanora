# Scanora

> A minimal AI-powered tool for understanding medical report images.

Scanora lets users upload one or multiple medical report images and uses Google Gemini to identify attention-worthy findings, explain them simply, and answer questions about the uploaded reports.

## Features

- Multiple medical report file uploads
- JPG, JPEG, PNG, and PDF support
- Multiple files per upload
- Direct Gemini image analysis
- Attention-worthy findings only
- Reference-range based filtering when ranges are present in the report
- Report-specific AI chat
- Session-only report and chat context
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
│   │   └── analysis_schema.py
│   ├── main.py
│   ├── report_upload.py
│   ├── requirements.txt
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

Accepts one or multiple JPG/JPEG/PNG/PDF files (up to 10 MB each) and sends them to Gemini for direct analysis.

The result is filtered to show only findings that are supported by the uploaded report, such as values outside a reference range or findings explicitly flagged by the report.

### Report Chat

`POST /api/chat`

Provides a chat experience about the current uploaded report context.

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

Do not store secret values directly in the source code.

Do not commit `.env`.

## Privacy

Scanora does not require login or signup.

To analyze your reports, the uploaded files and analysis requests are transmitted to the Scanora backend and processed by the Google Gemini API. No data is permanently stored by Scanora.

After analysis:

- **Server-side**: Report files and chat context are used only for the current request and are not permanently stored by Scanora. There is no database, patient history, or saved-report system.
- **Browser-side**: Analysis results and chat history are temporarily stored in the browser's `sessionStorage` so a page refresh can recover the session. This data is scoped to the current tab session and is cleared when the browser session/tab ends.

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

Backend tests cover upload validation (extensions, MIME types, magic bytes, and the 10 MB per-file limit), the `/api/analyze` endpoint, and mixed JPG/PNG/PDF requests. A Gemini PDF integration test is included and skipped unless `GEMINI_API_KEY` and `GEMINI_MODEL` are set (run it explicitly with the integration marker).

### Frontend

```powershell
cd frontend
npm test
```

Frontend tests use Vitest and cover file-selection validation, including format acceptance, 10 MB exact-boundary checks, magic-byte mismatch rejection, and mixed-format multi-file selections.

## Live Application

[scanora-ai.netlify.app](https://scanora-ai.netlify.app/)

## Project Status

Scanora is a student-built AI medical report understanding project focused on a simple upload, analysis, and report-chat experience.

## License

License information will be added later.
