import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { setupSecurityMiddlewares } from './middleware/security.js'
import { errorHandler } from './middleware/errorHandler.js'
import { isSupabaseConfigured, supabase } from './utils/db.js'

// Import route controllers
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import mentorsRoutes from './routes/mentors.js'
import guidanceRoutes from './routes/guidance.js'
import collegesRoutes from './routes/colleges.js'
import chatRoutes from './routes/chat.js'
import analyticsRoutes from './routes/analytics.js'
import studentsRoutes from './routes/students.js'
import predictorRoutes from './routes/predictor.js'
import walletRoutes from './routes/wallet.js'
import transcribeRoutes from './routes/transcribe.js'
import scenariosRoutes from './routes/scenarios.js'
import mentorSessionsRoutes from './routes/mentorSessions.js'
import qaRoutes from './routes/qa.js'
import notificationsRoutes from './routes/notifications.js'
import quizRoutes from './routes/quiz.js'

// Load env vars if missing
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Setup Security Middlewares (Helmet, CORS, Rate Limiters, XSS, Tracing, Logging)
setupSecurityMiddlewares(app)

// Basic health check (Keep this one in index for load balancers)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Provide AI readiness status
import { getAiStatus } from './ai/llmClient.js'
app.get('/api/ai-status', (req, res) => {
  res.json(getAiStatus())
})

// Mount API Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/mentors', mentorsRoutes) // Note: mentorsRoutes handles /api/mentors, /api/mentors/apply etc, but since it already has the full paths, we just mount at /
app.use('/', mentorsRoutes)
app.use('/', guidanceRoutes)
app.use('/', collegesRoutes)
app.use('/', chatRoutes)
app.use('/', analyticsRoutes)
app.use('/', studentsRoutes)
app.use('/', predictorRoutes)
app.use('/', walletRoutes)
app.use('/', transcribeRoutes)
app.use('/', scenariosRoutes)
app.use('/', mentorSessionsRoutes)
app.use('/', qaRoutes)
app.use('/', notificationsRoutes)
app.use('/', quizRoutes)

// Setup static file serving for React frontend
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'))
})

// Global Error Handler
app.use(errorHandler)

// Startup DB Probe
const port = process.env.PORT || 5000
const server = app.listen(port, async () => {
  console.log(`Server listening on port ${port}`)
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('colleges').select('id').limit(1)
      if (error) console.error('[STARTUP] ❌ DB check failed:', error.message)
      else console.log('[STARTUP] ✅ Supabase connection OK')
    } catch (err) {
      console.error('[STARTUP] ❌ DB probe error:', err.message)
    }
  }
  console.log('[STARTUP] AI status:', getAiStatus())
})

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...')
  server.close(() => {
    console.log('Closed out remaining connections')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('Force shutting down')
    process.exit(1)
  }, 10000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err)
  setTimeout(() => process.exit(1), 3000)
})
