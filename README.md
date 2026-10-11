# BoloBuddy — AI Reading Fluency Coach

A child reads a short story aloud. BoloBuddy transcribes it with **Sarvam Saaras v4**, compares it word by word with the original text, estimates accuracy and words correct per minute (WCPM), reads words back with **Sarvam Bulbul v3**, writes an encouraging tutor message with **Sarvam-105B**, and offers translation and transliteration help through **Mayura** and Sarvam's transliteration API. Tricky words then feed into practice games, XP, streaks and a parent dashboard.

## Stack
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, Framer Motion, Recharts (`frontend/`)
- **Backend:** FastAPI, Pydantic, SQLite (`backend/`)
- **AI:** Sarvam speech-to-text, text-to-speech, chat, translation and transliteration, called only from the backend

## Run locally
```bash
# 1. Secrets
cp .env.example .env        # then put your SARVAM_API_KEY in .env

# 2. Backend (http://localhost:8000)
cd backend
python -m venv .venv
.venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload

# 3. Frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```
Without a key, the app runs in **demo mode**: results are clearly labelled as mock data, and the tutor uses the browser's built-in voice.

## Tests
```bash
cd backend && .venv\Scripts\python -m pytest -q          # 23 tests
cd backend && .venv\Scripts\python scripts/smoke_live.py # live Sarvam check (needs key)
```

## Flow
```
Child reads aloud → MediaRecorder (browser, ≤30 s)
  → POST /api/v1/sessions/assess (FastAPI: validate type/size/duration)
  → Saaras v4 speech-to-text (verbatim mode, keyterms = target words)
  → assessment_engine: normalise → align words → correct / skipped / different / uncertain
  → metrics: accuracy %, WCPM, confidence gate (low confidence = no skill penalty)
  → adaptive_learning: update skill mastery + review schedule
  → gamification: idempotent XP, quests, badges
  → Sarvam-105B tutor message (from structured results only) → Bulbul voice
  → Results screen → Practice arena → Progress / Parent dashboard
```

## Known limits
- Uses SQLite and a learner ID stored in the browser instead of Supabase Auth and row-level security.
- Sound-by-sound (phoneme) scoring is not implemented; `phoneme_assessment.py` is an adapter for a future validated model.
- Recordings over 30 seconds would need Sarvam's batch API, which is not wired in.
- All scores are automated estimates, not validated assessments.
