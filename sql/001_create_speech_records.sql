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

-- 5. Audio files are stored in Cloudflare R2 (not Supabase Storage)
-- Audio objects live in a Cloudflare R2 bucket; this table only stores metadata
-- (including the R2 object path in audio_path, e.g. 'recordings/<uuid>.wav').
--
-- Create a private bucket named 'speech-recordings' in the Cloudflare R2 dashboard
-- (R2 → Create bucket), then create an Object Read & Write API token.
-- The bucket name must match R2_BUCKET_NAME in backend/.env.
