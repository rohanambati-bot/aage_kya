import express from 'express'
import { transcribeLimiter } from '../middleware/rateLimiter.js'


const router = express.Router()

router.post('/api/transcribe', transcribeLimiter, async (req, res) => {
  try {
    const { audio, mimeType } = req.body
    if (!audio) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing audio data' })
    }

    const client = getGroqClient()

    // Convert base64 audio to a Buffer and wrap as a File-like object for the Groq SDK
    const audioBuffer = Buffer.from(audio, 'base64')
    const ext = (mimeType || 'audio/webm').includes('mp4') ? 'mp4'
              : (mimeType || '').includes('ogg') ? 'ogg'
              : 'webm'
    const filename = `audio.${ext}`

    // Groq SDK accepts a File object — create one from the buffer
    const audioFile = new File([audioBuffer], filename, { type: mimeType || 'audio/webm' })

    const transcriptionResponse = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      response_format: 'text',
      language: 'en', // Whisper auto-detects but we bias toward English output
    })

    // transcriptionResponse is the raw text string when response_format is 'text'
    const text = typeof transcriptionResponse === 'string'
      ? transcriptionResponse.trim()
      : (transcriptionResponse.text || '').trim()

    res.json({ transcription: text })
  } catch (err) {
    console.error('Transcription API Error:', err.message)
    if (err.message === 'NO_API_KEY') {
      res.status(401).json({ error: 'NO_API_KEY', message: 'API Key is missing' })
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
    }
  }
})

export default router
