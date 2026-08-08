/**
 * Escape a value for safe interpolation into an HTML email body.
 *
 * Notification emails embed user-supplied values (applicant name, question
 * text, rejection reason, guidance query) directly into HTML. Unescaped, a
 * mentor applicant or student could inject markup/links into an email that the
 * admin or another user reads — an HTML-injection/phishing vector delivered
 * from a trusted sender address.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: 'Aage Kya? <noreply@aagekya.in>', to, subject, html }),
    })
    const data = await res.json()
    if (!res.ok) console.error('[email] Resend error:', data)
    else console.log(`[email] Sent "${subject}" to ${to}`)
  } catch (err) {
    console.error('[email] Send failed:', err.message)
  }
}
