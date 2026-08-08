-- ============================================================
-- "Aage Kya?" V2 Architecture Migration (Phase 1 Transformation)
-- Run this script in the Supabase SQL Editor.
-- ============================================================

-- ─── 1. Sources & Evidence Provenance Layer ──────────────────
CREATE TABLE IF NOT EXISTS public.sources (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL UNIQUE,
  url            TEXT,
  source_type    TEXT        NOT NULL DEFAULT 'official_website', -- 'official_website' | 'govt_portal' | 'nirf' | 'counselling_data' | 'third_party'
  trust_level    TEXT        NOT NULL DEFAULT 'medium',           -- 'high' | 'medium' | 'low'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.source_snapshots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      UUID        NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  url            TEXT        NOT NULL,
  content_hash   TEXT,                                            -- SHA-256 hash for change detection
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  notes          TEXT        NOT NULL DEFAULT ''
);

-- ─── 2. Canonical Institutions & Campuses Layer ───────────────
CREATE TABLE IF NOT EXISTS public.institutions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL UNIQUE,
  short_name          TEXT        NOT NULL DEFAULT '',
  institution_type    TEXT        NOT NULL DEFAULT 'private',   -- 'central' | 'state' | 'private' | 'deemed'
  aishe_code          TEXT,
  ugc_id              TEXT,
  aicte_id            TEXT,
  official_domain     TEXT        NOT NULL DEFAULT '',
  national            BOOLEAN     NOT NULL DEFAULT false,       -- accepts students nationally
  verification_status TEXT        NOT NULL DEFAULT 'unverified',-- 'verified' | 'unverified' | 'needs_review'
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.institution_aliases (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  alias          TEXT        NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.campuses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  city           TEXT        NOT NULL,
  state          TEXT        NOT NULL,
  latitude       NUMERIC,
  longitude      NUMERIC,
  is_main_campus BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 3. Program Offerings (Recommendable Unit) ───────────────
CREATE TABLE IF NOT EXISTS public.program_offerings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id           UUID        NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  program_name        TEXT        NOT NULL,                      -- e.g. 'B.Tech Computer Science'
  degree_level        TEXT        NOT NULL DEFAULT 'UG',         -- 'UG' | 'PG' | 'Diploma'
  stream              TEXT        NOT NULL,                      -- 'Science (PCM)' | 'Science (PCB)' | 'Commerce' | 'Arts / Humanities'
  duration_years      NUMERIC     NOT NULL DEFAULT 4,
  yearly_tuition_min  INTEGER     NOT NULL DEFAULT 0,
  yearly_tuition_max  INTEGER     NOT NULL DEFAULT 0,
  hostel_cost_annual  INTEGER     NOT NULL DEFAULT 0,
  total_intake        INTEGER,
  min_marks           NUMERIC     NOT NULL DEFAULT 0,            -- approximate 12th cutoff %
  cutoff_rank         INTEGER,                                   -- exam cutoff rank if applicable
  entrance_exam       TEXT        NOT NULL DEFAULT '',           -- 'JEE Main', 'NEET', etc.
  source_snapshot_id  UUID        REFERENCES public.source_snapshots(id) ON DELETE SET NULL,
  verification_status TEXT        NOT NULL DEFAULT 'unverified',
  last_verified_at    TIMESTAMPTZ,
  next_review_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_program_stream ON public.program_offerings(stream);
CREATE INDEX IF NOT EXISTS idx_program_campus ON public.program_offerings(campus_id);

-- ─── 4. Normalized Scholarships & Cycles ───────────────────────
CREATE TABLE IF NOT EXISTS public.scholarship_schemes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL UNIQUE,
  provider       TEXT        NOT NULL,                          -- e.g. 'Government of India', 'Tata Trust'
  scheme_type    TEXT        NOT NULL DEFAULT 'central_govt',    -- 'central_govt' | 'state_govt' | 'private' | 'institutional'
  official_url   TEXT        NOT NULL DEFAULT '',
  description    TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.scholarship_portals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL UNIQUE,                   -- e.g. 'NSP', 'Buddy4Study'
  url            TEXT        NOT NULL,
  description    TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.scholarship_cycles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id           UUID        NOT NULL REFERENCES public.scholarship_schemes(id) ON DELETE CASCADE,
  academic_year       TEXT        NOT NULL DEFAULT '2026-27',
  portal_id           UUID        REFERENCES public.scholarship_portals(id) ON DELETE SET NULL,
  application_start   DATE,
  application_deadline DATE,
  award_amount_min    INTEGER     NOT NULL DEFAULT 0,
  award_amount_max    INTEGER     NOT NULL DEFAULT 0,
  income_limit_lakh   NUMERIC     NOT NULL DEFAULT 99,
  marks_requirement   NUMERIC     NOT NULL DEFAULT 0,
  eligible_streams    TEXT[]      NOT NULL DEFAULT '{}',
  eligible_states     TEXT[]      NOT NULL DEFAULT '{}',
  eligible_categories TEXT[]      NOT NULL DEFAULT '{}',
  degree_levels       TEXT[]      NOT NULL DEFAULT '{}',
  application_url     TEXT        NOT NULL DEFAULT '',
  documents_required  TEXT[]      NOT NULL DEFAULT '{}',
  renewal_conditions  TEXT        NOT NULL DEFAULT '',
  source_snapshot_id  UUID        REFERENCES public.source_snapshots(id) ON DELETE SET NULL,
  verification_status TEXT        NOT NULL DEFAULT 'unverified',
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(scheme_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_scholarship_cycles_streams ON public.scholarship_cycles USING GIN (eligible_streams);

-- ─── 5. Audit Logging Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID,
  actor_email    TEXT,
  action         TEXT        NOT NULL,
  entity_type    TEXT,
  entity_id      UUID,
  old_value      JSONB,
  new_value      JSONB,
  reason         TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ─── 6. Row Level Security for New Tables ─────────────────────
ALTER TABLE public.sources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campuses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_offerings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_cycles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- Public Read for Reference Data
CREATE POLICY "sources_public_read"             ON public.sources             FOR SELECT USING (true);
CREATE POLICY "source_snapshots_public_read"    ON public.source_snapshots    FOR SELECT USING (true);
CREATE POLICY "institutions_public_read"        ON public.institutions        FOR SELECT USING (true);
CREATE POLICY "institution_aliases_public_read" ON public.institution_aliases FOR SELECT USING (true);
CREATE POLICY "campuses_public_read"            ON public.campuses            FOR SELECT USING (true);
CREATE POLICY "program_offerings_public_read"   ON public.program_offerings   FOR SELECT USING (true);
CREATE POLICY "scholarship_schemes_public_read" ON public.scholarship_schemes FOR SELECT USING (true);
CREATE POLICY "scholarship_portals_public_read" ON public.scholarship_portals FOR SELECT USING (true);
CREATE POLICY "scholarship_cycles_public_read"  ON public.scholarship_cycles  FOR SELECT USING (true);
