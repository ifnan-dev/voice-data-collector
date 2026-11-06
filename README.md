# Afaan Oromo Speech Data Collection App

A mobile application for collecting Afaan Oromo speech recordings and their corresponding transcriptions. Each recording and transcription is stored together as a single database record with a unique identifier and audio file path.

## Stack

- **Mobile:** React Native + Expo (SDK 58) + TypeScript
- **Audio:** `expo-audio` (recording & playback)
- **Backend:** Python + FastAPI
- **Database:** Supabase PostgreSQL
- **Audio storage:** Cloudflare R2 (S3-compatible, private bucket)
- **Transcription:** Whisper via `faster-whisper` (modular, replaceable ASR engine)

## Project structure

```
Afan-oromo-dataset/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py               # FastAPI app + CORS
│   │   ├── core/config.py        # Pydantic settings (.env)
│   │   ├── models/schemas.py     # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── transcription.py  # Pluggable ASR engine (whisper/stub/custom-asr)
│   │   │   ├── storage.py        # Cloudflare R2 (S3) client
│   │   │   └── database.py       # Supabase client
│   │   ├── api/
│   │   │   ├── routes.py         # /api/transcribe, /api/recordings, ...
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
│   │   ├── screens/      # RecordScreen, ReviewScreen, RecordingsListScreen, RecordingDetailsScreen
│   │   ├── services/     # api.ts (axios client), audio.ts (permissions)
│   │   └── types.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── sql/
│   └── 001_create_speech_records.sql   # Supabase table + RLS
├── README.md
└── .gitignore
```

## Database setup (Supabase)

Run `sql/001_create_speech_records.sql` against your Supabase PostgreSQL database. It:

1. Enables `pgcrypto` (for `gen_random_uuid()`).
2. Creates the `speech_records` table matching the required schema.
3. Adds an index on `created_at` for listing.
4. Enables Row Level Security with a public read policy and a service-role insert policy.

```sql
-- executed via the Supabase SQL Editor
\i sql/001_create_speech_records.sql
```

The `speech_records` table:

| Column | Type | Notes |
|---|---|---|
| id | UUID | PRIMARY KEY, `gen_random_uuid()` |
| audio_path | TEXT | R2 object path, e.g. `recordings/<uuid>.m4a` |
| transcription | TEXT | |
| language | VARCHAR(10) | default `'om'` (Afaan Oromo) |
| duration_seconds | FLOAT | |
| created_at | TIMESTAMPTZ | default NOW() |

## Backend setup

1. Copy `backend/.env.example` to `backend/.env` and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Required (keep secret, backend only):

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase project credentials (service-role key).
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — Cloudflare R2 (S3) credentials.
- `R2_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`
- `R2_BUCKET` — private R2 bucket name.

2. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

3. Run:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Transcription (manual only)

This app does **not** perform automatic transcription. No audio is transcribed by the system. The `/api/transcribe` endpoint and Whisper integration have been removed.

The app works interchangeably in two directions, and **both recording and transcription are optional**:

1. **Audio → Text:** Record audio as many times as you like on "Record Audio". Each recording goes into a local pending list (nothing is saved to the database yet). Later, pick a recording from the list, type the Afaan Oromo transcription manually (or leave it blank), and save. The audio is uploaded to R2 and a Supabase row is created with the same UUID.
2. **Text → Audio:** Write as many sentences as you like on "Write Text". Each sentence goes into a local pending list. Later, pick a sentence, record audio for it, and save. The sentence is used as the transcription and the audio is uploaded to R2.

Pending recordings and pending texts are kept locally until you explicitly save a paired audio+text to the database. Nothing is saved unless you press "Save Recording".

## Mobile setup

1. Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_URL` to your backend (e.g. `http://localhost:8000` for local dev via emulator, or your machine's LAN IP for a physical device).

```bash
cp mobile/.env.example mobile/.env
```

2. Install dependencies:

```bash
cd mobile
npm install
```

3. Run (Expo dev server):

```bash
npx expo start
```

Then press `a` for Android emulator / `i` for iOS simulator, or scan with the Expo Go app on a physical device.

> **Note:** `expo-audio` has native code. For a physical device you need a development build (`npx expo run:android` or EAS). Expo Go includes only the bundled native modules; audio recording may require a dev build depending on your Expo SDK version.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/recordings` | POST | Upload audio to R2 + save metadata and manual transcription to Supabase |
| `/api/recordings` | GET | List saved recordings (newest first) |
| `/api/recordings/{id}` | GET | Get a single recording |
| `/api/recordings/{id}/audio` | GET | Temporary signed URL for private R2 audio playback |
| `/health` | GET | R2 + Supabase connectivity |
| `/` | GET | Service info |

All secret credentials (R2 keys, Supabase service-role key) live **only** on the backend. The mobile app never sees them.

## Save-recording workflow

1. The backend generates a UUID server-side.
2. Audio is uploaded to R2 at `recordings/<uuid>.<ext>`.
3. The same UUID + object path and the user's manual transcription are inserted into Supabase in one row.
4. On R2 failure the error is surfaced and the local temp file is preserved.
5. On Supabase failure the just-uploaded R2 object is deleted to avoid orphans, and the error is surfaced.
