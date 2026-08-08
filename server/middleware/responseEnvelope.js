/**
 * Response envelope helper functions for consistent API outputs.
 */

export function successResponse(res, data, status = 200, meta = {}) {
  return res.status(status).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
    error: null,
  })
}

export function errorResponse(res, code = 'INTERNAL_ERROR', message = 'An unexpected error occurred', status = 500) {
  return res.status(status).json({
    success: false,
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
    error: {
      code,
      message,
    },
  })
}
