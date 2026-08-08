import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { setupSecurityMiddlewares } from './middleware/security.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { isSupabaseConfigured, supabase } from './utils/db.js'
import { readEnvironment, assertValidEnvironment } from './config/env.js'

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
import scholarshipMatchRoutes from './routes/scholarshipMatch.js'

// Load env vars if missing
dotenv.config()

// Validate configuration before wiring anything up. server/config/env.js
// already encoded these rules (HTTPS-only origins, service-role key required in
// production, no placeholder credentials) but was never called, so the module
// was dead code and a misconfigured production deploy started up silently in a
// degraded, less-secure state. Fail fast instead.
const envConfig = readEnvironment(process.env)
for (const warning of envConfig.warnings) {
  console.warn(`[config] ${warning}`)
}
assertValidEnvironment(envConfig)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Setup Security Middlewares (Helmet, CORS, Rate Limiters, XSS, Tracing, Logging)
setupSecurityMiddlewares(app)
app.use(requestLogger)

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
// mentorsRoutes declares absolute paths (/api/mentors, /api/mentors/apply, …)
// so it is mounted ONCE at the root. It was previously ALSO mounted at
// /api/mentors, which created shadow routes (e.g. /api/mentors/api/mentors/ask)
// that bypassed nothing but doubled the attack surface and made rate-limit keys
// (derived from baseUrl+path) inconsistent between the two aliases.
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
app.use('/', scholarshipMatchRoutes)

// Setup static file serving for React frontend
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Frontend bundle not found. Ensure "npm run build" runs during deployment build step.',
        })
      } else {
        next(err)
      }
    }
  })
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
