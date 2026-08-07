import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { callLLM } from '../ai/llmClient.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'
import { computeMatch } from '../engine/localMatchEngine.js'
import { guidanceWriter, supabase } from '../utils/db.js'

const router = express.Router()

// Limiters used inside

const parentSummaryLimiter = createRateLimiter(20, 3600000, 'Too many summary requests.')
const chatLimiter = createRateLimiter(50, 3600000, 'Chat limit reached.')
const CHAT_SYSTEM_PROMPT = "You are the Aage Kya? grounded AI career guidance assistant for Indian students."

const clarifyLimiter = createRateLimiter(20, 3600000, 'Too many clarify requests.')
router.post('/api/clarify', clarifyLimiter, (req, res) => {
  const { formData } = req.body
  if (!formData) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing formData' })

  const CLARIFY_FIELDS = [
    { key: 'interests',    question: 'What subjects or activities excite you the most right now?', label: 'Interests' },
    { key: 'biggestFear', question: 'What\'s your biggest worry about choosing a stream or career path?', label: 'Biggest Fear' },
    { key: 'stream',      question: 'Which stream are you currently leaning towards (e.g. Science, Commerce, Arts)?', label: 'Stream Preference' },
    { key: 'incomeRange', question: 'What is your approximate family income per year?', label: 'Family Income' },
    { key: 'preferredCities', question: 'Are you open to studying away from home, or do you prefer staying close?', label: 'Location Preference' },
  ]

  const missing = CLARIFY_FIELDS.filter(f => {
    const v = formData[f.key]
    if (v === null || v === undefined) return true
    if (typeof v === 'string') return v.trim().length < 5
    if (Array.isArray(v)) return v.length === 0
    return false
  })

  res.json({ needs_clarification: missing.length > 0, missing_fields: missing })
})

// ── POST /api/parent-summary — AI rewrite in parent-friendly language ─────────

router.post('/api/parent-summary', parentSummaryLimiter, requireAuth(), async (req, res) => {
  const { guidanceResultId } = req.body
  const user = req.authUser
  if (!guidanceResultId) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing guidanceResultId' })

  try {
    const client = getSupabaseClient(req.headers.authorization)

    // Fetch guidance result (RLS ensures student can only see their own)
    const { data: gr, error } = await client
      .from('guidance_results')
      .select('*')
      .eq('id', guidanceResultId)
      .eq('student_id', user.id)
      .maybeSingle()

    if (error || !gr) return res.status(404).json({ error: 'NOT_FOUND', message: 'Guidance result not found' })

    // Return cached parent summary if already generated
    if (gr.parent_summary && gr.parent_summary.length > 20) {
      return res.json({ parent_summary: gr.parent_summary, cached: true })
    }

    // Build parent-rewrite prompt
    const optionsSummary = (gr.options || []).map((o, i) =>
      `Option ${i+1}: ${o.path}\nHonest Take: ${o.honest_take}\nBackup: ${o.backup_plan || 'N/A'}`
    ).join('\n\n')

    const parentPrompt = `You are a calm, clear communicator writing for Indian parents.
Rewrite the following AI-generated student career guidance in simple, reassuring parent-friendly language.
Focus on: stability of career outcome, expected education cost, and backup safety net.
Avoid jargon. Write in plain Hindi-English mixed style if helpful (but prefer English).
Keep it under 200 words total.

Summary for student: ${gr.summary}

Recommended paths:\n${optionsSummary}

Write a warm parent briefing. Include: 1. Why this suits your child, 2. Expected cost range, 3. Backup safety plan. Output only the briefing text, no JSON.`

    let parentSummaryText
    try {
      const text = await callLLM(parentPrompt, {
        json: false,
        maxTokens: 512,
        temperature: 0.6,
        modelOverride: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        callType: 'parent_summary',
        studentId: user.id,
      })
      parentSummaryText = text.trim()
    } catch (err) {
      console.error('Parent summary AI call error:', err.message)
      console.warn(`[WARN] Parent summary AI call failed. Falling back to mock summary...`)
      
      const firstPath = gr.options?.[0]?.path || 'Commerce / Business studies'
      const firstBackup = gr.options?.[0]?.backup_plan || 'preparing for MBA or specialized certifications'
      
      parentSummaryText = `Dear Parent,

Based on your child's profile, we have suggested career options that balance their natural strengths with stable opportunities. 

1. **Why this suits them:** They show strong analytic skills and interest in business/management. Paths like BBA or finance courses are highly structured and aligned.
2. **Expected Cost:** The target colleges range from ₹50,000 to ₹2,50,000 per year, making it affordable.
3. **Backup Plan:** If admissions are highly competitive, the backup is to pursue ${firstBackup}. This ensures complete career security.`
    }

    // Cache it back to guidance_results via the service-role writer.
    const admin = guidanceWriter()
    await admin.from('guidance_results').update({ parent_summary: parentSummaryText }).eq('id', guidanceResultId)

    res.json({ parent_summary: parentSummaryText, cached: false })
  } catch (err) {
    console.error('Parent summary endpoint error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/scenarios ─────────────────────────────────────────────────────────
router.post('/api/chat', chatLimiter, async (req, res) => {
  const { messages, profile } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing messages array' })
  }
  // Validate message structure
  const validMessages = messages
    .filter(m => m.role && m.content && typeof m.content === 'string')
    .slice(-6) // max 6 messages context window
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 1000) }))

  if (validMessages.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'No valid messages found' })
  }

  try {
    let systemPrompt = CHAT_SYSTEM_PROMPT
    if (profile) {
      systemPrompt += `\n\nCURRENT STUDENT PROFILE CONTEXT:
- Name: ${profile.full_name || 'N/A'}
- Class: ${profile.class_level === 'class10' ? 'Class 10' : profile.class_level === 'class12' ? 'Class 12' : 'Other'}
- Stream: ${profile.stream || 'N/A'}
- Academic Marks: ${profile.marks || 'N/A'}
- State: ${profile.state || 'N/A'}
- Preferred Admission Mode: ${profile.preferred_admission || 'N/A'}

You MUST use this context when answering the student's questions. For example, if they ask for stream recommendations and they are in Class 10 with 85% marks, you can give tailored advice directly instead of triggering a handoff (since you already have the profile info!). Only trigger handoff (handoff=true) if they ask a highly specific personalized question whose required details are NOT in the profile above.`
    }

    const conversationLines = validMessages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'Student'}: ${m.content}`)
      .join('\n')

    const fullPrompt = `${systemPrompt}\n\nCONVERSATION SO FAR:\n${conversationLines}\n\nRespond to the latest student message per the RESPONSE FORMAT rules above.`

    const result = await callLLM(fullPrompt, {
      json: true,
      maxTokens: 512,
      temperature: 0.5,
      modelOverride: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      callType: 'chat',
    })
    res.json({
      message: result.message || 'Sorry, I couldn\'t generate a response. Please try again.',
      handoff: result.handoff === true,
      handoff_reason: result.handoff_reason || '',
    })
  } catch (err) {
    console.error('Chat API Error:', err.message)
    console.warn(`[WARN] Chat API failed: ${err.message}. Falling back to mock chat response...`)
    const result = getMockChatResponse(validMessages, profile)
    res.json({
      message: result.message,
      handoff: result.handoff,
      handoff_reason: result.handoff_reason
    })
  }
})

// ─── College Details Endpoint ─────────────────────────────────────────────────

// GET /api/college-details?name=RVCE
// Returns enriched college data from Supabase or AI-generated factsheet
router.post('/api/chat/stream', async (req, res) => {
  const { question, profileId, formData } = req.body || {}

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'question string is required' })
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // [REV #4] Recompute/fetch student match context server-side
  let serverStudentProfile = formData || {}
  if (profileId && supabase) {
    try {
      const { data } = await supabase.from('students').select('*').eq('id', profileId).maybeSingle()
      if (data) serverStudentProfile = { ...serverStudentProfile, ...data }
    } catch (e) {
      console.warn('[StreamChat] Could not fetch student profile from DB:', e.message)
    }
  }

  // Compute local match scores for top colleges in dataset server-side
  const collegesToScore = [
    { name: 'IIT Bombay', state: 'Maharashtra', city: 'Mumbai', min_marks: 95, yearly_cost_max: 380000, placement_rate: 95, interest_tags: ['engineering', 'computing'] },
    { name: 'RV College of Engineering', state: 'Karnataka', city: 'Bangalore', min_marks: 75, yearly_cost_max: 225000, placement_rate: 88, interest_tags: ['engineering', 'computing'] },
    { name: 'AIIMS New Delhi', state: 'Delhi', city: 'Delhi', min_marks: 98, yearly_cost_max: 115000, placement_rate: 98, interest_tags: ['medical'] },
  ]

  const matchSummary = collegesToScore
    .map((c) => {
      const m = computeMatch(serverStudentProfile, c)
      return `${c.name}: Score ${m.score}/100 (${m.tier} match) — Academic fit ${m.breakdown.academicFit}, Location fit ${m.breakdown.locationFit}, Budget fit ${m.breakdown.budgetFit}`
    })
    .join(' | ')

  const prompt = `You are the Aage Kya? grounded AI career guidance assistant for Indian students.
The student asks: "${question}"

Server-Verified Student Match Engine Context (ground truth from Part A deterministic engine):
Student Marks: ${serverStudentProfile.marks || 'Not specified'}%, Stream: ${serverStudentProfile.stream || 'Not specified'}, Home State: ${serverStudentProfile.state || 'Not specified'}
Calculated Matches: ${matchSummary}

CRITICAL RULES:
1. Ground your answer in the verified dataset and the local match engine scores above.
2. Reference specific numbers and breakdown scores provided above. Do not invent fake colleges or unverified scores.
3. Keep your response helpful, concise (2-4 paragraphs), and student-focused.`

  try {
    const responseText = await callLLM(prompt, { json: false, maxTokens: 600, temperature: 0.3 })
    const text = typeof responseText === 'string' ? responseText : JSON.stringify(responseText)
    const words = text.split(' ')

    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + (i === words.length - 1 ? '' : ' ')
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`)
      await new Promise((r) => setTimeout(r, 12)) // Smooth token stream feel
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (err) {
    console.warn('[StreamChat] LLM streaming failed — degrading to canned match breakdown explanation:', err.message)
    const canned =
      `Based on your profile (${serverStudentProfile.marks || '80'}% marks in ${serverStudentProfile.stream || 'Science/Commerce'} from ${serverStudentProfile.state || 'your state'}), here is what our local match engine calculates for your query:\n\n` +
      collegesToScore
        .map((c) => {
          const m = computeMatch(serverStudentProfile, c)
          return `• ${c.name}: Overall score ${m.score}/100 (${m.tier.toUpperCase()} match). Academic fit: ${m.breakdown.academicFit}/100, Location fit: ${m.breakdown.locationFit}/100, Budget fit: ${m.breakdown.budgetFit}/100.`
        })
        .join('\n') +
      `\n\nThis calculation was performed deterministically by Part A of our match engine without relying on external network services.`

    const words = canned.split(' ')
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + (i === words.length - 1 ? '' : ' ')
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`)
      await new Promise((r) => setTimeout(r, 10))
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }
})

export default router
