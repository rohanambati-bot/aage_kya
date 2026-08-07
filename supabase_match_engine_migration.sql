-- ============================================================
-- Aage Kya? — Local Match Engine Schema Migration (Part A2 / Database)
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
-- ============================================================

-- ─── 1. Extend students table for fine-grained location matching ──────────────
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS district  TEXT    NOT NULL DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS latitude  NUMERIC;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- ─── 2. Extend colleges table for match scoring & classification ──────────────
-- Location coordinates (for haversine distance matching)
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS latitude  NUMERIC;
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Intake capacity (NULLABLE — no default 0 so unrecorded colleges are 'unknown', not 'small')
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS intake_capacity INTEGER;

-- Placement rate (percentage 0-100 for outcomeSignal computation)
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS placement_rate NUMERIC;

-- Interest tags (array of domain slugs for streamFit vector matching)
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS interest_tags TEXT[] NOT NULL DEFAULT '{}';

-- Fast GIN index on interest tags
CREATE INDEX IF NOT EXISTS idx_colleges_interest_tags ON public.colleges USING GIN (interest_tags);

NOTIFY pgrst, 'reload schema';
