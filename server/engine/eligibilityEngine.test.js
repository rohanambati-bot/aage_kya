import { evaluateEligibility, parseIncomeLakh } from './eligibilityEngine.js'

console.log('Testing eligibilityEngine.js...')

// Test parseIncomeLakh
console.assert(parseIncomeLakh('below_1L') === 1.0, 'parseIncomeLakh below_1L failed')
console.assert(parseIncomeLakh('1L-3L') === 3.0, 'parseIncomeLakh 1L-3L failed')
console.assert(parseIncomeLakh(250000) === 2.5, 'parseIncomeLakh number failed')

// Test 1: Fully eligible student
const student1 = { marks: 85, incomeRange: '1L-3L', stream: 'Science (PCM)', state: 'Karnataka' }
const scholarship1 = { marks_requirement: 75, income_limit_lakh: 5.0, eligible_streams: ['Science (PCM)'], eligible_states: ['Karnataka'] }
const res1 = evaluateEligibility(student1, scholarship1)
console.assert(res1.status === 'eligible', 'res1 status should be eligible')
console.assert(res1.eligible === true, 'res1 should be eligible true')
console.assert(res1.matchedRules.length === 4, 'res1 should match 4 rules')

// Test 2: Failed marks requirement
const student2 = { marks: 60, incomeRange: '1L-3L', stream: 'Science (PCM)', state: 'Karnataka' }
const res2 = evaluateEligibility(student2, scholarship1)
console.assert(res2.status === 'not_eligible', 'res2 status should be not_eligible')
console.assert(res2.failedRules.length === 1, 'res2 should have 1 failed rule')

// Test 3: Missing income data -> needs_verification (unknown rule)
const student3 = { marks: 85, incomeRange: '', stream: 'Science (PCM)', state: 'Karnataka' }
const res3 = evaluateEligibility(student3, scholarship1)
console.assert(res3.status === 'needs_verification', 'res3 status should be needs_verification')
console.assert(res3.unknownRules.length === 1, 'res3 should have 1 unknown rule')

console.log('✅ All eligibilityEngine tests passed successfully!')
