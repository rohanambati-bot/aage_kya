import express from 'express'
import { getSupabaseClient } from '../utils/db.js'
import { requireAuth } from '../middleware/auth.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'
const router = express.Router()

router.get('/api/scenarios', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('scenarios')
      .select('id, label, form_data, guidance_result, created_at')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ scenarios: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/scenarios ────────────────────────────────────────────────────────
const scenarioLimiter = createRateLimiter(20, 86400000, 'Too many scenarios saved today.')
router.post('/api/scenarios', requireAuth(), scenarioLimiter, async (req, res) => {
  const user = req.authUser
  const { label, formData, guidanceResult } = req.body
  if (!formData || !guidanceResult) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing formData or guidanceResult' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('scenarios')
      .insert({ student_id: user.id, label: label || 'Saved Scenario', form_data: formData, guidance_result: guidanceResult })
      .select()
      .single()
    if (error) throw error
    res.json({ scenario: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── DELETE /api/scenarios/:id ──────────────────────────────────────────────────
router.delete('/api/scenarios/:id', requireAuth(), async (req, res) => {
  const user = req.authUser
  const { id } = req.params
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { error } = await client.from('scenarios').delete().eq('id', id).eq('student_id', user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/mentor-sessions ──────────────────────────────────────────────────
const sessionCreateLimiter = createRateLimiter(5, 86400000, 'Too many session requests today.')

export default router
