export function errorHandler(err, req, res, next) {
  const traceId = req.traceId || 'N/A'
  console.error(`[UNCAUGHT] [Trace: ${traceId}]`, err)

  if (res.headersSent) return next(err)

  // A malformed JSON body is a client error. Returning 500 for it both misleads
  // clients and pollutes error monitoring with attacker-triggered noise.
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Request body is not valid JSON.', traceId })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.', traceId })
  }

  // Never echo err.message: it leaks stack/driver/table detail to the client.
  return res.status(err?.statusCode >= 400 && err?.statusCode < 500 ? err.statusCode : 500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    traceId,
  })
}
