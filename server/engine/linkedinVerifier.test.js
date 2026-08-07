import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeNameSimilarity,
  extractLinkedInSlug,
  parseLinkedInPublicHtml,
  verifyLinkedInProfile,
} from './linkedinVerifier.js'

test('computeNameSimilarity — exact match', () => {
  const score = computeNameSimilarity('Priya Sharma', 'Priya Sharma')
  assert.equal(score, 100)
})

test('computeNameSimilarity — slight variations & case differences', () => {
  const score = computeNameSimilarity('Priya Sharma', 'priya sharma')
  assert.equal(score, 100)
})

test('computeNameSimilarity — extra middle name', () => {
  const score = computeNameSimilarity('Aditya Kumar Verma', 'Aditya Verma')
  assert.ok(score >= 70, `Expected score >= 70, got ${score}`)
})

test('computeNameSimilarity — completely different names', () => {
  const score = computeNameSimilarity('Rohan Ambathi', 'Priya Sharma')
  assert.ok(score < 30, `Expected score < 30, got ${score}`)
})

test('extractLinkedInSlug — valid profile URLs', () => {
  assert.equal(
    extractLinkedInSlug('https://www.linkedin.com/in/priya-sharma-12345/'),
    'priya-sharma-12345'
  )
  assert.equal(
    extractLinkedInSlug('linkedin.com/in/aditya-verma'),
    'aditya-verma'
  )
})

test('extractLinkedInSlug — invalid URLs', () => {
  assert.equal(extractLinkedInSlug('https://google.com'), null)
  assert.equal(extractLinkedInSlug(''), null)
  assert.equal(extractLinkedInSlug(null), null)
})

test('parseLinkedInPublicHtml — parses OG tags correctly', () => {
  const sampleHtml = `
    <html>
      <head>
        <meta property="og:title" content="Priya Sharma - Senior Software Engineer - Google | LinkedIn" />
        <meta property="og:description" content="Priya Sharma. Senior Software Engineer at Google. Alumni of RVCE B.Tech CSE." />
        <meta property="og:image" content="https://media.licdn.com/dms/image/sample.jpg" />
      </head>
      <body>
        <h1>Priya Sharma</h1>
        <p>Google Software Engineering RVCE</p>
      </body>
    </html>
  `
  const parsed = parseLinkedInPublicHtml(sampleHtml, { name: 'Priya Sharma' })
  assert.equal(parsed.extractedName, 'Priya Sharma')
  assert.equal(parsed.metaImage, 'https://media.licdn.com/dms/image/sample.jpg')
  assert.ok(parsed.metaDescription.includes('Google'))
})

test('verifyLinkedInProfile — returns verified status for high match profile', async () => {
  const sampleHtml = `
    <html>
      <head>
        <meta property="og:title" content="Priya Sharma - Senior Software Engineer | LinkedIn" />
        <meta property="og:description" content="Priya Sharma is a Senior Software Engineer at Google. RVCE B.Tech CSE." />
      </head>
    </html>
  `
  const mockFetch = async () => ({
    ok: true,
    text: async () => sampleHtml,
  })

  const res = await verifyLinkedInProfile(
    'https://www.linkedin.com/in/priya-sharma/',
    {
      name: 'Priya Sharma',
      profession: 'Senior Software Engineer',
      college: 'RVCE',
      degree: 'B.Tech CSE',
    },
    { fetchFn: mockFetch }
  )

  assert.equal(res.verification_status, 'verified')
  assert.equal(res.verification_badge, 'verified')
  assert.ok(res.confidence >= 70)
  assert.equal(res.details.nameMatch, true)
})

test('verifyLinkedInProfile — handles empty or missing LinkedIn URL', async () => {
  const res = await verifyLinkedInProfile('', { name: 'Test User' })
  assert.equal(res.verification_status, 'unverifiable')
  assert.equal(res.verification_badge, 'unverified')
})
