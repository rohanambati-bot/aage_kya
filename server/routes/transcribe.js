import express from 'express'
import { transcribeLimiter } from '../middleware/rateLimiter.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// Groq Whisper transcription endpoint.
//
// Hardening applied:
//  • requireAuth() — this endpoint spends paid third-party API credits, so it
//    must not be callable anonymously.
//  • Explicit payload cap — the global express.json limit is 10mb; base64
//    inflates ~33%, so cap the decoded audio instead of trusting the client.
//  • The API key is read per-request and never returned to the client.
const MAX_AUDIO_BYTES = 6 * 1024 * 1024 // 6 MB of decoded audio
const ALLOWED_MIME = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])

router.post('/api/transcribe', requireAuth(), transcribeLimiter, async (req, res) => {
  try {
    const { audio, mimeType } = req.body
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing audio data' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'NO_API_KEY', message: 'Transcription is not configured.' })
    }

    // Reject a disallowed container up front rather than paying for the call.
    const normalizedMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_MIME.has(normalizedMime)) {
      return res.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported audio format.' })
    }

    const audioBuffer = Buffer.from(audio, 'base64')
    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Audio data could not be decoded.' })
    }
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Audio clip is too large. Keep recordings under ~60 seconds.' })
    }

    const ext = normalizedMime.includes('mp4') ? 'mp4'
      : normalizedMime.includes('ogg') ? 'ogg'
        : normalizedMime.includes('wav') ? 'wav'
          : normalizedMime.includes('mpeg') ? 'mp3'
            : 'webm'

    const form = new FormData()
    form.append('file', new Blob([audioBuffer], { type: normalizedMime }), `audio.${ext}`)
    form.append('model', 'whisper-large-v3')
    form.append('response_format', 'text')
    form.append('language', 'en')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      // Log provider detail server-side; return a generic message to the client
      // so upstream error text (which can echo request metadata) is not leaked.
      const detail = (await response.text()).slice(0, 300)
      console.error(`[transcribe] Groq error ${response.status}: ${detail}`)
      return res.status(502).json({ error: 'TRANSCRIPTION_FAILED', message: 'Transcription service is unavailable. Please try again.' })
    }

    const text = (await response.text()).trim()
    res.json({ transcription: text })
  } catch (err) {
    console.error('Transcription API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Transcription failed. Please try again.' })
  }
})

export default router
