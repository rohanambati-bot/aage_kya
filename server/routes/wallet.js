import express from 'express'
import { getSupabaseClient } from '../utils/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.put('/api/wallet', requireAuth(), async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const user = req.authUser

    const { wallet } = req.body
    if (!Array.isArray(wallet)) {
      return res.status(400).json({ error: 'INVALID_DATA', message: 'wallet must be an array' })
    }

    const client = getSupabaseClient(authHeader)
    const { data, error } = await client
      .from('students')
      .update({ academic_wallet: wallet, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()

    if (error) throw error

    res.json({ success: true, wallet: data[0]?.academic_wallet || [] })
  } catch (err) {
    console.error('Wallet API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' })
  }
})


export default router
