/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SCHOLARSHIP AUTO-MATCHER ENGINE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Auto-matches student profiles against scholarship schemes/cycles,
 *  returning bucketed matches with explicit rule breakdowns.
 */

import { evaluateEligibility } from './eligibilityEngine.js'

/**
 * Match a student profile against a list of scholarship schemes or cycles.
 *
 * @param {Object} studentProfile - { marks, incomeRange, state, stream }
 * @param {Array} scholarshipsList - Array of scholarship objects
 * @returns {Object} { eligible: Array, potential: Array, notEligible: Array }
 */
export function matchScholarshipsForStudent(studentProfile = {}, scholarshipsList = []) {
  const eligible = []
  const potential = []
  const notEligible = []

  if (!Array.isArray(scholarshipsList)) {
    return { eligible, potential, notEligible }
  }

  for (const scholarship of scholarshipsList) {
    const evalRes = evaluateEligibility(studentProfile, scholarship)
    const item = {
      ...scholarship,
      matchResult: evalRes
    }

    if (evalRes.status === 'eligible') {
      eligible.push(item)
    } else if (evalRes.status === 'needs_verification') {
      potential.push(item)
    } else {
      notEligible.push(item)
    }
  }

  return {
    eligible,
    potential,
    notEligible
  }
}
