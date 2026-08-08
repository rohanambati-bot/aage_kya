import express from 'express'
import { getSupabaseClient, supabase } from '../utils/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'
import { sendEmail } from '../utils/email.js'
const sessionCreateLimiter = createRateLimiter(20, 3600000, 'Session limit.')

const router = express.Router()

router.post('/api/mentor-sessions', requireAuth(), sessionCreateLimiter, async (req, res) => {
  const user = req.authUser
  const { mentorId, sessionDate } = req.body
  if (!mentorId) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing mentorId' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('mentor_sessions')
      .insert({ student_id: user.id, mentor_id: mentorId, session_date: sessionDate || null, status: 'pending' })
      .select()
      .single()
    if (error) throw error
    // Send confirmation email (fire-and-forget; never blocks the booking).
    if (user.email) {
      sendEmail(
        user.email,
        'Mentor Session Requested — Aage Kya?',
        `<p>Hi there! Your mentor session request has been submitted. Your mentor will confirm shortly.</p>`
      ).catch(() => {})
    }
    res.json({ session: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// ── GET /api/mentor-sessions ───────────────────────────────────────────────────
router.get('/api/mentor-sessions', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    // Students see their own; mentors see sessions for their profile
    if (user.role === 'mentor') {
      // Find mentor record by user_id
      const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', user.id).maybeSingle()
      if (!mentorRow) return res.json({ sessions: [] })
      const { data, error } = await client.from('mentor_sessions').select('*, mentors(name)').eq('mentor_id', mentorRow.id).order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ sessions: data || [] })
    } else {
      const { data, error } = await client.from('mentor_sessions').select('*, mentors(name)').eq('student_id', user.id).order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ sessions: data || [] })
    }
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// ── PATCH /api/mentor-sessions/:id/rate ───────────────────────────────────────
router.patch('/api/mentor-sessions/:id/rate', requireAuth(), async (req, res) => {
  const { id } = req.params
  const { rating, ratingComment } = req.body
  const user = req.authUser
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Rating must be 1–5' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('mentor_sessions')
      .update({ rating: Number(rating), rating_comment: ratingComment || '' })
      .eq('id', id).eq('student_id', user.id)
      .select().single()
    if (error) throw error
    res.json({ session: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// ── PATCH /api/mentor-sessions/:id/notes — mentor writes session notes ─────────
router.patch('/api/mentor-sessions/:id/notes', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const { notes, status } = req.body
  const user = req.authUser
  try {
    // Verify the mentor owns this session
    const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', user.id).maybeSingle()
    if (!mentorRow) return res.status(403).json({ error: 'FORBIDDEN', message: 'No mentor profile found' })
    const client = getSupabaseClient(req.headers.authorization)
    const update = {}
    if (notes !== undefined) update.notes = notes
    if (status) update.status = status
    const { data, error } = await client
      .from('mentor_sessions').update(update).eq('id', id).eq('mentor_id', mentorRow.id)
      .select().single()
    if (error) throw error
    res.json({ session: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// ── GET /api/qa ────────────────────────────────────────────────────────────────

export default router
