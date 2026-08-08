/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SCHOLARSHIP AUTO-MATCH API ROUTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  GET  /api/scholarships/match   — Auto-match scholarships for a student
 *  GET  /api/scholarships/v2      — List all V2 scholarship schemes + cycles
 */

import express from 'express'
import { supabase, isSupabaseConfigured } from '../utils/db.js'
import { matchScholarshipsForStudent } from '../engine/scholarshipMatcher.js'
import { calculateAffordability } from '../engine/affordabilityEngine.js'

const router = express.Router()

// GET /api/scholarships/match?marks=85&stream=Science+%28PCM%29&state=Karnataka&incomeRange=1L-3L
router.get('/api/scholarships/match', async (req, res) => {
  try {
    const studentProfile = {
      marks: req.query.marks ? Number(req.query.marks) : undefined,
      stream: req.query.stream || undefined,
      state: req.query.state || undefined,
      incomeRange: req.query.incomeRange || req.query.income_range || undefined,
    }

    // 1. Try V2 scholarship_cycles from Supabase
    let scholarshipsList = []
    if (isSupabaseConfigured()) {
      try {
        const { data: cycles } = await supabase
          .from('scholarship_cycles')
          .select(`
            *,
            scheme:scholarship_schemes (
              name,
              provider,
              scheme_type,
              official_url,
              description
            )
          `)
          .order('application_deadline', { ascending: true })

        if (cycles && cycles.length > 0) {
          scholarshipsList = cycles.map(c => ({
            id: c.id,
            name: c.scheme?.name || 'Unknown Scheme',
            provider: c.scheme?.provider || '',
            scheme_type: c.scheme?.scheme_type || 'central_govt',
            official_url: c.scheme?.official_url || '',
            description: c.scheme?.description || '',
            academic_year: c.academic_year,
            award_amount_min: c.award_amount_min,
            award_amount_max: c.award_amount_max,
            income_limit_lakh: c.income_limit_lakh,
            marks_requirement: c.marks_requirement,
            eligible_streams: c.eligible_streams,
            eligible_states: c.eligible_states,
            eligible_categories: c.eligible_categories,
            degree_levels: c.degree_levels,
            application_url: c.application_url,
            application_deadline: c.application_deadline,
            documents_required: c.documents_required,
            renewal_conditions: c.renewal_conditions,
            verification_status: c.verification_status,
          }))
        }
      } catch (_) {}

      // 2. Fallback to legacy scholarships table if V2 is empty
      if (scholarshipsList.length === 0) {
        try {
          const { data: legacyScholarships } = await supabase
            .from('scholarships')
            .select('*')
          if (legacyScholarships) {
            scholarshipsList = legacyScholarships.map(s => ({
              ...s,
              income_limit_lakh: s.eligibility_income_max_lakh,
              marks_requirement: s.eligibility_marks_min,
            }))
          }
        } catch (_) {}
      }
    }

    // 3. Run deterministic matching
    const matchResult = matchScholarshipsForStudent(studentProfile, scholarshipsList)

    res.json({
      success: true,
      data: {
        eligible: matchResult.eligible,
        potential: matchResult.potential,
        notEligible: matchResult.notEligible,
        totalScholarships: scholarshipsList.length,
        studentProfile,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    console.error('[ScholarshipMatch] error:', err.message)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' },
    })
  }
})

// GET /api/scholarships/v2 — List all V2 scholarship schemes
router.get('/api/scholarships/v2', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ success: true, data: { schemes: [], portals: [] } })
    }

    const [{ data: schemes }, { data: portals }] = await Promise.all([
      supabase.from('scholarship_schemes').select('*').order('name'),
      supabase.from('scholarship_portals').select('*').order('name'),
    ])

    res.json({
      success: true,
      data: { schemes: schemes || [], portals: portals || [] },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' },
    })
  }
})

// GET /api/affordability?marks=85&stream=...&state=...&incomeRange=...&programId=...
router.get('/api/affordability', async (req, res) => {
  try {
    const studentProfile = {
      marks: req.query.marks ? Number(req.query.marks) : undefined,
      stream: req.query.stream || undefined,
      state: req.query.state || undefined,
      incomeRange: req.query.incomeRange || req.query.income_range || undefined,
    }

    let program = {
      yearly_tuition_min: Number(req.query.tuitionMin || 50000),
      yearly_tuition_max: Number(req.query.tuitionMax || 150000),
      hostel_cost_annual: Number(req.query.hostelCost || 60000),
      duration_years: Number(req.query.duration || 4),
    }

    // If programId is provided, look up real program data
    if (req.query.programId && isSupabaseConfigured()) {
      try {
        const { data: progRow } = await supabase
          .from('program_offerings')
          .select('*')
          .eq('id', req.query.programId)
          .maybeSingle()
        if (progRow) program = progRow
      } catch (_) {}
    }

    const affordability = calculateAffordability(studentProfile, program, [])

    res.json({
      success: true,
      data: affordability,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' },
    })
  }
})

export default router
