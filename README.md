# Scanora

> A minimal AI-powered tool for understanding medical report images.

Scanora lets users upload one or multiple medical report images and uses Google Gemini to identify attention-worthy findings, explain them simply, and answer questions about the uploaded reports.

## Features

- Multiple medical report image uploads
- JPG, JPEG, and PNG support
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

The backend handles image uploads, Gemini analysis, report-specific chat, validation, and temporary request processing.

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

Accepts one or multiple JPG/JPEG/PNG images and sends them to Gemini for direct image analysis.

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

Uploaded reports and chat context are used for the current analysis session and are not permanently stored by Scanora.

There is no database, patient history, or saved-report system.

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
- uploaded report images
- report history
- chat history

Temporary processing data is cleaned up after requests where applicable.

## Live Application

[scanora.netlify.app](https://scanora.netlify.app)

## Project Status

Scanora is a student-built AI medical report understanding project focused on a simple upload, analysis, and report-chat experience.

## License

License information will be added later.
