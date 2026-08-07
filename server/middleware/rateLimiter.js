// In-Memory Rate Limiter Store
const rateLimitStore = new Map() // key -> Array of timestamps

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of rateLimitStore) {
    const fresh = timestamps.filter(t => now - t < 86400000) // keep last 24h
    if (fresh.length === 0) rateLimitStore.delete(key)
    else rateLimitStore.set(key, fresh)
  }
}, 60000) // cleanup every minute

export function createRateLimiter(limit, windowMs, message) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const key = `${ip}:${req.baseUrl || ''}${req.path}`
    const now = Date.now()
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, [])
    }
    
    let timestamps = rateLimitStore.get(key)
    timestamps = timestamps.filter(t => now - t < windowMs)
    rateLimitStore.set(key, timestamps)
    
    if (timestamps.length >= limit) {
      const oldestTimestamp = timestamps[0]
      const resetTimeMs = windowMs - (now - oldestTimestamp)
      const resetMinutes = Math.ceil(resetTimeMs / 60000)
      console.warn(`[${new Date().toISOString()}] WARN: Rate limit hit for ${key}. Limit: ${limit}/${windowMs}ms`)
      return res.status(429).json({
        error: 'RATE_LIMIT',
        message: message || `Too many requests. Please try again in ${resetMinutes} minute(s).`
      })
    }
    
    timestamps.push(now)
    next()
  }
}

const isDev = process.env.NODE_ENV !== 'production'

export const guidanceLimiter = createRateLimiter(isDev ? 50 : 5, 86400000, "You can only generate 5 career guidance reports per day to prevent system abuse. Please try again tomorrow.")
export const roadmapLimiter  = createRateLimiter(isDev ? 50 : 5, 86400000, "You can only generate 5 career roadmaps per day to prevent system abuse. Please try again tomorrow.")
export const mentorApplyLimiter = createRateLimiter(isDev ? 50 : 3, 3600000, "You can only submit a few applications per hour. Please try again later.")
export const transcribeLimiter  = createRateLimiter(15, 3600000, "You have exceeded the transcription rate limit. Please try again in an hour.")
export const mentorBookLimiter = createRateLimiter(5, 3600000, 'You can only submit a few booking requests per hour. Please try again later.')
export const mentorAskLimiter = createRateLimiter(isDev ? 50 : 10, 3600000, 'You can only send a few questions per hour. Please try again later.')
