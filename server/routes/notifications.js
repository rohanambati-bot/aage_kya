import express from 'express'
import { getSupabaseClient } from '../utils/db.js'
import { requireAuth } from '../middleware/auth.js'
const router = express.Router()

router.get('/api/notifications', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    res.json({ notifications: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────
router.patch('/api/notifications/:id/read', requireAuth(), async (req, res) => {
  const { id } = req.params
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})


export default router

