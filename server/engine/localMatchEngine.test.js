import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeMatch,
  computeAcademicFit,
  computeLocationFit,
  computeBudgetFit,
  computeStreamFit,
  computeOutcomeSignal,
  computeSizeCategory,
  haversineKm,
} from './localMatchEngine.js'

describe('Local Match Engine Unit Tests', () => {

  test('Haversine distance calculation for known locations', () => {
    // Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777) ~1148 km
    const dist = haversineKm(28.6139, 77.2090, 19.0760, 72.8777)
    assert.ok(dist > 1100 && dist < 1200, `Expected ~1150km, got ${dist}`)

    // Same location = 0km
    const zero = haversineKm(12.9716, 77.5946, 12.9716, 77.5946)
    assert.equal(zero, 0)
  })

  test('Clear High Match case', () => {
    const student = {
      marks: 92,
      lat: 12.9716,
      lng: 77.5946, // Bangalore
      district: 'Bangalore',
      state: 'Karnataka',
      budget: '3L-6L',
      interestVector: { engineering: 1.5, computing: 1.2 },
    }

    const college = {
      min_marks: 85,
      lat: 12.9352,
      lng: 77.6245, // Koramangala (~5km away)
      district: 'Bangalore',
      state: 'Karnataka',
      yearly_cost_max: 250000,
      placement_rate: 90,
      interest_tags: ['engineering', 'computing'],
      intake_capacity: 600,
    }

    const result = computeMatch(student, college)
    assert.equal(result.tier, 'high')
    assert.ok(result.score >= 75, `Expected score >= 75, got ${result.score}`)
    assert.equal(result.breakdown.academicFit, 100)
    assert.equal(result.breakdown.locationFit, 100)
    assert.equal(result.breakdown.budgetFit, 100)
    assert.equal(result.breakdown.outcomeSignal, 90)
    assert.equal(result.sizeCategory, 'mid')
  })

  test('Clear Low Match case', () => {
    const student = {
      marks: 45,
      lat: 28.6139,
      lng: 77.2090, // Delhi
      state: 'Delhi',
      budget: 'below_1L',
      interestVector: { arts: 1.5 },
    }

    const college = {
      min_marks: 90,
      lat: 13.0827,
      lng: 80.2707, // Chennai (~1750km away)
      state: 'Tamil Nadu',
      yearly_cost_max: 500000,
      placement_rate: 40,
      interest_tags: ['engineering'],
      intake_capacity: 2500,
    }

    const result = computeMatch(student, college)
    assert.equal(result.tier, 'low')
    assert.ok(result.score < 50, `Expected score < 50, got ${result.score}`)
    assert.equal(result.sizeCategory, 'large')
  })

  test('Boundary tier threshold - exactly 75 is high', () => {
    const student = { marks: 80, state: 'Karnataka' }
    const college = { min_marks: 80, state: 'Karnataka', yearly_cost_max: 100000, placement_rate: 75, interest_tags: ['science'] }

    const result = computeMatch(student, college)
    assert.ok(result.score >= 75)
    assert.equal(result.tier, 'high')
  })

  test('Boundary tier threshold - exactly 50 is moderate', () => {
    const student = { marks: 60, state: 'Delhi' }
    const college = { min_marks: 70, state: 'Maharashtra', yearly_cost_max: 500000, placement_rate: 50, interest_tags: ['arts'] }

    const result = computeMatch(student, college)
    assert.ok(result.score >= 50 && result.score < 75)
    assert.equal(result.tier, 'moderate')
  })

  test('Missing cutoff data defaults academicFit to neutral 50', () => {
    const fit = computeAcademicFit({ marks: 85 }, { min_marks: null })
    assert.equal(fit, 50)
  })

  test('Missing lat/long coordinates falls back to state adjacency', () => {
    const student = { state: 'Karnataka' }
    const collegeSameState = { state: 'Karnataka' }
    const collegeNeighbour = { state: 'Kerala' }
    const collegeDistant = { state: 'Punjab' }

    assert.equal(computeLocationFit(student, collegeSameState), 75)
    assert.equal(computeLocationFit(student, collegeNeighbour), 50)
    assert.equal(computeLocationFit(student, collegeDistant), 25)
  })

  test('Missing district data uses state-level fallback', () => {
    const student = { state: 'Maharashtra' }
    const college = { state: 'Maharashtra' }

    const locFit = computeLocationFit(student, college)
    assert.equal(locFit, 75)
  })

  test('Outcome signal null causes weight redistribution across 4 remaining factors', () => {
    const student = { marks: 90, state: 'Karnataka', budget: '3L-6L', stream: 'Science (PCM)' }
    const collegeNoOutcome = { min_marks: 90, state: 'Karnataka', yearly_cost_max: 200000, placement_rate: null, interest_tags: ['Science (PCM)'] }

    const result = computeMatch(student, collegeNoOutcome)
    assert.equal(result.breakdown.outcomeSignal, null)
    // Academic (100), Location (75), Budget (100), Stream (85).
    // Sum = (100*0.35 + 85*0.20 + 75*0.20 + 100*0.15) / 0.90 = (35 + 17 + 15 + 15) / 0.90 = 82 / 0.90 = 91.11 => 91
    assert.equal(result.score, 91)
    assert.equal(result.tier, 'high')
  })

  test('computeSizeCategory returns unknown for null, undefined, or 0', () => {
    assert.equal(computeSizeCategory(null), 'unknown')
    assert.equal(computeSizeCategory(undefined), 'unknown')
    assert.equal(computeSizeCategory(0), 'unknown')
    assert.equal(computeSizeCategory(-10), 'unknown')
    assert.equal(computeSizeCategory(300), 'small')
    assert.equal(computeSizeCategory(1200), 'mid')
    assert.equal(computeSizeCategory(3000), 'large')
  })
})
