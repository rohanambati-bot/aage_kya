import express from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/auth/role — Returns authenticated user's role from DB
router.get('/role', requireAuth(), (req, res) => {
  res.json({ role: req.authUser.role || 'student', userId: req.authUser.id, email: req.authUser.email })
})

export default router
