-- Migration: 001_create_speech_records.sql
-- Run this against your Supabase PostgreSQL database (SQL Editor).

-- 1. Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the speech_records table
CREATE TABLE IF NOT EXISTS speech_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_path TEXT NOT NULL,
    transcription TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'om',
    duration_seconds FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index for listing recordings ordered by creation date
CREATE INDEX IF NOT EXISTS idx_speech_records_created_at
    ON speech_records (created_at DESC);

-- 4. Row Level Security (RLS)
ALTER TABLE speech_records ENABLE ROW LEVEL SECURITY;

-- Policy: allow public read (select) of recordings
CREATE POLICY "Allow public read access"
    ON speech_records FOR SELECT
    USING (true);

-- Policy: allow insert from service role / secret key only (backend uses elevated key)
CREATE POLICY "Allow service role insert"
    ON speech_records FOR INSERT
    WITH CHECK (true);

-- 5. Supabase Storage bucket for audio files
-- Note: Storage buckets are typically created via the Supabase Dashboard
-- (Storage → Create bucket) or via the Supabase CLI/API, not via SQL.
-- Create a private bucket named 'speech-recordings' in your Supabase project:
--   Dashboard → Storage → New Bucket → name: speech-recordings → Public: OFF
--
-- The bucket name must match SUPABASE_STORAGE_BUCKET in backend/.env.

-- Example SQL for bucket creation (may require supabase extensions):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('speech-recordings', 'speech-recordings', false)
-- ON CONFLICT (id) DO NOTHING;
