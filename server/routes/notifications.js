import express from 'express'
import { getSupabaseClient } from '../utils/db.js'
import { requireAuth } from '../middleware/auth.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'
const router = express.Router()

router.get('/api/notifications', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    res.json({ notifications: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────
router.patch('/api/notifications/:id/read', requireAuth(), async (req, res) => {
  const { id } = req.params
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ─── Chatbot Endpoint (lightweight, for new users) ────────────────────────────

const chatLimiter = createRateLimiter(10, 3600000, 'Too many chat messages. Please try again in an hour.')

const CHAT_SYSTEM_PROMPT = `You are a helpful, concise, and honest guide for Indian students asking general questions about education, courses, streams, and careers.

RULES:
1. Answer factual, general questions directly and clearly (e.g. "What is PCM?", "What is CUET?", "What can I do after Commerce?").
2. Keep answers short — under 150 words. Use bullet points if listing things.
3. Be honest and specific to Indian education context.
4. If the question requires knowing the student's personal situation (marks, income, state, family background, interests, risk comfort), do NOT try to answer it. Instead set handoff=true.
5. Examples of questions that need handoff: "Which stream is best for me?", "What college should I apply to?", "Will I get into NIT?", "Am I eligible for NEET?", "What should I do after my results?".
6. Examples that do NOT need handoff (answer directly): "What is JEE?", "What is the difference between NEET and JEE?", "What careers can I get in Commerce?", "What is ITI?", "How long is MBBS?".

RESPONSE FORMAT: Always respond in this exact JSON structure (no markdown, no backticks):
{
  "message": "Your answer here",
  "handoff": false,
  "handoff_reason": ""
}
If handoff is true, message should acknowledge the question and explain why personalised guidance is needed. handoff_reason should be 1 sentence explaining what personal context is missing.`

function getMockChatResponse(messages, profile) {
  const lastMsg = messages[messages.length - 1].content.toLowerCase()
  let response = "That's an interesting question! Can you tell me more about your current stream and what interests you?"
  let handoff = false
  let handoff_reason = ""

  if (profile) {
    const name = profile.full_name ? ` ${profile.full_name}` : ''
    const stream = profile.stream || 'your selected stream'
    const classLevel = profile.class_level === 'class10' ? 'Class 10' : profile.class_level === 'class12' ? 'Class 12' : 'school'
    
    if (lastMsg.includes('engineering') || lastMsg.includes('btech') || lastMsg.includes('b.tech') || lastMsg.includes('computer')) {
      if (profile.class_level === 'class12' && (profile.stream === 'Science' || profile.stream === 'Science (PCM)')) {
        response = `Hey${name}, since you are in Class 12 Science (marks: ${profile.marks || 'N/A'}, state: ${profile.state || 'N/A'}), engineering is a great path. You should prepare for exams like JEE and KCET/COMEDK. Your preferred admission mode is ${profile.preferred_admission || 'KCET'}.`
      } else {
        response = `Hi${name}, you mentioned you are in ${classLevel} with ${stream} stream. Typically, engineering requires Science (PCM) in Class 12. Let me know if you want to know about other options!`
      }
    } else if (lastMsg.includes('commerce') || lastMsg.includes('ca') || lastMsg.includes('bba')) {
      response = `Hi${name}, since you are in ${classLevel} and interested in Commerce/CA, you should focus on Accounting and Economics. We recommend checking BBA or B.Com programs in your preferred cities.`
    } else if (lastMsg.includes('scholarship') || lastMsg.includes('fee') || lastMsg.includes('cost')) {
      response = `Hi${name}, based on your profile (State: ${profile.state || 'N/A'}, Marks: ${profile.marks || 'N/A'}), we suggest checking the Scholarships tab on your Dashboard to see matching national and state benefits.`
    } else {
      response = `Hey${name}, based on your ${classLevel} ${stream} profile, how else can I help guide your education planning?`
    }
  } else {
    if (lastMsg.includes('engineering') || lastMsg.includes('btech') || lastMsg.includes('b.tech') || lastMsg.includes('computer')) {
      response = "Engineering (especially Computer Science) is highly popular. For high-quality, honest advice tailored to you, please fill out our Onboarding form so I know your class board, marks, and state."
      handoff = true
      handoff_reason = "Need student board and marks to suggest realistic engineering options."
    } else if (lastMsg.includes('commerce') || lastMsg.includes('ca') || lastMsg.includes('bba')) {
      response = "Commerce fields like CA, BBA, and finance offer amazing opportunities. I can give you a personalized 4-year roadmap if you complete the Onboarding profile first."
      handoff = true
      handoff_reason = "Requires family income range and preferred cities to tailor finance options."
    } else if (lastMsg.includes('scholarship') || lastMsg.includes('fee') || lastMsg.includes('cost')) {
      response = "We have mapped several state-specific and national scholarships in our database. Complete the onboarding so we can filter ones matching your family income!"
      handoff = true
      handoff_reason = "Requires family income range and state to filter scholarships."
    }
  }

  return {
    message: response,
    handoff,
    handoff_reason
  }
}

export default router
