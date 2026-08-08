/**
 * ══════════════════════════════════════════════════════════════════════════
 *  DETERMINISTIC ELIGIBILITY ENGINE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Evaluates eligibility for programs and scholarships using deterministic rules.
 *  Never relies on LLMs to determine factual eligibility.
 *
 *  Key principle: missing/unprovided data returns 'needs_verification', not 'not_eligible'.
 */

/**
 * Parse income string or number into numeric lakhs.
 * e.g. "below_1L" -> 1, "1L-3L" -> 3, "3L-6L" -> 6, 250000 -> 2.5
 */
export function parseIncomeLakh(incomeVal) {
  if (incomeVal === null || incomeVal === undefined || incomeVal === '') return null
  if (typeof incomeVal === 'number') {
    return incomeVal > 100 ? incomeVal / 100000 : incomeVal
  }
  const str = String(incomeVal).toLowerCase()
  if (str.includes('below_1l') || str.includes('below 1')) return 1.0
  if (str.includes('1l-3l') || str.includes('1 to 3')) return 3.0
  if (str.includes('3l-6l') || str.includes('3 to 6')) return 6.0
  if (str.includes('above_6l') || str.includes('above 6')) return 12.0
  const match = str.match(/(\d+(\.\d+)?)\s*l/)
  if (match) return parseFloat(match[1])
  const num = parseFloat(str)
  if (!isNaN(num)) return num > 100 ? num / 100000 : num
  return null
}

/**
 * Check if student stream matches allowed streams.
 * Empty array or ['All'] means any stream is eligible.
 */
export function checkStreamMatch(studentStream, allowedStreams = []) {
  if (!Array.isArray(allowedStreams) || allowedStreams.length === 0) return true
  if (allowedStreams.some(s => String(s).toLowerCase() === 'all')) return true
  if (!studentStream) return null // Unknown

  const sNorm = String(studentStream).toLowerCase()
  return allowedStreams.some(a => {
    const aNorm = String(a).toLowerCase()
    return sNorm.includes(aNorm) || aNorm.includes(sNorm)
  })
}

/**
 * Check if student state matches allowed states.
 * Empty array or ['All'] means all states eligible.
 */
export function checkStateMatch(studentState, allowedStates = []) {
  if (!Array.isArray(allowedStates) || allowedStates.length === 0) return true
  if (allowedStates.some(s => String(s).toLowerCase() === 'all')) return true
  if (!studentState) return null // Unknown

  const sNorm = String(studentState).trim().toLowerCase()
  return allowedStates.some(a => String(a).trim().toLowerCase() === sNorm)
}

/**
 * Deterministically evaluate eligibility of a student profile against a item (scholarship cycle or program offering).
 *
 * @param {Object} studentProfile - { marks, incomeRange, incomeLakh, state, stream, category }
 * @param {Object} target - { income_limit_lakh, marks_requirement, eligible_streams, eligible_states, eligible_categories }
 * @returns {Object} { eligible: boolean, status: 'eligible'|'not_eligible'|'needs_verification', matchedRules: Array, failedRules: Array, unknownRules: Array }
 */
export function evaluateEligibility(studentProfile = {}, target = {}) {
  const matchedRules = []
  const failedRules = []
  const unknownRules = []

  // 1. Marks Rule
  const requiredMarks = Number(target.marks_requirement ?? target.min_marks ?? 0)
  const studentMarks = studentProfile.marks !== undefined && studentProfile.marks !== null && studentProfile.marks !== ''
    ? Number(studentProfile.marks)
    : null

  if (requiredMarks > 0) {
    if (studentMarks === null || isNaN(studentMarks)) {
      unknownRules.push({
        rule: 'marks',
        description: `Minimum ${requiredMarks}% marks required`,
        required: requiredMarks,
        provided: null
      })
    } else if (studentMarks >= requiredMarks) {
      matchedRules.push({
        rule: 'marks',
        description: `Marks criteria met (${studentMarks}% >= ${requiredMarks}%)`,
        required: requiredMarks,
        provided: studentMarks
      })
    } else {
      failedRules.push({
        rule: 'marks',
        description: `Marks below requirement (${studentMarks}% < ${requiredMarks}%)`,
        required: requiredMarks,
        provided: studentMarks
      })
    }
  }

  // 2. Income Limit Rule
  const maxIncomeLakh = Number(target.income_limit_lakh ?? target.eligibility_income_max_lakh ?? 99)
  const studentIncomeLakh = studentProfile.incomeLakh !== undefined
    ? Number(studentProfile.incomeLakh)
    : parseIncomeLakh(studentProfile.incomeRange || studentProfile.income_range)

  if (maxIncomeLakh < 99) {
    if (studentIncomeLakh === null) {
      unknownRules.push({
        rule: 'income',
        description: `Family income must be below ₹${maxIncomeLakh} Lakh/yr`,
        required: maxIncomeLakh,
        provided: null
      })
    } else if (studentIncomeLakh <= maxIncomeLakh) {
      matchedRules.push({
        rule: 'income',
        description: `Income criteria met (₹${studentIncomeLakh}L <= ₹${maxIncomeLakh}L)`,
        required: maxIncomeLakh,
        provided: studentIncomeLakh
      })
    } else {
      failedRules.push({
        rule: 'income',
        description: `Income exceeds limit (₹${studentIncomeLakh}L > ₹${maxIncomeLakh}L)`,
        required: maxIncomeLakh,
        provided: studentIncomeLakh
      })
    }
  }

  // 3. Stream Match Rule
  const allowedStreams = target.eligible_streams || target.streams || []
  if (Array.isArray(allowedStreams) && allowedStreams.length > 0 && !allowedStreams.some(s => String(s).toLowerCase() === 'all')) {
    const streamRes = checkStreamMatch(studentProfile.stream, allowedStreams)
    if (streamRes === null) {
      unknownRules.push({
        rule: 'stream',
        description: `Eligible streams: ${allowedStreams.join(', ')}`,
        required: allowedStreams,
        provided: null
      })
    } else if (streamRes === true) {
      matchedRules.push({
        rule: 'stream',
        description: `Stream matched (${studentProfile.stream})`,
        required: allowedStreams,
        provided: studentProfile.stream
      })
    } else {
      failedRules.push({
        rule: 'stream',
        description: `Stream does not match eligible streams (${allowedStreams.join(', ')})`,
        required: allowedStreams,
        provided: studentProfile.stream
      })
    }
  }

  // 4. State Domicile Rule
  const allowedStates = target.eligible_states || []
  if (Array.isArray(allowedStates) && allowedStates.length > 0 && !allowedStates.some(s => String(s).toLowerCase() === 'all')) {
    const stateRes = checkStateMatch(studentProfile.state, allowedStates)
    if (stateRes === null) {
      unknownRules.push({
        rule: 'state',
        description: `Eligible states: ${allowedStates.join(', ')}`,
        required: allowedStates,
        provided: null
      })
    } else if (stateRes === true) {
      matchedRules.push({
        rule: 'state',
        description: `State domicile matched (${studentProfile.state})`,
        required: allowedStates,
        provided: studentProfile.state
      })
    } else {
      failedRules.push({
        rule: 'state',
        description: `State does not match required states (${allowedStates.join(', ')})`,
        required: allowedStates,
        provided: studentProfile.state
      })
    }
  }

  // Determine overall status
  let status = 'eligible'
  let eligible = true

  if (failedRules.length > 0) {
    status = 'not_eligible'
    eligible = false
  } else if (unknownRules.length > 0) {
    status = 'needs_verification'
    eligible = true // Provisionally eligible subject to verification
  }

  return {
    eligible,
    status,
    matchedRules,
    failedRules,
    unknownRules,
  }
}
