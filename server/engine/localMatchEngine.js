import {
  MATCH_WEIGHTS,
  MATCH_TIER_HIGH,
  MATCH_TIER_MODERATE,
  SIZE_SMALL_MAX,
  SIZE_MID_MAX,
  LOCATION_FULL_SCORE_KM,
  LOCATION_FLOOR_KM,
  LOCATION_FLOOR_SCORE,
  NEIGHBOURING_STATES,
  BUDGET_BANDS,
} from '../config/matchConfig.js'

/**
 * Haversine formula to compute great-circle distance between two (lat, lng) points in km.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1)
  const nLon1 = Number(lon1)
  const nLat2 = Number(lat2)
  const nLon2 = Number(lon2)

  if (![nLat1, nLon1, nLat2, nLon2].every(Number.isFinite)) {
    return null
  }

  const R = 6371 // Earth radius in km
  const dLat = (nLat2 - nLat1) * (Math.PI / 180)
  const dLon = (nLon2 - nLon1) * (Math.PI / 180)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) *
      Math.cos(nLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Academic Fit Score (0–100)
 * Compares student marks or rank against college cutoff.
 * If cutoff data is missing or undefined, returns a neutral fallback of 50.
 */
export function computeAcademicFit(studentProfile = {}, college = {}) {
  const cutoff = college.min_marks ?? college.cutoff ?? null

  if (cutoff === null || cutoff === undefined || !Number.isFinite(Number(cutoff))) {
    return 50 // Graceful fallback for missing cutoff data
  }

  const cutoffNum = Number(cutoff)
  const marks = Number(studentProfile.marks)

  if (Number.isFinite(marks) && marks > 0) {
    if (marks >= cutoffNum) {
      return 100
    }
    // Scale down linearly: if marks is within 30% below cutoff, scale from 100 down to 0
    const gap = cutoffNum - marks
    if (gap >= 30) return 0
    return Math.max(0, Math.round(100 - (gap / 30) * 100))
  }

  // If student rank is provided
  const rank = Number(studentProfile.rank)
  const collegeClosingRank = Number(college.closing_rank ?? college.cutoff_rank)

  if (Number.isFinite(rank) && rank > 0 && Number.isFinite(collegeClosingRank) && collegeClosingRank > 0) {
    if (rank <= collegeClosingRank) {
      return 100
    }
    const ratio = rank / collegeClosingRank
    if (ratio >= 2) return 0
    return Math.max(0, Math.round(100 - (ratio - 1) * 100))
  }

  return 50
}

/**
 * Compute interest vector from quiz answers and question bank.
 * returns an object map of domainId -> numerical weight score.
 */
export function computeInterestVector(quizAnswers = [], questionBank = []) {
  const vector = {}
  if (!Array.isArray(quizAnswers)) return vector

  const qMap = new Map((questionBank || []).map((q) => [q.id, q]))

  for (const item of quizAnswers) {
    const { questionId, answer, optionIndex } = item
    const question = qMap.get(questionId)
    if (!question || !question.weightMap) continue

    let weights = null
    if (question.type === 'yes_no') {
      weights = question.weightMap[answer]
    } else if (question.type === 'single_select' && optionIndex !== undefined) {
      weights = question.weightMap[optionIndex] || question.weightMap[answer]
    } else {
      weights = question.weightMap[answer]
    }

    if (weights && typeof weights === 'object') {
      for (const [domain, delta] of Object.entries(weights)) {
        vector[domain] = (vector[domain] || 0) + Number(delta)
      }
    }
  }

  return vector
}

/**
 * Stream Fit Score (0–100)
 * Uses interest vector vs college interest_tags or domain profile.
 */
export function computeStreamFit(studentProfileOrVector = {}, college = {}) {
  let vector = null
  let studentStream = ''

  if (studentProfileOrVector && typeof studentProfileOrVector === 'object') {
    if (studentProfileOrVector.interestVector && typeof studentProfileOrVector.interestVector === 'object') {
      vector = studentProfileOrVector.interestVector
    }
    if (studentProfileOrVector.stream) {
      studentStream = String(studentProfileOrVector.stream).toLowerCase()
    }
    // If no interestVector property, check if the object itself is a domain vector (e.g. { engineering: 1.5 })
    if (!vector && !studentProfileOrVector.marks && !studentProfileOrVector.state && !studentProfileOrVector.budget) {
      vector = studentProfileOrVector
    }
  }

  const tags = Array.isArray(college.interest_tags)
    ? college.interest_tags
    : Array.isArray(college.streams)
    ? college.streams
    : []

  // Check vector score first if vector exists and has domain keys
  if (vector && Object.keys(vector).length > 0) {
    let totalScore = 0
    let matchedCount = 0

    for (const tag of tags) {
      const normTag = String(tag).toLowerCase()
      for (const [domain, weight] of Object.entries(vector)) {
        if (normTag.includes(domain.toLowerCase()) || domain.toLowerCase().includes(normTag)) {
          totalScore += Number(weight)
          matchedCount++
        }
      }
    }

    if (matchedCount > 0) {
      return Math.min(100, Math.max(0, Math.round((totalScore / (tags.length * 1.0)) * 100)))
    }
  }

  // Fallback to stream string match if present
  if (studentStream && tags.length > 0) {
    if (tags.some((t) => String(t).toLowerCase().includes(studentStream) || studentStream.includes(String(t).toLowerCase()))) {
      return 85
    }
  }

  return 50
}

/**
 * Location Fit Score (0–100)
 * Primary: Haversine distance when coordinates exist for both student and college.
 * Fallback: Same district = 100, same state = 75, neighbouring state = 50, elsewhere = 25.
 */
export function computeLocationFit(studentProfile = {}, college = {}) {
  const sLat = studentProfile.latitude ?? studentProfile.lat
  const sLng = studentProfile.longitude ?? studentProfile.lng
  const cLat = college.latitude ?? college.lat
  const cLng = college.longitude ?? college.lng

  // Primary path: Haversine distance calculation
  if ([sLat, sLng, cLat, cLng].every((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))) {
    const distKm = haversineKm(sLat, sLng, cLat, cLng)
    if (distKm !== null && Number.isFinite(distKm)) {
      if (distKm <= LOCATION_FULL_SCORE_KM) return 100
      if (distKm >= LOCATION_FLOOR_KM) return LOCATION_FLOOR_SCORE
      // Linear falloff between 25km (100 pts) and 500km (25 pts)
      const slope = (100 - LOCATION_FLOOR_SCORE) / (LOCATION_FLOOR_KM - LOCATION_FULL_SCORE_KM)
      const score = 100 - (distKm - LOCATION_FULL_SCORE_KM) * slope
      return Math.max(LOCATION_FLOOR_SCORE, Math.min(100, Math.round(score)))
    }
  }

  // Fallback path: Administrative region comparison
  const sDistrict = String(studentProfile.district || '').trim().toLowerCase()
  const cDistrict = String(college.district || college.city || '').trim().toLowerCase()

  if (sDistrict && cDistrict && sDistrict === cDistrict) {
    return 100
  }

  const sState = String(studentProfile.state || '').trim().toLowerCase()
  const cState = String(college.state || '').trim().toLowerCase()

  if (sState && cState) {
    if (sState === cState) {
      return 75
    }

    // Check neighbouring state map
    const origStateName = Object.keys(NEIGHBOURING_STATES).find(
      (k) => k.toLowerCase() === sState
    )
    if (origStateName) {
      const neighbours = NEIGHBOURING_STATES[origStateName] || []
      if (neighbours.some((n) => n.toLowerCase() === cState)) {
        return 50
      }
    }
  }

  return 25
}

/**
 * Budget Fit Score (0–100)
 * Student's stated budget vs college.yearly_cost_max / college.fees.
 */
export function computeBudgetFit(studentProfile = {}, college = {}) {
  let studentMaxBudget = Infinity
  const budgetVal = studentProfile.budget || studentProfile.annualBudget || studentProfile.incomeRange

  if (typeof budgetVal === 'number' && Number.isFinite(budgetVal)) {
    studentMaxBudget = budgetVal
  } else if (typeof budgetVal === 'string' && BUDGET_BANDS[budgetVal]) {
    studentMaxBudget = BUDGET_BANDS[budgetVal]
  } else if (typeof budgetVal === 'string') {
    if (budgetVal.includes('1L') && budgetVal.includes('3L')) studentMaxBudget = 300000
    else if (budgetVal.includes('3L') && budgetVal.includes('6L')) studentMaxBudget = 600000
    else if (budgetVal.includes('below_1L') || budgetVal.includes('20k')) studentMaxBudget = 100000
    else if (budgetVal.includes('above_6L')) studentMaxBudget = 1200000
  }

  const collegeFee = Number(college.yearly_cost_max ?? college.yearly_cost_min ?? college.fees ?? college.fee)

  if (!Number.isFinite(collegeFee) || collegeFee <= 0) {
    return 50 // Neutral fallback if cost data missing
  }

  if (collegeFee <= studentMaxBudget) {
    return 100
  }

  // Linear falloff if cost exceeds budget (down to 0 if cost is 2x budget)
  const ratio = collegeFee / studentMaxBudget
  if (ratio >= 2) return 0
  return Math.max(0, Math.round(100 - (ratio - 1) * 100))
}

/**
 * Outcome Signal Score (0–100 or null)
 * Returns placement rate or ranking field if present, or null if absent/unrecorded.
 */
export function computeOutcomeSignal(college = {}) {
  const rate = college.placement_rate ?? college.placementRate ?? college.placement_percentage

  if (rate !== null && rate !== undefined && Number.isFinite(Number(rate))) {
    const numRate = Number(rate)
    // If rate is expressed as 0.0–1.0, convert to percentage 0–100
    const pct = numRate <= 1.0 && numRate > 0 ? numRate * 100 : numRate
    return Math.max(0, Math.min(100, Math.round(pct)))
  }

  const rank = college.nirf_rank ?? college.rank
  if (rank !== null && rank !== undefined && Number.isFinite(Number(rank)) && Number(rank) > 0) {
    const numRank = Number(rank)
    if (numRank <= 10) return 100
    if (numRank <= 50) return 90
    if (numRank <= 100) return 75
    if (numRank <= 200) return 60
    return 40
  }

  return null
}

/**
 * Derive size category ('small' | 'mid' | 'large' | 'unknown')
 * Intake capacity must be nullable — returns 'unknown' when null/undefined/0.
 */
export function computeSizeCategory(intake) {
  if (intake === null || intake === undefined || !Number.isFinite(Number(intake))) {
    return 'unknown'
  }
  const n = Number(intake)
  if (n <= 0) return 'unknown'

  if (n < SIZE_SMALL_MAX) return 'small'
  if (n <= SIZE_MID_MAX) return 'mid'
  return 'large'
}

/**
 * Core Deterministic Match Computation (0-100 overall score, tier, breakdown)
 */
export function computeMatch(studentProfile = {}, college = {}) {
  const academicFit = computeAcademicFit(studentProfile, college)
  const streamFit = computeStreamFit(studentProfile, college)
  const locationFit = computeLocationFit(studentProfile, college)
  const budgetFit = computeBudgetFit(studentProfile, college)
  const outcomeSignal = computeOutcomeSignal(college)
  const sizeCategory = computeSizeCategory(college.intake_capacity ?? college.intakeCapacity)

  let score = 0

  if (outcomeSignal !== null) {
    // Standard weighting
    score =
      academicFit * MATCH_WEIGHTS.academicFit +
      streamFit * MATCH_WEIGHTS.streamFit +
      locationFit * MATCH_WEIGHTS.locationFit +
      budgetFit * MATCH_WEIGHTS.budgetFit +
      outcomeSignal * MATCH_WEIGHTS.outcomeSignal
  } else {
    // Outcome signal absent: redistribute 0.10 weight proportionally across the remaining 4 factors
    const sum4 =
      MATCH_WEIGHTS.academicFit +
      MATCH_WEIGHTS.streamFit +
      MATCH_WEIGHTS.locationFit +
      MATCH_WEIGHTS.budgetFit // 0.35 + 0.20 + 0.20 + 0.15 = 0.90

    const wAcademic = MATCH_WEIGHTS.academicFit / sum4
    const wStream = MATCH_WEIGHTS.streamFit / sum4
    const wLocation = MATCH_WEIGHTS.locationFit / sum4
    const wBudget = MATCH_WEIGHTS.budgetFit / sum4

    score =
      academicFit * wAcademic +
      streamFit * wStream +
      locationFit * wLocation +
      budgetFit * wBudget
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let tier = 'low'
  if (score >= MATCH_TIER_HIGH) {
    tier = 'high'
  } else if (score >= MATCH_TIER_MODERATE) {
    tier = 'moderate'
  }

  return {
    score,
    tier,
    sizeCategory,
    breakdown: {
      academicFit,
      streamFit,
      locationFit,
      budgetFit,
      outcomeSignal: outcomeSignal ?? null,
    },
  }
}
