# Afaan Oromo Speech Data Collection App

A mobile application for collecting Afaan Oromo speech recordings and their corresponding transcriptions. Each recording and transcription is stored together as a single database record with a unique identifier and audio file path.

## Stack

- **Mobile:** React Native + Expo (SDK 58) + TypeScript
- **Audio:** `expo-audio` (recording & playback)
- **Backend:** Python + FastAPI
- **Database:** Supabase PostgreSQL
- **Audio storage:** Cloudflare R2 (S3-compatible object storage; private bucket with presigned playback URLs)
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
│   │   │   ├── storage.py        # Cloudflare R2 (S3-compatible) storage client
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
│   └── 001_create_speech_records.sql   # Supabase table + RLS (audio lives in R2)
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

### 3. Create the Cloudflare R2 bucket

In the Cloudflare dashboard go to **R2 → Create bucket**:
- Name: `speech-recordings`
- Location: automatic
- Access: **private** (the backend generates short-lived presigned URLs for playback)

Then create an **R2 API token** (R2 → Manage API Tokens → Create) with **Object Read & Write** permission and copy:
- Account ID → `R2_ACCOUNT_ID`
- Access Key ID → `R2_ACCESS_KEY_ID`
- Secret Access Key → `R2_SECRET_ACCESS_KEY`

The bucket name must match `R2_BUCKET_NAME` in `backend/.env`. For a public bucket, set `R2_PUBLIC_BASE_URL` to its public URL (e.g. `https://pub-xxx.r2.dev`) to skip presigning.

### 4. Get your Supabase credentials

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
- `R2_ACCOUNT_ID` — Cloudflare account ID.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — R2 API token credentials (Object Read & Write).
- `R2_BUCKET_NAME` — R2 bucket for audio (e.g. `speech-recordings`).
- `R2_PUBLIC_BASE_URL` — optional; public base URL for a public bucket (leave empty for private + presigned URLs).

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
| `/api/recordings` | POST | Upload audio to Cloudflare R2 + save metadata and manual transcription to Supabase |
| `/api/recordings` | GET | List saved recordings (newest first) |
| `/api/recordings/{id}` | GET | Get a single recording |
| `/api/recordings/{id}/audio` | GET | Temporary signed URL for private Cloudflare R2 audio playback |
| `/health` | GET | Cloudflare R2 + Supabase DB connectivity |
| `/` | GET | Service info |

All secret credentials (Supabase service-role key, R2 token) live **only** on the backend. The mobile app never sees them.

## Audio format (lossless WAV)

Every take is stored as an uncompressed **16-bit PCM WAV** (mono, 16 kHz):

- **Android / iOS:** audio is captured straight from the microphone as PCM through `expo-audio`'s `useAudioStream` (`encoding: "int16"`, `format: "wav"`). No AAC/Opus encoder is involved, so the samples are bit-exact and can be re-encoded later without compounding quality loss.
- **Web:** browsers cannot capture PCM (`MediaRecorder` only offers Opus). The highest-bitrate Opus is recorded and decoded to a standard PCM WAV file on stop (`src/services/wav.ts`).
- **Never lost:** a finished take is written to the app's document directory (`recordings/`) and copied there by `preserveTake` as soon as recording stops, so it survives app restarts and later takes reusing the recorder's temp path.
- Uploads use the file's real extension and `Content-Type` (`audio/wav`), and the backend stores the object with the matching content type. `.wav` is first in `allowed_audio_extensions`.

Because the format is uncompressed, size is roughly **32 KB per second** (~1.9 MB per minute). Keep `max_upload_size_mb` in mind for long takes.

## Save-recording workflow

1. The backend generates a UUID server-side.
2. Audio is uploaded to Cloudflare R2 at `recordings/<uuid>.<ext>`.
3. The same UUID + object path and the user's manual transcription are inserted into Supabase in one row.
4. On R2 upload failure the error is surfaced and the local temp file is preserved.
5. On Supabase insert failure the just-uploaded R2 object is deleted to avoid orphans, and the error is surfaced.

## Interchangeable workflow (recording + transcription both optional)

1. **Audio → Text:** Record audio as many times as you like on "Record Audio". Each recording goes into a local pending list. Later, pick a recording, type the Afaan Oromo transcription manually (or leave blank), and save.
2. **Text → Audio:** Write sentences on "Write Text". Pick a sentence, record audio for it, and save. The sentence is pre-filled as the transcription and can be edited.

Pending recordings and texts are kept locally until you explicitly save a paired audio+text to the database. Nothing is saved unless you press "Save Recording".

## License

MIT
