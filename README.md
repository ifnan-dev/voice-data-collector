# Afaan Oromo Speech Data Collection App

A mobile application for collecting Afaan Oromo speech recordings and their corresponding transcriptions. Each recording and transcription is stored together as a single database record with a unique identifier and audio file path.

## Stack

- **Mobile:** React Native + Expo (SDK 58) + TypeScript
- **Audio:** `expo-audio` (recording & playback)
- **Backend:** Python + FastAPI
- **Database:** Supabase PostgreSQL
- **Audio storage:** Supabase Storage (private bucket, included in Supabase Spark plan — no credit card needed)
- **Transcription:** Manual only (no auto-transcription)

## Project structure

```
Afan-oromo-dataset/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py               # FastAPI app + CORS
│   │   ├── core/config.py        # Pydantic settings (.env)
│   │   ├── models/schemas.py     # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── storage.py        # Supabase Storage client (replaces Cloudflare R2)
│   │   │   └── database.py       # Supabase PostgreSQL client
│   │   ├── api/
│   │   │   ├── routes.py         # /api/recordings, /api/recordings/{id}, ...
│   │   │   └── deps.py           # Service singletons
│   │   └── ...
│   ├── requirements.txt
│   └── .env.example
├── mobile/               # Expo React Native app
│   ├── App.tsx
│   ├── src/
│   │   ├── components/   # Button, TimerDisplay, AudioPlayer, TranscriptionEditor
│   │   ├── hooks/        # useRecorder, usePlayback (expo-audio)
│   │   ├── navigation/   # RootNavigator, param types
│   │   ├── screens/      # RecordCollect, TextCollect, TranscribeAudio, RecordFromText, RecordingsList, RecordingDetails
│   │   ├── services/     # api.ts (axios client), audio.ts (permissions)
│   │   ├── store/        # pendingStore (local pending recordings/texts)
│   │   └── types.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── sql/
│   └── 001_create_speech_records.sql   # Supabase table + RLS + storage bucket notes
├── README.md
└── .gitignore
```

## Database setup (Supabase)

### 1. Create a Supabase project

Go to https://app.supabase.com, create a new project (free Spark plan — no credit card required).

### 2. Create the database table

Run `sql/001_create_speech_records.sql` in the Supabase SQL Editor. It:

1. Enables `pgcrypto` (for `gen_random_uuid()`).
2. Creates the `speech_records` table.
3. Adds an index on `created_at`.
4. Enables Row Level Security with public read and service-role insert policies.

### 3. Create the Supabase Storage bucket

Go to **Storage → New Bucket** in the Supabase Dashboard:
- Name: `speech-recordings`
- Public: **OFF** (private bucket)
- File size limit: 50 MB (or your preferred limit)

The bucket name must match `SUPABASE_STORAGE_BUCKET` in `backend/.env`.

### 4. Get your credentials

Go to **Settings → API** and copy:
- Project URL → `SUPABASE_URL`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## Backend setup

1. Copy `backend/.env.example` to `backend/.env` and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Required (keep secret, backend only):

- `SUPABASE_URL` — Supabase project URL (`https://<project-ref>.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase elevated key. Use either the legacy `service_role` JWT key or a new `sb_secret_...` secret key. Both bypass Row Level Security and must stay backend-only.
- `SUPABASE_STORAGE_BUCKET` — name of your private Supabase Storage bucket (e.g. `speech-recordings`).

2. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

3. Run:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### No automatic transcription

This app does **not** perform automatic transcription. The `/api/transcribe` endpoint and Whisper integration have been removed. Users manually type transcriptions before saving.

## Mobile setup

1. Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_URL` to your backend:

```bash
cp mobile/.env.example mobile/.env
```

For local testing: `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000`
For physical device: use your computer's LAN IP (e.g. `http://192.168.1.42:8000`)

2. Install dependencies:

```bash
cd mobile
npm install
```

3. Run:

```bash
npx expo start
```

Press `a` for Android emulator, or scan with Expo Go on a device.

> **Note:** `expo-audio` has native code. For a physical device you need a development build (`npx expo run:android` or EAS). Expo Go includes only bundled native modules; audio recording may require a dev build.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/recordings` | POST | Upload audio to Supabase Storage + save metadata and manual transcription to Supabase |
| `/api/recordings` | GET | List saved recordings (newest first) |
| `/api/recordings/{id}` | GET | Get a single recording |
| `/api/recordings/{id}/audio` | GET | Temporary signed URL for private Supabase Storage audio playback |
| `/health` | GET | Supabase Storage + Supabase DB connectivity |
| `/` | GET | Service info |

All secret credentials (Supabase service-role key) live **only** on the backend. The mobile app never sees them.

## Save-recording workflow

1. The backend generates a UUID server-side.
2. Audio is uploaded to Supabase Storage at `recordings/<uuid>.<ext>`.
3. The same UUID + object path and the user's manual transcription are inserted into Supabase in one row.
4. On Storage upload failure the error is surfaced and the local temp file is preserved.
5. On Supabase insert failure the just-uploaded Storage object is deleted to avoid orphans, and the error is surfaced.

## Interchangeable workflow (recording + transcription both optional)

1. **Audio → Text:** Record audio as many times as you like on "Record Audio". Each recording goes into a local pending list. Later, pick a recording, type the Afaan Oromo transcription manually (or leave blank), and save.
2. **Text → Audio:** Write sentences on "Write Text". Pick a sentence, record audio for it, and save. The sentence is pre-filled as the transcription and can be edited.

Pending recordings and texts are kept locally until you explicitly save a paired audio+text to the database. Nothing is saved unless you press "Save Recording".

## License

MIT
