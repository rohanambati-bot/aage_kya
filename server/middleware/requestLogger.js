/**
 * ══════════════════════════════════════════════════════════════════════════
 *  STRUCTURED REQUEST LOGGER MIDDLEWARE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Logs every API request as a structured JSON line so we can analyze:
 *    • response times per route
 *    • error frequency
 *    • heavy callers
 *    • slow endpoints
 *
 *  Output goes to stdout so it can be piped to log aggregators (Loki, ELK, etc.)
 */

export function requestLogger(req, res, next) {
  // Skip static assets and non-API requests
  if (!req.path.startsWith('/api')) return next()

  const start = Date.now()
  const originalEnd = res.end

  res.end = function (...args) {
    const durationMs = Date.now() - start
    const logEntry = {
      ts: new Date().toISOString(),
      event: 'http_request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      // Safe user identification (hashed IP, never raw)
      ip: req.ip ? hashIp(req.ip) : undefined,
      userAgent: req.headers['user-agent']?.slice(0, 120),
      // Track authenticated vs anonymous
      authenticated: !!req.headers.authorization,
      // Content length for payload monitoring
      reqSize: req.headers['content-length'] ? Number(req.headers['content-length']) : undefined,
      resSize: res.getHeader('content-length') ? Number(res.getHeader('content-length')) : undefined,
    }

    // Only log slow requests (> 2s) or errors at warn level
    if (durationMs > 2000 || res.statusCode >= 500) {
      console.warn(JSON.stringify(logEntry))
    } else if (res.statusCode >= 400) {
      console.warn(JSON.stringify(logEntry))
    } else {
      console.log(JSON.stringify(logEntry))
    }

    originalEnd.apply(res, args)
  }

  next()
}

/** Simple hash so we don't store raw IPs in logs */
function hashIp(ip) {
  let hash = 0
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0
  }
  return 'ip_' + Math.abs(hash).toString(36)
}
