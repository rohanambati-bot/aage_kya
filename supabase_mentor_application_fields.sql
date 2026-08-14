-- ============================================================
-- Aage Kya? — Mentor application fields migration
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
--
-- Adds the columns the "Become a Mentor" form (MentorApplication.jsx)
-- and the /api/mentors/apply endpoint send. Without these, inserts fail
-- with "Could not find the '<column>' column of 'mentor_applications'".
-- ============================================================

ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS profession       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS stream_category  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS experience_years INT  NOT NULL DEFAULT 0;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS linkedin         TEXT NOT NULL DEFAULT '';
-- Reason shown to the applicant when an admin rejects their application.
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

-- The newer application form sends stream_category / profession instead of the
-- original college / degree / stream_transition, so relax those NOT NULLs.
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN college DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN college SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN degree DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN degree SET DEFAULT '';

-- mentors table needs the LinkedIn URL carried over on approval.
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS linkedin TEXT NOT NULL DEFAULT '';

-- ============================================================
-- Ask Mentor messaging table (fixes: "Could not find the table
-- 'public.mentor_messages' in the schema cache")
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id     UUID        NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  contact_name  TEXT        NOT NULL DEFAULT '',
  contact_email TEXT        NOT NULL DEFAULT '',
  subject       TEXT        NOT NULL DEFAULT '',
  category      TEXT        NOT NULL DEFAULT '',
  question      TEXT        NOT NULL,
  reply         TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  replied_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_student ON public.mentor_messages (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_mentor  ON public.mentor_messages (mentor_id, created_at DESC);

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_messages_student_insert" ON public.mentor_messages;
CREATE POLICY "mentor_messages_student_insert"
  ON public.mentor_messages FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "mentor_messages_student_read" ON public.mentor_messages;
CREATE POLICY "mentor_messages_student_read"
  ON public.mentor_messages FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "mentor_messages_mentor_read" ON public.mentor_messages;
CREATE POLICY "mentor_messages_mentor_read"
  ON public.mentor_messages FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

DROP POLICY IF EXISTS "mentor_messages_mentor_update" ON public.mentor_messages;
CREATE POLICY "mentor_messages_mentor_update"
  ON public.mentor_messages FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- Refresh PostgREST's schema cache so the new table is visible immediately.
NOTIFY pgrst, 'reload schema';
