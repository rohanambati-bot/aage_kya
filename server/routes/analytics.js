import express from 'express'
import { supabase, supabaseAdmin } from '../utils/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.get('/api/analytics', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({
      error: 'ANALYTICS_UNAVAILABLE',
      message: 'Set SUPABASE_SERVICE_ROLE_KEY in server/.env to enable analytics.',
    })
  }

  try {
    // Count students per stream
    const { data: streamRows, error: streamErr } = await supabaseAdmin
      .from('students')
      .select('stream')

    if (streamErr) throw streamErr

    // Count students per state
    const { data: stateRows, error: stateErr } = await supabaseAdmin
      .from('students')
      .select('state')

    if (stateErr) throw stateErr

    // Aggregate in JS (Supabase JS client doesn't expose GROUP BY directly without RPC)
    const countBy = (rows, key) => {
      const map = {}
      for (const row of rows) {
        const val = row[key] || 'Unknown'
        map[val] = (map[val] || 0) + 1
      }
      return Object.entries(map)
        .map(([value, count]) => ({ [key]: value, count }))
        .sort((a, b) => b.count - a.count)
    }

    res.json({
      total_students: streamRows.length,
      by_stream: countBy(streamRows, 'stream'),
      by_state:  countBy(stateRows,  'state'),
    })
  } catch (err) {
    console.error('Analytics API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

router.post('/api/analytics/event', async (req, res) => {
  const { event_type, metadata } = req.body || {}
  if (!event_type) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing event_type' })
  try {
    const client = supabaseAdmin || supabase
    await client.from('analytics_events').insert({
      event_type,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    }).catch(() => {})
    console.log(`[analytics event]: ${event_type}`, metadata || '')
    res.json({ success: true })
  } catch {
    res.json({ success: true, logged: true })
  }
})

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

// GET /api/admin/mentor-bookings — Fetch all "Book Mentor" requests

export default router
