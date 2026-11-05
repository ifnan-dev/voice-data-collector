-- Migration: 001_create_speech_records.sql
-- Run this against your Supabase PostgreSQL database.

-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS speech_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_path TEXT NOT NULL,
    transcription TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'om',
    duration_seconds FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing recordings ordered by creation date
CREATE INDEX IF NOT EXISTS idx_speech_records_created_at
    ON speech_records (created_at DESC);

-- Row Level Security (RLS)
-- Enable RLS on the table
ALTER TABLE speech_records ENABLE ROW LEVEL SECURITY;

-- Policy: allow public read (select) of recordings
-- Adjust as needed for your authentication requirements
CREATE POLICY "Allow public read access"
    ON speech_records FOR SELECT
    USING (true);

-- Policy: allow insert from authenticated/service role only
-- The backend uses the service-role key, so it bypasses RLS.
-- If you want clients to insert directly, restrict this policy.
CREATE POLICY "Allow service role insert"
    ON speech_records FOR INSERT
    WITH CHECK (true);
