/**
 * ══════════════════════════════════════════════════════════════════════════
 *  AFFORDABILITY ENGINE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Calculates net education costs across 3 realistic financial scenarios
 *  and evaluates family financial burden ratios transparently.
 */

import { parseIncomeLakh } from './eligibilityEngine.js'

/**
 * Calculate full net cost, financial scenarios, and affordability burden ratio.
 *
 * @param {Object} studentProfile - { incomeRange, budget }
 * @param {Object} program - { yearly_tuition_min, yearly_tuition_max, hostel_cost_annual, duration_years }
 * @param {Array} matchedScholarships - Array of scholarship objects with award_amount_max
 */
export function calculateAffordability(studentProfile = {}, program = {}, matchedScholarships = []) {
  const duration = Number(program.duration_years || program.duration || 4)
  const tuitionMin = Number(program.yearly_tuition_min ?? program.yearly_cost_min ?? 50000)
  const tuitionMax = Number(program.yearly_tuition_max ?? program.yearly_cost_max ?? 150000)
  const hostelCost = Number(program.hostel_cost_annual ?? 60000)

  // Calculate annual total scholarship aid
  const totalAnnualAid = (matchedScholarships || []).reduce((sum, s) => {
    const amt = Number(s.award_amount_max || s.amount || 0)
    return sum + amt
  }, 0)

  // Financial Scenarios (Low, Base, High estimates)
  const lowAnnualCost = Math.max(0, tuitionMin + (hostelCost * 0.8) - totalAnnualAid)
  const baseAnnualCost = Math.max(0, ((tuitionMin + tuitionMax) / 2) + hostelCost - totalAnnualAid)
  const highAnnualCost = Math.max(0, tuitionMax + (hostelCost * 1.3) - totalAnnualAid)

  const scenarios = {
    low: {
      annual: Math.round(lowAnnualCost),
      total: Math.round(lowAnnualCost * duration),
      description: 'Low-estimate (subsidised hostel, conservative living)'
    },
    base: {
      annual: Math.round(baseAnnualCost),
      total: Math.round(baseAnnualCost * duration),
      description: 'Base-estimate (standard tuition + campus hostel + aid)'
    },
    high: {
      annual: Math.round(highAnnualCost),
      total: Math.round(highAnnualCost * duration),
      description: 'High-estimate (upper tuition band + private accommodation)'
    }
  }

  // Calculate family income & burden ratio
  const familyIncomeLakh = parseIncomeLakh(studentProfile.incomeRange || studentProfile.income_range) || 3.0
  const familyIncomeAnnual = familyIncomeLakh * 100000

  const burdenRatio = familyIncomeAnnual > 0
    ? Math.round((baseAnnualCost / familyIncomeAnnual) * 100)
    : 50

  let burdenCategory = 'Low burden'
  if (burdenRatio > 50) {
    burdenCategory = 'High burden'
  } else if (burdenRatio > 25) {
    burdenCategory = 'Moderate burden'
  }

  return {
    durationYears: duration,
    totalAnnualAid: Math.round(totalAnnualAid),
    scenarios,
    familyIncomeAnnual: Math.round(familyIncomeAnnual),
    burdenRatioPct: burdenRatio,
    burdenCategory,
  }
}
