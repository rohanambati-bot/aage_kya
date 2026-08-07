import { supabase, isSupabaseConfigured } from './db.js'

// Reuse labels from frontend structure
export const INCOME_LABELS = {
  'below_2.5L': 'Below ₹2.5 Lakh/yr',
  '2.5L-5L':   '₹2.5L–₹5L/yr',
  '5L-10L':    '₹5L–₹10L/yr',
  'above_10L': 'Above ₹10L/yr',
}
export const CITY_LABELS = {
  same_city: 'Same City',
  nearby:    'Nearby Cities',
  anywhere:  'Anywhere in India',
}
// Income upper bounds in lakh (for scholarship eligibility filtering)
export const INCOME_TO_LAKH = {
  'below_2.5L': 2.5,
  '2.5L-5L':   5,
  '5L-10L':    10,
  'above_10L': 99,
}

// Fetch real colleges for this student from the DB
export async function fetchCollegesForStudent(form) {
  if (!isSupabaseConfigured()) return []
  const marks        = Number(form.marks) || 0
  const stream       = form.stream || ''
  const state        = form.state  || ''
  const classLevel   = form.classLevel || 'class12'
  
  // New fields
  const preferredState = form.preferredState || ''
  const preferredCity  = (form.preferredCity  || '').trim().toLowerCase()
  const budget         = form.budget || ''
  const mode           = form.preferredModeOfAdmission || ''

  try {
    // Fetch all colleges matching this stream (GIN index makes this fast)
    const { data, error } = await supabase
      .from('colleges')
      .select('name, state, city, yearly_cost_min, yearly_cost_max, college_type, national, source_url, min_marks, max_marks')
      .contains('streams', [stream])

    if (error) { console.warn('College fetch warning:', error.message); return [] }

    const collegesWithScores = (data || []).map(c => {
      let score = 0

      // 1. Marks compatibility score (primary eligibility check)
      const isWithinRange = (c.min_marks <= marks + 15) && (c.max_marks >= marks - 10)
      if (!isWithinRange) {
        // Still compatible but penalized if outside marks compatibility band
        score -= 20
      } else {
        score += 15
        if (marks >= c.min_marks && marks <= c.max_marks) {
          score += 10 // Perfect fit
        }
      }

      // 2. Preferred State compatibility
      if (preferredState && preferredState !== 'Any State') {
        if (c.state === preferredState) {
          score += 25
        } else if (c.national) {
          score += 5 // National institutions are still good candidates
        } else {
          score -= 10 // Penalize if it doesn't match preferred state
        }
      } else {
        // Fallback to home state matching if no preferredState is specified
        if (c.state === state) {
          score += 10
        }
      }

      // 3. Preferred City compatibility
      if (preferredCity && preferredCity !== 'any') {
        const collegeCity = c.city.toLowerCase()
        if (collegeCity.includes(preferredCity) || preferredCity.includes(collegeCity)) {
          score += 25
        }
      }

      // 4. Budget Compatibility
      // Budget limits (INR per year)
      let budgetLimit = 9999999
      if (classLevel === 'class10') {
        if (budget === 'below_20k') budgetLimit = 20000
        else if (budget === '20k-60k') budgetLimit = 60000
        else if (budget === '60k-1.5L') budgetLimit = 150000
      } else {
        if (budget === 'below_1L') budgetLimit = 100000
        else if (budget === '1L-3L') budgetLimit = 300000
        else if (budget === '3L-6L') budgetLimit = 600000
      }

      // Compare college cost with budget limit
      if (c.yearly_cost_min > budgetLimit) {
        score -= 30 // Strong penalty if min cost exceeds budget
      } else if (c.yearly_cost_max <= budgetLimit) {
        score += 15 // Good fit: max cost is within budget
      } else {
        score += 5 // Partial fit: min is within, max exceeds
      }

      // 5. Preferred Mode of Admission / Target Exam compatibility (Class 12)
      if (classLevel === 'class12' && mode) {
        const nameUpper = c.name.toUpperCase()
        if (mode === 'JEE Advanced') {
          // IITs
          if (nameUpper.startsWith('IIT') || nameUpper.includes('INDIAN INSTITUTE OF TECHNOLOGY')) {
            score += 35
          } else {
            score -= 15
          }
        } else if (mode === 'JEE Main') {
          // NITs, IIITs, DTU, NSUT, or national-intake institutions
          if (nameUpper.includes('NIT') || nameUpper.includes('NATIONAL INSTITUTE OF TECHNOLOGY') || nameUpper.includes('IIIT') || nameUpper.includes('DTU') || nameUpper.includes('NSUT') || c.national) {
            score += 35
          }
        } else if (mode === 'NEET') {
          // Medical institutions
          if (nameUpper.includes('AIIMS') || nameUpper.includes('MEDICAL') || nameUpper.includes('JIPMER') || nameUpper.includes('CMC') || nameUpper.includes('MEDICINE') || stream === 'Science (PCB)') {
            score += 35
          }
        } else if (mode === 'KCET') {
          // Karnataka state colleges
          if (c.state === 'Karnataka') {
            score += 35
          } else {
            score -= 15
          }
        } else if (mode === 'COMEDK') {
          // Karnataka private/deemed colleges
          if (c.state === 'Karnataka' && (c.college_type === 'private' || c.college_type === 'deemed')) {
            score += 35
          } else {
            score -= 15
          }
        } else if (mode === 'CUET') {
          // Central universities (Arts/Commerce focus or Central college type)
          if (c.college_type === 'central' || nameUpper.includes('COLLEGE DELHI') || nameUpper.includes('UNIVERSITY OF DELHI') || nameUpper.includes('JNU') || nameUpper.includes('BHU')) {
            score += 35
          }
        } else if (mode === 'Management Quota') {
          // Private / Deemed colleges
          if (c.college_type === 'private' || c.college_type === 'deemed') {
            score += 25
          }
        } else if (mode === 'State CET') {
          // State government colleges matching preferred or home state
          if (c.college_type === 'state' && (c.state === preferredState || c.state === state)) {
            score += 35
          }
        } else if (mode === 'Diploma Lateral Entry') {
          // State/private colleges accepting lateral entry
          if (c.college_type === 'state' || c.college_type === 'private') {
            score += 20
          }
        }
      }

      return { college: c, score }
    })

    // Filter, sort by score descending, and slice top 15
    return collegesWithScores
      .filter(x => x.score >= -10) // Filter out extremely poor fits
      .sort((a, b) => b.score - a.score)
      .map(x => x.college)
      .slice(0, 15)

  } catch (err) {
    console.warn('College fetch failed:', err.message)
    return []
  }
}

// Fetch relevant scholarships for this student from the DB
export async function fetchScholarshipsForStudent(form) {
  if (!isSupabaseConfigured()) return []
  const marks       = Number(form.marks) || 0
  const incomeLakh  = INCOME_TO_LAKH[form.incomeRange] || 99
  const stream      = form.stream || ''
  const state       = form.state  || ''

  try {
    const { data, error } = await supabase
      .from('scholarships')
      .select('name, description, application_url, deadline_pattern, eligibility_marks_min, eligibility_income_max_lakh, eligible_streams, eligible_states')

    if (error) { console.warn('Scholarship fetch warning:', error.message); return [] }

    return (data || []).filter(s => {
      const streams = s.eligible_streams || []
      const states  = s.eligible_states  || []
      const streamOk = streams.includes('All') || streams.length === 0 || streams.includes(stream)
      const stateOk  = states.includes('All')  || states.length === 0  || states.includes(state)
      const marksOk  = (s.eligibility_marks_min || 0) <= marks
      const incomeOk = (s.eligibility_income_max_lakh || 99) >= incomeLakh
      return streamOk && stateOk && marksOk && incomeOk
    }).slice(0, 8)
  } catch (err) {
    console.warn('Scholarship fetch failed:', err.message)
    return []
  }
}

// Format colleges as a numbered text block for injection into the prompt
export function formatCollegesForPrompt(colleges) {
  if (!colleges.length) return ''
  return colleges.map((c, i) => {
    const costMin = Math.round(c.yearly_cost_min / 1000)
    const costMax = Math.round(c.yearly_cost_max / 1000)
    return `${i + 1}. ${c.name} (${c.city}, ${c.state}) | ₹${costMin}K–₹${costMax}K/yr | ${c.college_type} | Entry ~${c.min_marks}%+`
  }).join('\n')
}

// Format scholarships as a numbered text block for injection into the prompt
export function formatScholarshipsForPrompt(scholarships) {
  if (!scholarships.length) return ''
  return scholarships.map((s, i) => {
    const desc = s.description.length > 100 ? s.description.slice(0, 100) + '…' : s.description
    return `${i + 1}. ${s.name}: ${desc} | Apply: ${s.application_url}`
  }).join('\n')
}

// Build a lookup map: college name → { source_url, yearly_cost_min, yearly_cost_max, city }
export function buildCollegesDataMap(colleges) {
  const map = {}
  for (const c of colleges) {
    map[c.name] = {
      source_url:      c.source_url,
      yearly_cost_min: c.yearly_cost_min,
      yearly_cost_max: c.yearly_cost_max,
      city:            c.city,
      state:           c.state,
      college_type:    c.college_type,
    }
  }
  return map
}

// Find the scholarship object whose name best matches what Gemini chose
export function matchScholarship(scholarships, chosenName) {
  if (!chosenName || !scholarships.length) return null
  const lower = chosenName.toLowerCase()
  // Exact match first
  let match = scholarships.find(s => s.name.toLowerCase() === lower)
  if (match) return match
  // Partial match — find the one with the most word overlap
  const words = lower.split(/\s+/).filter(w => w.length > 3)
  let best = null, bestScore = 0
  for (const s of scholarships) {
    const sLower = s.name.toLowerCase()
    const score = words.filter(w => sLower.includes(w)).length
    if (score > bestScore) { bestScore = score; best = s }
  }
  return bestScore > 0 ? best : scholarships[0] // fallback to first if no match
}
