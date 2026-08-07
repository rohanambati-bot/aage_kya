import * as cheerio from 'cheerio'
import { distance } from 'fastest-levenshtein'
import { callLLM } from '../ai/llmClient.js'

/**
 * Calculates fuzzy string similarity between two names (0 to 100).
 * Uses a hybrid approach: Levenshtein distance + token set overlap.
 */
export function computeNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0

  const n1 = name1.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '')
  const n2 = name2.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '')

  if (n1 === n2) return 100

  // 1. Levenshtein ratio
  const maxLen = Math.max(n1.length, n2.length)
  if (maxLen === 0) return 100
  const levDist = distance(n1, n2)
  const levScore = Math.max(0, Math.round(((maxLen - levDist) / maxLen) * 100))

  // 2. Token overlap ratio
  const tokens1 = new Set(n1.split(/\s+/).filter(t => t.length > 1))
  const tokens2 = new Set(n2.split(/\s+/).filter(t => t.length > 1))

  if (tokens1.size === 0 || tokens2.size === 0) return levScore

  let intersection = 0
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++
  }
  const minTokens = Math.min(tokens1.size, tokens2.size)
  const maxTokens = Math.max(tokens1.size, tokens2.size)
  const subsetRatio = minTokens > 0 ? intersection / minTokens : 0
  const totalRatio = maxTokens > 0 ? intersection / maxTokens : 0
  
  // If all tokens of the smaller name are in the larger name, token score is 100
  const tokenScore = Math.round((subsetRatio * 0.7 + totalRatio * 0.3) * 100)

  // Return weighted average (60% token overlap, 40% Levenshtein)
  return Math.round(tokenScore * 0.6 + levScore * 0.4)
}

/**
 * Normalizes and extracts username slug from LinkedIn URL.
 * e.g., 'https://www.linkedin.com/in/priya-sharma-12345/' -> 'priya-sharma-12345'
 */
export function extractLinkedInSlug(url) {
  if (!url || typeof url !== 'string') return null
  const cleaned = url.trim()
  const match = cleaned.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i)
  return match ? match[1] : null
}

/**
 * Parses public LinkedIn profile HTML for key meta tags & content.
 */
export function parseLinkedInPublicHtml(html, applicantData = {}) {
  const $ = cheerio.load(html)

  const metaTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || ''
  const metaDescription = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || ''
  const metaImage = $('meta[property="og:image"]').attr('content') || ''
  const bodyText = $('body').text().slice(0, 5000) // first 5k chars for analysis

  // Extract name from OpenGraph title (e.g. "Priya Sharma - Senior Engineer - Google | LinkedIn")
  let extractedName = metaTitle.split(/[-–|]/)[0]?.trim() || ''

  // Clean common LinkedIn append strings
  extractedName = extractedName.replace(/\s*\(.*?\)\s*/g, '').replace(/LinkedIn/gi, '').trim()

  return {
    metaTitle,
    metaDescription,
    metaImage,
    extractedName,
    bodyText,
  }
}

/**
 * Verifies a mentor application against LinkedIn public data & URL heuristics.
 *
 * @param {string} linkedinUrl - LinkedIn profile URL provided by applicant
 * @param {Object} applicant - { name, profession, college, degree, stream_category, experience_years }
 * @param {Object} options - optional custom fetcher for unit testing
 * @returns {Promise<Object>} structured verification result
 */
export async function verifyLinkedInProfile(linkedinUrl, applicant = {}, options = {}) {
  const result = {
    verification_status: 'pending', // 'verified' | 'partial' | 'failed' | 'unverifiable'
    verification_badge: 'unverified',
    confidence: 0,
    linkedin_name_match_score: 0,
    verified_at: new Date().toISOString(),
    verification_source: 'linkedin',
    details: {
      urlProvided: linkedinUrl || '',
      slugExtracted: null,
      nameMatch: false,
      professionMatch: false,
      collegeMatch: false,
      linkedinName: null,
      headlineExtracted: null,
      profilePhotoUrl: null,
      summary: '',
    },
    rawError: null,
  }

  if (!linkedinUrl || typeof linkedinUrl !== 'string' || !linkedinUrl.trim()) {
    result.verification_status = 'unverifiable'
    result.verification_badge = 'unverified'
    result.details.summary = 'No LinkedIn URL provided by applicant.'
    return result
  }

  const slug = extractLinkedInSlug(linkedinUrl)
  result.details.slugExtracted = slug

  if (!slug) {
    result.verification_status = 'unverifiable'
    result.verification_badge = 'unverified'
    result.details.summary = 'URL is not a standard LinkedIn profile link (expected linkedin.com/in/username).'
    return result
  }

  // Calculate slug name match (slug e.g. "priya-sharma-ba123")
  const slugName = slug.replace(/-[a-f0-9]{4,10}$/i, '').replace(/[-_]/g, ' ')
  const slugMatchScore = computeNameSimilarity(applicant.name || '', slugName)

  try {
    const customFetch = options.fetchFn || fetch
    const targetUrl = linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`

    const response = await customFetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000), // 6 second timeout
    }).catch(err => {
      return { ok: false, statusText: err.message }
    })

    if (response && response.ok && typeof response.text === 'function') {
      const html = await response.text()
      const parsed = parseLinkedInPublicHtml(html, applicant)

      result.details.linkedinName = parsed.extractedName
      result.details.headlineExtracted = parsed.metaDescription.slice(0, 200)
      result.details.profilePhotoUrl = parsed.metaImage

      // 1. Name match score
      const publicNameScore = computeNameSimilarity(applicant.name || '', parsed.extractedName)
      const nameScore = Math.max(publicNameScore, slugMatchScore)
      result.linkedin_name_match_score = nameScore
      result.details.nameMatch = nameScore >= 60

      // 2. Profession / role match check
      const profReq = (applicant.profession || applicant.stream_category || '').toLowerCase()
      const descText = (parsed.metaDescription + ' ' + parsed.bodyText).toLowerCase()
      let professionMatch = false
      if (profReq && profReq.length > 2) {
        const profTokens = profReq.split(/\s+/).filter(t => t.length > 2)
        const matchedTokens = profTokens.filter(t => descText.includes(t))
        professionMatch = matchedTokens.length > 0
      }
      result.details.professionMatch = professionMatch

      // 3. College / education match check
      const collegeReq = (applicant.college || applicant.degree || '').toLowerCase()
      let collegeMatch = false
      if (collegeReq && collegeReq.length > 2) {
        const collegeTokens = collegeReq.split(/\s+/).filter(t => t.length > 2)
        const matchedTokens = collegeTokens.filter(t => descText.includes(t))
        collegeMatch = matchedTokens.length > 0
      }
      result.details.collegeMatch = collegeMatch

      // 4. Call LLM for AI Verification Reasoning
      if (!options.skipLLM) {
        try {
          const verificationPrompt = `You are an AI Trust & Verification Analyst for "Aage Kya?", an AI career-guidance platform. Analyze applicant credentials against LinkedIn profile data and return JSON strictly matching the schema.

Compare the applicant credentials against scraped LinkedIn profile data:
Applicant Name: "${applicant.name || ''}"
Profession / Role: "${applicant.profession || ''}"
College / Univ: "${applicant.college || ''}"
Degree: "${applicant.degree || ''}"
Story / Bio: "${applicant.story || ''}"

Scraped LinkedIn Profile Data:
- Extracted Name: "${parsed.extractedName || slugName}"
- Headline / Description: "${parsed.metaDescription || ''}"
- Page Title: "${parsed.metaTitle || ''}"

Determine if the profile matches the applicant. Return JSON ONLY in this format:
{
  "confidence": 85,
  "verification_status": "verified",
  "aiReasoning": "Name matches Priya Sharma (95% similarity). LinkedIn bio confirms Senior Software Engineer at Google.",
  "nameMatchScore": 95
}`
          const aiResult = await callLLM(verificationPrompt, { json: true, temperature: 0.1, callType: 'linkedin_verify' })
          if (aiResult && typeof aiResult.confidence === 'number') {
            result.confidence = aiResult.confidence
            result.verification_status = aiResult.verification_status || (aiResult.confidence >= 70 ? 'verified' : aiResult.confidence >= 40 ? 'partial' : 'failed')
            result.verification_badge = result.verification_status === 'verified' ? 'verified' : result.verification_status === 'partial' ? 'partial' : 'failed'
            result.details.summary = `🤖 AI Reasoning: ${aiResult.aiReasoning || 'Analysis complete.'}`
            if (aiResult.nameMatchScore) result.linkedin_name_match_score = aiResult.nameMatchScore
            return result
          }
        } catch (aiErr) {
          console.warn('[linkedinVerifier] LLM check fallback to fuzzy engine:', aiErr.message)
        }
      }

      // Calculate final composite confidence
      // Name: 50%, Profession: 30%, College/Edu: 20%
      let confidence = Math.round(nameScore * 0.5 + (professionMatch ? 30 : 0) + (collegeMatch ? 20 : 0))
      result.confidence = confidence

      if (confidence >= 70 && nameScore >= 65) {
        result.verification_status = 'verified'
        result.verification_badge = 'verified'
        result.details.summary = `Verified via LinkedIn profile. High identity match (${nameScore}% name match).`
      } else if (confidence >= 40 || nameScore >= 50) {
        result.verification_status = 'partial'
        result.verification_badge = 'partial'
        result.details.summary = `Partial verification. LinkedIn profile found (${nameScore}% name match), requires admin sanity check.`
      } else {
        result.verification_status = 'failed'
        result.verification_badge = 'failed'
        result.details.summary = `Verification check failed. Name on LinkedIn ("${parsed.extractedName}") differs from application ("${applicant.name}").`
      }

      return result
    }
  } catch (err) {
    result.rawError = err.message
  }

  // Fallback to URL Slug heuristics when LinkedIn blocks public scrape (Auth Wall / 429 / CAPTCHA)
  result.linkedin_name_match_score = slugMatchScore
  result.details.nameMatch = slugMatchScore >= 65

  if (slugMatchScore >= 75) {
    result.confidence = Math.round(slugMatchScore * 0.8)
    result.verification_status = 'verified'
    result.verification_badge = 'verified'
    result.details.summary = `Verified via LinkedIn Profile URL handle (${slugMatchScore}% name match with username "${slug}").`
  } else if (slugMatchScore >= 50) {
    result.confidence = 50
    result.verification_status = 'partial'
    result.verification_badge = 'partial'
    result.details.summary = `LinkedIn profile link confirmed (username "${slug}"). Name match score ${slugMatchScore}%.`
  } else {
    result.confidence = 25
    result.verification_status = 'unverifiable'
    result.verification_badge = 'unverified'
    result.details.summary = `LinkedIn profile provided (username "${slug}"), but handle does not closely match applicant name ("${applicant.name}").`
  }

  return result
}
