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
- `TRANSCRIPTION_ENGINE` — `stub` (offline, no model download), `whisper` (faster-whisper), or `custom-asr` (future Afaan Oromo model).

2. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

3. Run:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Transcription engine (modular)

ASR is pluggable in `backend/app/services/transcription.py`:

- `ASREngine` — abstract interface (`transcribe(audio_path, language)`).
- `WhisperEngine` — faster-whisper (default when `TRANSCRIPTION_ENGINE=whisper`).
- `StubEngine` — deterministic placeholder (default for offline dev).
- `CustomAfarOromoEngine` — placeholder for a future custom Afaan Oromo ASR model.

To switch engines, change `TRANSCRIPTION_ENGINE` in `backend/.env`. No API or mobile changes needed.

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
| `/api/transcribe` | POST | Accept audio file + language, return transcription |
| `/api/recordings` | POST | Upload audio to R2 + save metadata/transcription to Supabase |
| `/api/recordings` | GET | List saved recordings (newest first) |
| `/api/recordings/{id}` | GET | Get a single recording |
| `/api/recordings/{id}/audio` | GET | Temporary signed URL for private R2 audio playback |
| `/health` | GET | R2 + Supabase connectivity |
| `/` | GET | Service info |

All secret credentials (R2 keys, Supabase service-role key) live **only** on the backend. The mobile app never sees them.

## Security

- R2 bucket is private; audio playback uses time-limited signed URLs.
- Supabase access uses the service-role key exclusively on the backend.
- Mobile app contains no secrets (`EXPO_PUBLIC_API_URL` is the only config).
- Audio uploads are validated for extension (`.wav .mp3 .m4a .ogg .webm`) and size (default 50 MB).
- Credentials and audio content are never logged.

## Save-recording workflow (verified)

1. Mobile generates no ID — the backend generates a UUID server-side.
2. Audio is uploaded to R2 at `recordings/<uuid>.<ext>`.
3. The same UUID + object path are inserted into Supabase in one row.
4. On R2 failure the error is surfaced and the local temp file is preserved.
5. On Supabase failure the just-uploaded R2 object is deleted to avoid orphans, and the error is surfaced.

## Audio format

Recordings use 16 kHz mono, suitable for speech recognition (Whisper resamples internally). Container is `.m4a`/AAC (cross-platform via `expo-audio`); the R2 object path matches the saved file extension.

## License

MIT
