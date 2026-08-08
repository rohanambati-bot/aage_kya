/**
 * Safe error responder.
 *
 * Route handlers previously replied with `{ error: 'INTERNAL_ERROR', message: err.message }`.
 * That echoed raw internals to the client — Postgres/PostgREST messages
 * (revealing table names, column names, constraint names and RLS policy
 * behaviour), upstream provider errors, and Node runtime errors such as
 * "getAuthUser is not defined". All of that is reconnaissance material.
 *
 * The full error is still logged server-side with the request's trace id so
 * debuggability is unchanged; only the client-facing text is generic.
 */
export function respondWithError(res, err, context, {
  status = 500,
  code = 'INTERNAL_ERROR',
  message = 'An unexpected error occurred. Please try again.',
} = {}) {
  const traceId = res.req?.traceId || 'N/A'
  console.error(`[${context}] [Trace: ${traceId}]`, err)
  if (res.headersSent) return undefined
  return res.status(status).json({ error: code, message, traceId })
}
