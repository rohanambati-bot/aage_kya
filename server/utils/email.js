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
