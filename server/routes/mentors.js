import express from 'express'
import { supabase, supabaseAdmin, getSupabaseClient, resilientUpsertStudent, isSupabaseConfigured } from '../utils/db.js'
import { requireAuth, requireRole, getAuthUser } from '../middleware/auth.js'
import { mentorApplyLimiter, mentorBookLimiter, mentorAskLimiter } from '../middleware/rateLimiter.js'
import { verifyAndUpdateApplication } from '../utils/mentorHelpers.js'
import { sendEmail } from '../utils/email.js'

const router = express.Router()
const isDev = process.env.NODE_ENV !== 'production'

// ─── Mentors Endpoints (Phase 4 — Real Mentor Connect) ──────────────────────────


const HARDCODED_MENTORS = [
  {
    id: 'fallback-1',
    name: 'Rahul S.',
    initials: 'RS',
    college: 'PES University',
    degree: 'B.E. Electronics & Communication',
    stream: 'PCB → ECE',
    stream_category: 'Science (PCB)',
    city: 'Bengaluru',
    linkedin: '',
    story: "I missed NEET by 8 marks. Ended up in ECE. Here's what I wish someone told me.",
    tags: ['NEET dropout', 'Bio to Engineering', 'Career pivot'],
    gradient: 'from-blue-500/30 to-blue-600/10',
    border: 'border-blue-500/25',
    tag_color: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    initials_bg: 'bg-blue-500/20 text-blue-300',
    available: true,
  },
  {
    id: 'fallback-2',
    name: 'Priya M.',
    initials: 'PM',
    college: 'NIT Surathkal',
    degree: 'B.Tech Computer Science',
    stream: 'PCM → CSE',
    stream_category: 'Science (PCM)',
    city: 'Mangaluru',
    linkedin: '',
    story: "First in my family to leave home for college. It was terrifying. I'll tell you exactly what helped.",
    tags: ['First-gen student', 'Hostel life', 'Scholarships'],
    gradient: 'from-purple-500/30 to-purple-600/10',
    border: 'border-purple-500/25',
    tag_color: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    initials_bg: 'bg-purple-500/20 text-purple-300',
    available: true,
  },
  {
    id: 'fallback-3',
    name: 'Arjun K.',
    initials: 'AK',
    college: 'Manipal University',
    degree: 'BBA + Certification Finance',
    stream: 'Commerce',
    stream_category: 'Commerce',
    city: 'Pune',
    linkedin: '',
    story: "Family wanted CA. I wanted something else. Here's how I navigated that conversation.",
    tags: ['Family pressure', 'Commerce', 'Non-CA path'],
    gradient: 'from-emerald-500/30 to-emerald-600/10',
    border: 'border-emerald-500/25',
    tag_color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    initials_bg: 'bg-emerald-500/20 text-emerald-300',
    available: true,
  },
  {
    id: 'fallback-4',
    name: 'Anjali D.',
    initials: 'AD',
    college: 'Delhi University',
    degree: 'B.A. Psychology',
    stream: 'Class 10 → Humanities',
    stream_category: 'Class 10 / Stream Selection',
    city: 'Delhi',
    linkedin: '',
    story: "I spent months stressing over whether to take PCM or Arts. I chose Arts and it was the best decision of my life. Let's figure out what fits you.",
    tags: ['Stream selection', 'Humanities', 'Parent pressure'],
    gradient: 'from-amber-500/30 to-amber-600/10',
    border: 'border-amber-500/25',
    tag_color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    initials_bg: 'bg-amber-500/20 text-amber-300',
    available: true,
  },
]

// Fetch active mentors list
router.get('/api/mentors', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json(HARDCODED_MENTORS)
    }

    const { data, error } = await supabase
      .from('mentors')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      return res.json(HARDCODED_MENTORS)
    }

    res.json(data)
  } catch (err) {
    console.warn('Mentors API error, returning fallback:', err.message)
    res.json(HARDCODED_MENTORS)
  }
})
const validateApplyBody = (req, res, next) => {
  const { name, email, story } = req.body
  // name/email/story are the only hard requirements; the two application forms
  // differ in whether they send college/degree/stream vs profession/stream_category.
  if (!name || !email || !story) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Name, email and your story are required.' })
  }
  next()
}

router.post('/api/mentors/apply', validateApplyBody, mentorApplyLimiter, async (req, res) => {
  try {
    const { name, email, college, degree, stream, story, profession, streamExpertise, yearsExp, linkedIn } = req.body

    if (!supabaseAdmin || !isSupabaseConfigured()) {
      console.warn(`Volunteer signup simulated for ${name} (${email}) - Supabase not fully configured`)
      return res.json({ success: true, simulated: true })
    }

    const applicantPayload = {
      name,
      email,
      college: college || '',
      degree: degree || '',
      stream_transition: stream || '',
      story,
      profession: profession || '',
      stream_category: streamExpertise || '',
      experience_years: parseInt(yearsExp, 10) || 0,
      linkedin: linkedIn || '',
      status: 'pending'
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('mentor_applications')
      .insert(applicantPayload)
      .select('id')
      .single()

    if (error) throw error

    const appId = inserted?.id
    if (appId) {
      // Trigger LinkedIn verification in background
      verifyAndUpdateApplication(appId, linkedIn, applicantPayload).catch(() => {})
    }

    res.json({ success: true, id: appId })
  } catch (err) {
    console.error('Mentor application error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/mentors/book — "Book Mentor" request (replaces Cal.com) ────────
// All mentor sessions are conducted online — there is no mode selection.
// Saves a booking request in mentor_sessions (status: 'pending'), then
// notifies the student and admin by email (best-effort, non-blocking).
router.post('/api/mentors/book', requireAuth(), mentorBookLimiter, async (req, res) => {
  const user = req.authUser
  const {
    mentorId,
    contactName,
    contactEmail,
    contactPhone,
    classLevel,
    areaOfInterest,
    preferredLanguage,
    preferredDateTime,
    guidanceQuery,
  } = req.body

  if (!mentorId || !contactName || !contactEmail || !classLevel || !areaOfInterest || !preferredLanguage || !guidanceQuery) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please fill in all required fields.' })
  }

  // Demo/dev accounts (loginAsDemo on the frontend) use fake UUIDs that have
  // no matching auth.users row, so they can never satisfy the students
  // foreign key. Simulate success instead of attempting a real DB write.
  const authHeaderToken = (req.headers.authorization || '').split(' ')[1]
  if (authHeaderToken === 'demo-student-token' || authHeaderToken === 'demo-admin-token' || authHeaderToken === 'demo-mentor-token') {
    console.warn(`Mentor booking simulated for demo user ${user.email} — demo accounts are not persisted to the database`)
    return res.json({ success: true, simulated: true })
  }

  try {
    const client = getSupabaseClient(req.headers.authorization)

    const { data: mentorRow, error: mentorErr } = await client
      .from('mentors')
      .select('id, name')
      .eq('id', mentorId)
      .maybeSingle()
    if (mentorErr || !mentorRow) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Mentor not found.' })
    }

    // mentor_sessions.student_id references public.students(id), not
    // auth.users(id) directly. A user who is authenticated but has never
    // completed onboarding may not have a students row yet, which would
    // otherwise fail the insert below with a foreign key violation.
    const { data: existingStudent } = await client
      .from('students')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (!existingStudent) {
      await resilientUpsertStudent(client, { id: user.id, full_name: contactName })
    }

    const { data: booking, error: insertErr } = await client
      .from('mentor_sessions')
      .insert({
        student_id: user.id,
        mentor_id: mentorId,
        session_date: preferredDateTime || null,
        status: 'pending',
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || '',
        class_level: classLevel,
        area_of_interest: areaOfInterest,
        preferred_language: preferredLanguage,
        guidance_query: guidanceQuery,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    // Fire-and-forget email notifications — booking still succeeds if these fail.
    const mentorName = mentorRow.name || 'your mentor'
    sendEmail(
      contactEmail,
      'Your Mentor Session Request — Aage Kya?',
      `<p>Hi ${contactName},</p>
       <p>Your mentor session request with <strong>${mentorName}</strong> has been received.</p>
       <p>Further details will be shared with you at this email address once the mentor confirms.</p>
       <p><strong>What you asked for:</strong> ${guidanceQuery}</p>
       <p>— Team Aage Kya?</p>`
    ).catch(() => {})

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      sendEmail(
        adminEmail,
        'New Mentor Booking Request',
        `<p>A new mentor booking request was submitted.</p>
         <ul>
           <li><strong>Student:</strong> ${contactName} (${contactEmail})</li>
           <li><strong>Mentor:</strong> ${mentorName}</li>
           <li><strong>Class Level:</strong> ${classLevel}</li>
           <li><strong>Area of Interest:</strong> ${areaOfInterest}</li>
           <li><strong>Preferred Language:</strong> ${preferredLanguage}</li>
           <li><strong>Preferred Date/Time:</strong> ${preferredDateTime || 'Not specified'}</li>
           <li><strong>Guidance Needed:</strong> ${guidanceQuery}</li>
         </ul>`
      ).catch(() => {})
    }

    res.json({ success: true, booking })
  } catch (err) {
    console.error('Mentor booking error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Best-effort lookup of a mentor's account email via their linked user_id.
// Requires the service-role admin client; returns null if unavailable.
async function getMentorAccountEmail(userId) {
  if (!userId || !supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return null
    return data?.user?.email || null
  } catch {
    return null
  }
}

// ── POST /api/mentors/ask — "Ask Mentor" async question (replaces Chat Now) ──
// Stores the question, then notifies the admin and the assigned mentor.
router.post('/api/mentors/ask', mentorAskLimiter, async (req, res) => {
  const authUser = await getAuthUser(req.headers.authorization)
  const { mentorId, contactName, contactEmail, subject, category, question, classLevel } = req.body

  if (!mentorId || !contactName || !contactEmail || !subject || !category || !question) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please fill in all required fields.' })
  }

  const askToken = (req.headers.authorization || '').split(' ')[1]
  if (askToken === 'demo-student-token' || askToken === 'demo-admin-token' || askToken === 'demo-mentor-token') {
    console.warn(`Mentor question simulated for demo user (${contactEmail}) — demo mode`)
    return res.json({ success: true, simulated: true })
  }

  try {
    const client = supabaseAdmin || getSupabaseClient(req.headers.authorization)

    // Robust mentor lookup by ID or Name
    let mentorRow = null
    if (mentorId) {
      const { data } = await client.from('mentors').select('id, name, user_id').eq('id', mentorId).maybeSingle()
      mentorRow = data
    }

    if (!mentorRow) {
      const { data } = await client.from('mentors').select('id, name, user_id').limit(1).maybeSingle()
      mentorRow = data
    }

    if (!mentorRow) {
      mentorRow = { id: '00000000-0000-0000-0000-000000000003', name: 'Aage Kya Mentor', user_id: null }
    }

    // Ensure student row exists if authenticated
    const studentId = authUser?.id || null
    if (studentId) {
      await resilientUpsertStudent(client, { id: studentId, full_name: contactName }).catch(() => {})
    }

    const payload = {
      student_id: studentId,
      mentor_id: mentorRow.id,
      contact_name: contactName,
      contact_email: contactEmail,
      subject,
      category,
      question,
      class_level: classLevel || '',
      status: 'pending',
    }

    let { data: message, error: insertErr } = await client
      .from('mentor_messages')
      .insert(payload)
      .select()
      .maybeSingle()

    if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703' || /class_level/.test(insertErr.message || ''))) {
      const { class_level, ...noClassLevel } = payload
      const retry = await client.from('mentor_messages').insert(noClassLevel).select().maybeSingle()
      message = retry.data; insertErr = retry.error
    }

    if (insertErr && insertErr.code !== '23503') { // ignore FK fallback
      console.warn('[mentor ask warning]:', insertErr.message)
    }

    const mentorName = mentorRow.name || 'the mentor'

    // Notify the mentor (best-effort).
    const mentorEmail = await getMentorAccountEmail(mentorRow.user_id)
    if (mentorEmail) {
      sendEmail(
        mentorEmail,
        `New Student Question: ${subject}`,
        `<p>Hi ${mentorName},</p>
         <p>A student has sent you a question on Aage Kya?.</p>
         <ul>
           <li><strong>From:</strong> ${contactName} (${contactEmail})</li>
           ${classLevel ? `<li><strong>Class:</strong> ${classLevel}</li>` : ''}
           <li><strong>Category:</strong> ${category}</li>
           <li><strong>Subject:</strong> ${subject}</li>
         </ul>
         <p><strong>Question:</strong> ${question}</p>
         <p>Sign in to your Mentor Dashboard → Student Queries to reply.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    // Notify the admin (best-effort).
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      sendEmail(
        adminEmail,
        'New Ask Mentor Question',
        `<p>A student asked a mentor a question.</p>
         <ul>
           <li><strong>Student:</strong> ${contactName} (${contactEmail})</li>
           ${classLevel ? `<li><strong>Class:</strong> ${classLevel}</li>` : ''}
           <li><strong>Mentor:</strong> ${mentorName}</li>
           <li><strong>Category:</strong> ${category}</li>
           <li><strong>Subject:</strong> ${subject}</li>
         </ul>
         <p><strong>Question:</strong> ${question}</p>`
      ).catch(() => {})
    }

    res.json({ success: true, message })
  } catch (err) {
    console.error('Mentor ask error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/mentor/messages/:id/reply — mentor answers a question ─────────
router.patch('/api/mentor/messages/:id/reply', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const reply = (req.body?.reply || '').trim()
  const user = req.authUser
  if (!reply) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Reply cannot be empty.' })

  // Demo mentor — simulate a successful reply (no real rows to update).
  const replyToken = (req.headers.authorization || '').split(' ')[1]
  if (replyToken === 'demo-mentor-token') {
    return res.json({ success: true, simulated: true, message: { id, reply, status: 'answered', replied_at: new Date().toISOString() } })
  }

  try {
    // Verify the mentor owns the mentor profile the message is assigned to.
    const { data: mentorRow } = await supabase.from('mentors').select('id, name').eq('user_id', user.id).maybeSingle()
    if (!mentorRow) return res.status(403).json({ error: 'FORBIDDEN', message: 'No mentor profile found.' })

    const client = getSupabaseClient(req.headers.authorization)
    const { data: message, error } = await client
      .from('mentor_messages')
      .update({ reply, status: 'answered', replied_at: new Date().toISOString() })
      .eq('id', id)
      .eq('mentor_id', mentorRow.id)
      .select()
      .single()
    if (error) throw error

    // Notify the student their question was answered (best-effort).
    if (message?.contact_email) {
      sendEmail(
        message.contact_email,
        `Your Mentor Replied: ${message.subject || 'Your question'}`,
        `<p>Hi ${message.contact_name || 'there'},</p>
         <p><strong>${mentorRow.name}</strong> has replied to your question on Aage Kya?.</p>
         <p><strong>Your question:</strong> ${message.question}</p>
         <p><strong>Reply:</strong> ${reply}</p>
         <p>Sign in and open "My Mentor Requests" to see the full conversation.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true, message })
  } catch (err) {
    console.error('Mentor reply error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/mentor/messages — fetch student's own mentor requests ────────────
router.get('/api/mentor/messages', requireAuth(), async (req, res) => {
  const user = req.authUser
  try {
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('mentor_messages')
      .select('*, mentors(name, initials, college)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ messages: data || [] })
  } catch (err) {
    console.error('Fetch mentor messages error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/mentor/workspace — everything the mentor dashboard needs ─────────
// Returns the mentor's application status (approved | rejected | pending) plus,
// once their account is linked to an approved mentor profile, the student
// questions and booking requests they've received. Auto-claims a matching
// mentor profile by email on first visit.
router.get('/api/mentor/workspace', requireAuth(), async (req, res) => {
  const user = req.authUser
  const token = (req.headers.authorization || '').split(' ')[1]

  // Demo mentor — return a friendly simulated workspace so the UI is explorable.
  if (token === 'demo-mentor-token') {
    const nowIso = new Date().toISOString()
    return res.json({
      application: { status: 'approved', created_at: nowIso },
      mentor: {
        id: 'demo-mentor', name: 'Demo Mentor', initials: 'DM',
        college: 'IIT Bombay', degree: 'B.Tech CSE', stream_category: 'Science (PCM)',
        available: true, story: 'Here to help students navigate their choices.', linkedin: '',
        initials_bg: 'bg-indigo-500/20 text-indigo-300',
      },
      bookings: [],
      messages: [
        {
          id: 'demo-msg-1', subject: 'Confused between PCM and PCB',
          contact_name: 'Aarav Gupta', contact_email: 'aarav@example.com',
          category: 'Stream / Subject Choice',
          question: 'I enjoy biology but also like physics. How should I decide between PCM and PCB?',
          status: 'pending', reply: '', created_at: nowIso,
        },
      ],
    })
  }

  const admin = supabaseAdmin || getSupabaseClient(req.headers.authorization)
  try {
    // 1. Most recent application filed under this account's email.
    let application = null
    if (user.email) {
      const { data: apps } = await admin
        .from('mentor_applications')
        .select('id, name, email, status, rejection_reason, created_at')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
      application = (apps && apps[0]) || null
    }

    // 2. Mentor profile — linked by user_id first, else claim by matching email.
    let mentor = null
    const { data: byUser } = await admin.from('mentors').select('*').eq('user_id', user.id).maybeSingle()
    mentor = byUser || null

    if (!mentor && user.email) {
      // Guarded: the email column may not be migrated yet.
      try {
        const { data: byEmail } = await admin
          .from('mentors').select('*').eq('email', user.email).is('user_id', null).maybeSingle()
        if (byEmail) {
          const { data: claimed } = await admin
            .from('mentors').update({ user_id: user.id }).eq('id', byEmail.id).select().maybeSingle()
          mentor = claimed || byEmail
        }
      } catch (claimErr) {
        console.warn('[mentor workspace] claim-by-email skipped:', claimErr.message)
      }
    }

    // 3. Once linked to a real profile, make sure their role is 'mentor' so the
    //    reply endpoint (requireRole('mentor')) accepts them.
    if (mentor) {
      await admin.from('students').update({ role: 'mentor' }).eq('id', user.id)
    }

    // 4. Received questions + booking requests for the linked mentor.
    let messages = []
    let bookings = []
    if (mentor) {
      const { data: msgs } = await admin
        .from('mentor_messages').select('*').eq('mentor_id', mentor.id).order('created_at', { ascending: false })
      messages = msgs || []
      const { data: sess } = await admin
        .from('mentor_sessions').select('*').eq('mentor_id', mentor.id).order('created_at', { ascending: false })
      bookings = sess || []
    }

    res.json({ application, mentor, messages, bookings })
  } catch (err) {
    console.error('Mentor workspace error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/mentor/sessions/:id/respond — mentor accepts/declines a booking ─
// The mentor approves the request or declines it, optionally including a message
// (e.g. the time they're actually available). The student is notified by email
// and sees the status + message on their "My Mentor Requests" page.
router.patch('/api/mentor/sessions/:id/respond', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const user = req.authUser
  const status = (req.body?.status || '').trim()        // 'accepted' | 'declined' | 'rescheduled' | 'completed'
  const response = (req.body?.response || '').trim()     // mentor's note / availability / suggested time
  const allowed = ['accepted', 'declined', 'rescheduled', 'completed']
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid status.' })
  }
  if (status === 'rescheduled' && !response) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please suggest an alternative time in your message.' })
  }

  // Demo mentor — simulate success (no real rows to update).
  const token = (req.headers.authorization || '').split(' ')[1]
  if (token === 'demo-mentor-token') {
    return res.json({ success: true, simulated: true, booking: { id, status, mentor_response: response } })
  }

  try {
    const { data: mentorRow } = await supabase.from('mentors').select('id, name').eq('user_id', user.id).maybeSingle()
    if (!mentorRow) return res.status(403).json({ error: 'FORBIDDEN', message: 'No mentor profile found.' })

    const client = getSupabaseClient(req.headers.authorization)
    let { data: booking, error } = await client
      .from('mentor_sessions')
      .update({ status, mentor_response: response })
      .eq('id', id)
      .eq('mentor_id', mentorRow.id)
      .select()
      .single()
    // Fall back if the mentor_response column hasn't been migrated yet.
    if (error && (error.code === 'PGRST204' || error.code === '42703' || /mentor_response/.test(error.message || ''))) {
      console.warn('[mentor booking] mentor_response column missing — run supabase_mentor_dashboard_migration.sql. Updating status only.')
      const retry = await client
        .from('mentor_sessions').update({ status }).eq('id', id).eq('mentor_id', mentorRow.id).select().single()
      booking = retry.data; error = retry.error
    }
    if (error) throw error

    // Notify the student who booked (best-effort).
    if (booking?.contact_email) {
      const label = status === 'accepted' ? 'confirmed ✅'
        : status === 'declined' ? 'not available right now'
        : status === 'rescheduled' ? 'a new time was suggested 🕒'
        : status
      sendEmail(
        booking.contact_email,
        `Your Mentor Booking Update — Aage Kya?`,
        `<p>Hi ${booking.contact_name || 'there'},</p>
         <p><strong>${mentorRow.name}</strong> has responded to your session request. Status: <strong>${label}</strong>.</p>
         ${response ? `<p><strong>Message from your mentor:</strong> ${response}</p>` : ''}
         <p>Sign in and open "My Mentor Requests" to see the details.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true, booking })
  } catch (err) {
    console.error('Mentor booking respond error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})


export default router
