import express from 'express'
import { supabase, supabaseAdmin } from '../utils/db.js'
import { requireRole } from '../middleware/auth.js'
import { verifyAndUpdateApplication } from '../utils/mentorHelpers.js'
import { sendEmail } from '../utils/email.js'

const router = express.Router()

// GET /api/admin/mentor-bookings — Fetch all "Book Mentor" requests
router.get('/mentor-bookings', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('mentor_sessions')
      .select('*, mentors(name, initials, stream_category)')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ bookings: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// GET /api/admin/mentor-messages — Fetch all student -> mentor questions (monitoring)
router.get('/mentor-messages', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('mentor_messages')
      .select('*, mentors(name, initials)')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ messages: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// GET /api/admin/mentor-applications — Fetch all applications
router.get('/mentor-applications', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('mentor_applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ applications: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/mentor-applications/:id/reverify — Trigger on-demand re-verification of LinkedIn profile
router.post('/mentor-applications/:id/reverify', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const client = supabaseAdmin || supabase
  try {
    const { data: app, error: fetchErr } = await client
      .from('mentor_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !app) return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found' })

    const vResult = await verifyAndUpdateApplication(id, app.linkedin, app)
    res.json({ success: true, verification: vResult })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/mentor-applications/:id/approve — Approve a mentor application
router.post('/mentor-applications/:id/approve', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const adminUser = req.authUser
  const client = supabaseAdmin || supabase
  try {
    // 1. Get the application details
    const { data: app, error: getErr } = await client
      .from('mentor_applications')
      .select('*')
      .eq('id', id)
      .single()
    if (getErr || !app) return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found' })

    // If verification was pending or never run, run it now
    if (!app.verification_status || app.verification_status === 'pending') {
      await verifyAndUpdateApplication(id, app.linkedin, app).catch(() => {})
    }

    // 2. Insert into public.mentors
    const initials = app.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3) || 'M'
    
    // Choose a gradient/styling based on degree
    const styles = [
      { gradient: 'from-blue-500/30 to-blue-600/10', border: 'border-blue-500/25', tag_color: 'bg-blue-500/10 text-blue-300 border-blue-500/20', initials_bg: 'bg-blue-500/20 text-blue-300' },
      { gradient: 'from-amber-500/30 to-amber-600/10', border: 'border-amber-500/25', tag_color: 'bg-amber-500/10 text-amber-300 border-amber-500/20', initials_bg: 'bg-amber-500/20 text-amber-300' },
      { gradient: 'from-emerald-500/30 to-emerald-600/10', border: 'border-emerald-500/25', tag_color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', initials_bg: 'bg-emerald-500/20 text-emerald-300' }
    ]
    const chosenStyle = styles[Math.floor(Math.random() * styles.length)]

    const isVerified = app.verification_status === 'verified' || app.verification_status === 'partial'
    const verificationBadge = app.verification_status === 'verified' ? 'verified' : app.verification_status === 'partial' ? 'partial' : 'unverified'

    const mentorRow = {
      name: app.name,
      initials,
      college: app.college || app.profession || 'N/A',
      degree: app.degree || app.profession || 'N/A',
      stream: app.stream_transition || app.stream_category || 'General',
      stream_category: app.stream_category || 'Other',
      city: 'Online',
      linkedin: app.linkedin || '',
      story: app.story,
      email: app.email || null,      // link key: matches the mentor's login email
      tags: [app.degree || app.profession || 'Mentor', 'Approved', isVerified ? 'Verified' : 'Reviewer Approved'],
      available: true,
      is_verified: isVerified,
      verification_badge: verificationBadge,
      linkedin_name_match_score: app.linkedin_name_match_score || 0,
      ...chosenStyle
    }

    let { error: insertErr } = await client.from('mentors').insert(mentorRow)
    if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703')) {
      console.warn('[mentor approve] Extended columns missing in mentors table — inserting basic mentor row.')
      const { is_verified, verification_badge, linkedin_name_match_score, email, ...basicRow } = mentorRow
      const retry = await client.from('mentors').insert(basicRow)
      insertErr = retry.error
    }
    if (insertErr && insertErr.code !== '23505') { // ignore duplicate name error
      throw insertErr
    }

    // 3. Update application status to approved
    let { error: updateErr } = await client
      .from('mentor_applications')
      .update({
        status: 'approved',
        approved_by: adminUser?.id || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateErr && (updateErr.code === 'PGRST204' || updateErr.code === '42703' || updateErr.message?.includes('approved_by') || updateErr.message?.includes('schema cache'))) {
      console.warn('[mentor approve] approved_by/approved_at column missing — updating status only.')
      const retry = await client
        .from('mentor_applications')
        .update({ status: 'approved' })
        .eq('id', id)
      updateErr = retry.error
    }

    if (updateErr) throw updateErr

    // 3b. Best-effort: link applicant account & set role to 'mentor'
    if (app.email) {
      try {
        if (supabaseAdmin) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers()
          const acct = (list?.users || []).find(u => (u.email || '').toLowerCase() === app.email.toLowerCase())
          if (acct) {
            await supabaseAdmin.from('mentors').update({ user_id: acct.id }).eq('name', app.name)
            await supabaseAdmin.from('students').update({ role: 'mentor' }).eq('id', acct.id)
          }
        } else {
          // Direct students role update by email matching
          await client.from('students').update({ role: 'mentor' }).eq('id', app.email)
        }
      } catch (linkErr) {
        console.warn('[mentor approve] account auto-link skipped:', linkErr.message)
      }
    }

    // Notify the applicant that they've been approved (best-effort).
    if (app.email) {
      sendEmail(
        app.email,
        'Your Mentor Application Was Approved — Aage Kya?',
        `<p>Hi ${app.name},</p>
         <p>Great news — your application to become a mentor on Aage Kya? has been <strong>approved</strong>.</p>
         <p>Your profile is now live and students can book sessions with you. Welcome aboard!</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[mentor approve error]:', err)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/mentor-applications/:id/reject — Reject a mentor application
// Accepts an optional { reason } so the applicant is told why.
router.post('/mentor-applications/:id/reject', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const reason = (req.body?.reason || '').trim()
  const client = supabaseAdmin || supabase
  try {
    // Fetch applicant details for the notification email.
    const { data: app } = await client
      .from('mentor_applications')
      .select('name, email')
      .eq('id', id)
      .maybeSingle()

    let { error } = await client
      .from('mentor_applications')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', id)
    // If the rejection_reason column hasn't been migrated yet, fall back to
    // updating just the status so the reject still succeeds (the reason is
    // still delivered to the applicant by email below).
    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('rejection_reason'))) {
      console.warn('[mentor reject] rejection_reason column missing — run supabase_mentor_application_fields.sql. Falling back to status-only update.')
      const retry = await client
        .from('mentor_applications')
        .update({ status: 'rejected' })
        .eq('id', id)
      error = retry.error
    }
    if (error) throw error

    // Notify the applicant with the rejection reason (best-effort).
    if (app?.email) {
      sendEmail(
        app.email,
        'Update on Your Mentor Application — Aage Kya?',
        `<p>Hi ${app.name || 'there'},</p>
         <p>Thank you for applying to become a mentor on Aage Kya?. After review, we're
         unable to approve your application at this time.</p>
         ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
         <p>You're welcome to apply again in the future. Thank you for your interest in
         helping students.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// GET /api/admin/course-feedback — Fetch all course feedback
router.get('/course-feedback', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('course_feedback')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ feedback: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/course-feedback/:id/approve — Approve a feedback entry
router.post('/course-feedback/:id/approve', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const client = supabaseAdmin || supabase
  try {
    const { error } = await client
      .from('course_feedback')
      .update({ approved: true })
      .eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// DELETE /api/admin/course-feedback/:id — Delete a feedback entry
router.delete('/course-feedback/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const client = supabaseAdmin || supabase
  try {
    const { error } = await client
      .from('course_feedback')
      .delete()
      .eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

export default router
