import express from 'express'
import { supabase, getSupabaseClient, isSupabaseConfigured } from '../utils/db.js'
import { requireAuth } from '../middleware/auth.js'
import { computeMatch } from '../engine/localMatchEngine.js'
import { callLLM } from '../ai/llmClient.js'
import { QUIZ_QUESTIONS } from '../data/quizQuestions.js'
import { escapeIlikePattern, pickCollegeMatch } from '../domain/colleges/matchCollegeName.js'

const router = express.Router()

// Note: courseFeedbackLimiter must be imported or recreated here.
import { createRateLimiter } from '../middleware/rateLimiter.js'

router.get('/api/college-details', async (req, res) => {
  const name = (req.query.name || '').trim()
  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing college name' })
  }

  try {
    // 1. Try Supabase first — FULL-NAME match only.
    //    Tier 1: case-insensitive exact match on the whole name.
    //    Tier 2: the whole name as an ilike pattern (never the first word), and
    //            only accepted when it resolves to a single unambiguous row.
    //    Anything less confident is treated as "no DB match" and falls through
    //    to the AI path — returning a same-first-word institution's fees or
    //    cutoffs as authoritative data is worse than returning nothing.
    if (isSupabaseConfigured()) {
      const pattern = escapeIlikePattern(name)
      let match = null

      const { data: exactRows, error: exactError } = await supabase
        .from('colleges')
        .select('*')
        .ilike('name', pattern)
        .limit(5)

      if (!exactError) match = pickCollegeMatch(exactRows, name)

      if (!match) {
        const { data: fuzzyRows, error: fuzzyError } = await supabase
          .from('colleges')
          .select('*')
          .ilike('name', `%${pattern}%`)
          .limit(5)

        if (!fuzzyError) match = pickCollegeMatch(fuzzyRows, name)
      }

      if (match) {
        const c = match
        return res.json({
          source: 'database',
          fullName: c.name,
          city: c.city || null,
          state: c.state || null,
          type: c.college_type || null,
          website: c.source_url || null,
          fees: {
            govtQuota: c.yearly_cost_min ? `₹${(c.yearly_cost_min/1000).toFixed(0)}K–₹${(c.yearly_cost_max/1000).toFixed(0)}K/yr (Govt quota)` : null,
            managementQuota: null
          },
          cutoffs: { note: 'Check official counselling portal for latest cutoffs' },
          placements: { avgPackage: c.avg_package || 'See official placement reports' },
          reviews: c.review_snippet || null,
        })
      }
    }

    // 2. AI-generated fallback for unknown colleges
    const prompt = `You are an educational information expert. Provide a concise factsheet for this Indian college: "${name}"

    If you do not have reliable, specific information about THIS institution's fees, cutoffs, or placements, return null for that field. Do not estimate, generalize, or reuse figures from other institutions or from a generic 'typical Indian college' template.

    Respond ONLY with valid JSON in this exact structure (use null for unknown fields):
    {
      "fullName": "Full official name",
      "city": "City name",
      "state": "State name",
      "type": "Government/Private Aided/Private/Deemed University",
      "established": year_number_or_null,
      "naac": "Grade or null",
      "website": "https://official-url.edu or null",
      "fees": {
        "govtQuota": "Fee range string for govt quota seats or null",
        "managementQuota": "Fee range string for management quota or null"
      },
      "cutoffs": {
        "jee": "JEE rank range needed or null",
        "neet": "NEET rank range or null",
        "kcet": "KCET rank range or null",
        "note": "General note about admission process"
      },
      "placements": {
        "avgPackage": "Average package string",
        "topRecruiters": ["Company1", "Company2", "Company3"]
      },
      "reviews": "One line student review or general reputation note"
    }`

    try {
      const parsed = await callLLM(prompt, { json: true, maxTokens: 700, temperature: 0.1, callType: 'college_details' })
      return res.json({ ...parsed, source: 'ai_generated' })
    } catch (err) {
      console.warn('[college-details] AI fallback unavailable:', err.message)
      return res.json({ source: 'not_found' })
    }
  } catch (err) {
    console.error('College details error:', err.message)
    return res.json({ source: 'error', fullName: name })
  }
})

// ─── Course Feedback Endpoints ───────────────────────────────────────────────

// GET /api/course-feedback?stream=Science (PCM)
// Returns approved public feedback for a given stream/path
router.get('/api/course-feedback', async (req, res) => {
  const streamKey = req.query.stream
  if (!streamKey || streamKey.trim().length < 2) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing stream query param' })
  }
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ feedback: [] })
    }
    const { data, error } = await supabase
      .from('course_feedback')
      .select('id, content, created_at')
      .eq('stream_key', streamKey.trim())
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    res.json({ feedback: data || [] })
  } catch (err) {
    console.error('Course feedback fetch error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// POST /api/course-feedback — authenticated students submit feedback
const courseFeedbackLimiter = createRateLimiter(3, 3600000, 'You can only submit 3 feedback entries per hour.')
router.post('/api/course-feedback', requireAuth(), courseFeedbackLimiter, async (req, res) => {
  const user = req.authUser
  const { streamKey, content } = req.body
  if (!streamKey || !content || content.trim().length < 20) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Feedback must be at least 20 characters and include a stream key.' })
  }
  if (content.trim().length > 1000) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Feedback must be under 1000 characters.' })
  }
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ success: true, simulated: true })
    }
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('course_feedback')
      .insert({
        stream_key: streamKey.trim(),
        author_id: user.id,
        content: content.trim(),
        approved: false // requires moderation before appearing publicly
      })
      .select('id')
      .single()
    if (error) throw error
    res.json({ success: true, id: data.id, message: 'Feedback submitted — it will appear after review.' })
  } catch (err) {
    console.error('Course feedback submit error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// POST /api/analytics/event — Log client interaction event
router.post('/api/match/local', (req, res) => {
  try {
    const { studentProfile, college, colleges } = req.body || {}
    if (!studentProfile) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'studentProfile object is required' })
    }

    if (college) {
      const match = computeMatch(studentProfile, college)
      return res.json({ success: true, match })
    }

    if (Array.isArray(colleges)) {
      const matches = colleges.map((c) => ({
        collegeId: c.id,
        collegeName: c.name,
        match: computeMatch(studentProfile, c),
      }))
      return res.json({ success: true, matches })
    }

    res.status(400).json({ error: 'INVALID_INPUT', message: 'Either college object or colleges array is required' })
  } catch (err) {
    res.status(500).json({ error: 'MATCH_ENGINE_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// ─── Part A: Quiz Questions Bank Endpoint ────────────────────────────────────
router.get('/api/quiz/questions', (req, res) => {
  res.json({ success: true, questions: QUIZ_QUESTIONS })
})


export default router
