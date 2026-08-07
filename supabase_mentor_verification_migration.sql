-- ============================================================
-- Aage Kya? — Mentor Verification & Role Integrity Migration
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- Add verification tracking columns to mentor_applications
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS verification_status          TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS verification_data            JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS verified_at                  TIMESTAMPTZ;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS verification_source          TEXT NOT NULL DEFAULT 'linkedin';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS linkedin_name_match_score   INT NOT NULL DEFAULT 0;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS approved_by                 UUID REFERENCES auth.users(id);
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS approved_at                 TIMESTAMPTZ;

-- Add verification tracking columns to mentors table
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS is_verified               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS verification_badge        TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS linkedin_name_match_score   INT NOT NULL DEFAULT 0;

-- Ensure role column on students has appropriate values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_role'
  ) THEN
    ALTER TABLE public.students 
      ADD CONSTRAINT chk_student_role 
      CHECK (role IN ('student', 'mentor', 'admin', 'guest', 'other'));
  END IF;
END $$;

-- Indexes for speedy admin searches and role lookups
CREATE INDEX IF NOT EXISTS idx_mentor_applications_verification ON public.mentor_applications (verification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_role ON public.students (role);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
