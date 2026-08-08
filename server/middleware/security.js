import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import xss from 'xss'
import crypto from 'crypto'
import express from 'express'
import cors from 'cors'

// 3. XSS Input Sanitization Middleware
const sanitizeObject = (obj) => {
  if (typeof obj === 'string') return xss(obj)
  if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach((key) => {
      obj[key] = sanitizeObject(obj[key])
    })
  }
  return obj
}

export function setupSecurityMiddlewares(app) {
  const isProduction = process.env.NODE_ENV === 'production'

  // Behind Render/Railway/Vercel the app sits behind a reverse proxy. Without
  // this, req.ip is the proxy's address for every request, so all callers share
  // one rate-limit bucket: one heavy user locks out everyone, and an attacker
  // is never individually throttled. Trust one hop only — trusting all hops
  // would let a client forge X-Forwarded-For and evade limits entirely.
  app.set('trust proxy', 1)

  // CORS — allow origins from ALLOWED_ORIGINS env var (comma-separated)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
    : null

  // `origin: true` reflects ANY requesting origin and, combined with
  // credentials: true, lets any website read authenticated responses. It is
  // only tolerable for local development, and must never be the production
  // default (which is what happened whenever ALLOWED_ORIGINS was unset).
  if (isProduction && (!allowedOrigins || allowedOrigins.length === 0)) {
    throw new Error('ALLOWED_ORIGINS must be set in production: refusing to start with a permissive CORS policy.')
  }

  app.use(cors({
    origin: allowedOrigins
      ? (origin, cb) => {
          // Same-origin/non-browser requests send no Origin header.
          if (!origin) return cb(null, true)
          if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true)
          // Reject without throwing: a thrown error hits the global error
          // handler and surfaces as a confusing 500 instead of a CORS failure.
          return cb(null, false)
        }
      : true,
    credentials: true,
  }))

  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ limit: '10mb', extended: true }))

  // 1. HTTP Security Headers
  app.use(helmet())

  // 2. Global Rate Limiting (200 requests per 15 minutes)
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use(globalLimiter)

  // 3. XSS sanitization mounting
  app.use((req, res, next) => {
    if (req.body) req.body = sanitizeObject(req.body)
    if (req.query) req.query = sanitizeObject(req.query)
    if (req.params) req.params = sanitizeObject(req.params)
    next()
  })

  // Request ID Tracing Middleware
  app.use((req, res, next) => {
    req.traceId = crypto.randomUUID().slice(0, 8)
    res.setHeader('X-Trace-Id', req.traceId)
    next()
  })

  // Structured Logger Middleware
  app.use((req, res, next) => {
    const start = Date.now()
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    
    res.on('finish', () => {
      const duration = Date.now() - start
      const authHeader = req.headers.authorization ? 'Yes' : 'No'
      console.log(`[${new Date().toISOString()}] INFO: ${req.method} ${req.originalUrl} from ${ip} - ${res.statusCode} (Latency: ${duration}ms) [Auth: ${authHeader}] [Trace: ${req.traceId}]`)
    })
    
    next()
  })
}
