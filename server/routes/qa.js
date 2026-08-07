import express from 'express'
import { getSupabaseClient, supabase } from '../utils/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

router.get('/api/qa', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = 20
  const offset = (page - 1) * limit
  const streamTag = req.query.stream || null
  try {
    let query = supabase
      .from('qa_posts')
      .select('id, question, answer, answered_at, stream_tag, created_at, mentor_id, mentors(name, initials)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (streamTag) query = query.eq('stream_tag', streamTag)
    const { data, error } = await query
    if (error) throw error
    res.json({ posts: data || [], page })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/qa ───────────────────────────────────────────────────────────────
const qaPostLimiter = createRateLimiter(5, 3600000, 'Too many Q&A posts. Please wait an hour.')
router.post('/api/qa', requireAuth(), qaPostLimiter, async (req, res) => {
  const user = req.authUser
  const { question, streamTag } = req.body
  if (!question || question.trim().length < 10) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Question must be at least 10 characters' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('qa_posts')
      .insert({ author_id: user.id, question: question.trim(), stream_tag: streamTag || '' })
      .select().single()
    if (error) throw error
    res.json({ post: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/qa/:id/answer — mentor posts an answer ─────────────────────────
router.patch('/api/qa/:id/answer', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const { answer } = req.body
  const user = req.authUser
  if (!answer || answer.trim().length < 5) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Answer too short' })
  try {
    const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', user.id).maybeSingle()
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('qa_posts')
      .update({ answer: answer.trim(), answered_at: new Date().toISOString(), mentor_id: mentorRow?.id || null })
      .eq('id', id)
      .select().single()
    if (error) throw error
    res.json({ post: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/notifications ─────────────────────────────────────────────────────

export default router
