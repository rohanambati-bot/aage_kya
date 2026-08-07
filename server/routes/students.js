import express from 'express'
import { getSupabaseClient, guidanceWriter, datastoreError, resilientUpsertStudent } from '../utils/db.js'
import { requireAuth, getAuthUser } from '../middleware/auth.js'

const router = express.Router()

router.post('/api/sync', async (req, res) => {
  try {
    const { formData, result } = req.body
    if (!formData || !result) {
      return res.status(400).json({ error: 'Missing formData or result' })
    }

    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)

    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Auth token is invalid or missing' })
    }

    const client = getSupabaseClient(authHeader)

    // Upsert Student Profile
    await resilientUpsertStudent(client, {
      id: user.id,
      full_name: formData.fullName || '',
      state: formData.state || '',
      board: formData.board || '',
      stream: formData.stream || '',
      marks: Number(formData.marks) || 0,
      income_range: formData.incomeRange || '',
      first_gen_college: formData.firstGenCollege === true,
      preferred_cities: formData.preferredCities || [],
      interests: formData.interests || '',
      biggest_fear: formData.biggestFear || '',
      class_level: formData.classLevel || 'class12',
      parent_pressure: formData.parentPressure === true,
      parent_expectations: formData.parentExpectations || '',
      risk_comfort: formData.riskComfort || '',
      coaching_access: formData.coachingAccess === true,
      updated_at: new Date().toISOString()
    })

    // Upsert Guidance Results
    const { data: existing } = await client
      .from('guidance_results')
      .select('id')
      .eq('student_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!existing) {
      const admin = guidanceWriter()
      const { error: guidanceWriteError } = await admin.from('guidance_results').insert({
        student_id: user.id,
        summary: result.summary,
        options: result.options,
        scholarship_to_check: result.scholarship_to_check,
        one_thing_to_do_this_week: result.one_thing_to_do_this_week
      })
      if (guidanceWriteError) throw datastoreError('Guidance result write', guidanceWriteError)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Sync API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Academic Wallet Update Endpoint
router.post('/api/re-onboard', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Auth token is invalid or missing' })
    }

    const client = getSupabaseClient(authHeader)

    // Fetch current student profile
    const { data: student, error: studentErr } = await client
      .from('students')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (studentErr) throw studentErr
    if (!student) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found' })
    }

    // Fetch latest guidance result
    const { data: guidance, error: guidanceErr } = await client
      .from('guidance_results')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (guidanceErr) throw guidanceErr

    // Fetch roadmaps
    const { data: roadmaps, error: roadmapsErr } = await client
      .from('roadmaps')
      .select('*')
      .eq('student_id', user.id)

    if (roadmapsErr) throw roadmapsErr

    // Only archive if there is actually some guidance content to archive
    if (guidance) {
      const snapshot = {
        timestamp: new Date().toISOString(),
        profile: {
          fullName: student.full_name,
          state: student.state,
          board: student.board,
          stream: student.stream,
          marks: student.marks,
          incomeRange: student.income_range,
          firstGenCollege: student.first_gen_college,
          preferredCities: student.preferred_cities,
          interests: student.interests,
          biggestFear: student.biggest_fear,
          classLevel: student.class_level,
          parentPressure: student.parent_pressure,
          parentExpectations: student.parent_expectations,
          riskComfort: student.risk_comfort,
          coachingAccess: student.coaching_access
        },
        guidance: {
          summary: guidance.summary,
          options: guidance.options,
          scholarship_to_check: guidance.scholarship_to_check,
          one_thing_to_do_this_week: guidance.one_thing_to_do_this_week,
          created_at: guidance.created_at
        },
        roadmaps: (roadmaps || []).map(r => ({
          career_path: r.career_path,
          overview: r.overview,
          years: r.years,
          created_at: r.created_at
        }))
      }

      const history = Array.isArray(student.history) ? student.history : []
      const updatedHistory = [snapshot, ...history].slice(0, 5)

      // Update student profile history
      const { error: updateErr } = await client
        .from('students')
        .update({ history: updatedHistory })
        .eq('id', user.id)

      if (updateErr) throw updateErr

      // Delete current guidance results & roadmaps so user can re-generate a new
      // cache. Server-authored rows are removed via the service-role writer.
      const admin = guidanceWriter()
      const [{ error: guidanceDeleteError }, { error: roadmapDeleteError }] = await Promise.all([
        admin.from('guidance_results').delete().eq('student_id', user.id),
        admin.from('roadmaps').delete().eq('student_id', user.id)
      ])
      if (guidanceDeleteError) throw datastoreError('Guidance result delete', guidanceDeleteError)
      if (roadmapDeleteError) throw datastoreError('Roadmap delete', roadmapDeleteError)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Re-onboard API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

router.get('/api/student/bookings', requireAuth(), async (req, res) => {
  const user = req.authUser
  const token = (req.headers.authorization || '').split(' ')[1]
  if (token === 'demo-student-token' || token === 'demo-admin-token' || token === 'demo-mentor-token') {
    return res.json({ bookings: [] })
  }
  try {
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('mentor_sessions')
      .select('*, mentors(name, initials, college)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ bookings: data || [] })
  } catch (err) {
    console.error('Fetch student bookings error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Transcription Endpoint (Phase 7 — Voice Input)
// Uses Groq Whisper (whisper-large-v3) — accepts base64 audio from the client

export default router
