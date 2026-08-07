export function errorHandler(err, req, res, next) {
  console.error(`[UNCAUGHT] [Trace: ${req.traceId || 'N/A'}]`, err)
  if (!res.headersSent) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' })
  }
}
